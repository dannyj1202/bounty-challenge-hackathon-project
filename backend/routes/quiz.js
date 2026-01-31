import { Router } from 'express';
import { getDb } from '../db/index.js';
import * as copilot from '../services/copilotService/index.js';

const router = Router();

/* -----------------------------
   Helpers for adaptive mode
------------------------------ */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Generate ONE MCQ using existing generateQuiz(numQuestions=1)
async function generateOneMCQ({ userId, topic, difficulty, subtopic }) {
  const result = await copilot.generateQuiz({
    userId,
    topic: subtopic ? `${topic} (focus: ${subtopic})` : topic,
    difficulty,
    numQuestions: 1
  });

  const q = result?.questions?.[0];
  if (!q) throw new Error('No question generated');
  if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
    throw new Error('Invalid question format from copilot.generateQuiz');
  }

  return {
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation || '',
    subtopic: subtopic || topic
  };
}

function pickWeakestTopic(db, userId, fallback) {
  const row = db
    .prepare('SELECT topic, weakCount FROM topicStats WHERE userId = ? ORDER BY weakCount DESC LIMIT 1')
    .get(userId);
  return row?.topic || fallback;
}

/* =========================================================
   POST /api/quiz/generate
========================================================= */

// Body: { userId, topic, difficulty, numQuestions }
router.post('/generate', async (req, res) => {
  const { userId, topic, difficulty, numQuestions = 5 } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'topic required' });

  try {
    const result = await copilot.generateQuiz({ userId, topic, difficulty, numQuestions });
    const id = 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const db = getDb();

    db.prepare(
      'INSERT INTO quizzes (id, userId, topic, difficulty, numQuestions, questions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      userId || 'anonymous',
      result.topic,
      result.difficulty,
      result.questions.length,
      JSON.stringify(result.questions)
    );

    res.status(201).json({ quizId: id, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================================
   POST /api/quiz/submit
========================================================= */

// Body: { userId, quizId, answers: [...] }
router.post('/submit', async (req, res) => {
  const { userId, quizId, answers } = req.body || {};
  if (!quizId || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'quizId and answers required' });
  }

  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const questions = JSON.parse(quiz.questions);
  let correct = 0;

  questions.forEach((q, i) => {
    if (q.correctIndex === answers[i]) correct++;
  });

  // Always compute score locally so it is consistent across mock/Azure
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

  try {
    // Only use Copilot for weak topics + suggestions (not score)
    const result = await copilot.getWeakTopicsAndSuggestions({ quizId, answers, userId });
    const weakTopics = result.weakTopics || [];
    const suggestions = result.suggestions || [];
    const attemptId = 'attempt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    db.prepare(
      'INSERT INTO quizAttempts (id, quizId, userId, answers, score, weakTopics, suggestions) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      attemptId,
      quizId,
      userId || 'anonymous',
      JSON.stringify(answers),
      score,
      JSON.stringify(weakTopics),
      JSON.stringify(suggestions)
    );

    // Update topic weak stats
    weakTopics.forEach((t) => {
      const st = db.prepare('SELECT id, weakCount FROM topicStats WHERE userId = ? AND topic = ?')
        .get(userId || 'anonymous', t);

      if (st) {
        db.prepare(
          "UPDATE topicStats SET weakCount = weakCount + 1, updatedAt = datetime('now') WHERE userId = ? AND topic = ?"
        ).run(userId || 'anonymous', t);
      } else {
        db.prepare(
          'INSERT INTO topicStats (userId, topic, weakCount) VALUES (?, ?, 1)'
        ).run(userId || 'anonymous', t);
      }
    });

    res.json({
      score,
      correct,
      total: questions.length,
      weakTopics,
      suggestions,
      explanation: result.explanation,
      confidence: result.confidence,
      attemptId,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================================
   Adaptive quiz endpoints
   Base path: /api/quiz/adaptive/...
========================================================= */

// POST /api/quiz/adaptive/start { userId, topic }
router.post('/adaptive/start', async (req, res) => {
  const { userId, topic } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'topic required' });

  try {
    const db = getDb();
    const uid = userId || 'anonymous';
    const sessionId = 'aq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);

    const difficulty = 3;
    const subtopic = pickWeakestTopic(db, uid, topic);
    const q = await generateOneMCQ({ userId: uid, topic, difficulty, subtopic });

    db.prepare(
      `INSERT INTO quizAdaptiveSessions
       (id, userId, topic, difficulty, currentQuestion, currentOptions, currentAnswerIndex, currentExplanation, currentSubtopic, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      sessionId,
      uid,
      topic,
      difficulty,
      q.question,
      JSON.stringify(q.options),
      q.correctIndex,
      q.explanation,
      q.subtopic
    );

    res.status(201).json({
      sessionId,
      topic,
      difficulty,
      question: q.question,
      options: q.options,
      subtopic: q.subtopic
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/quiz/adaptive/answer { userId, sessionId, selectedIndex }
router.post('/adaptive/answer', async (req, res) => {
  const { userId, sessionId, selectedIndex } = req.body || {};
  if (!sessionId || selectedIndex === undefined) {
    return res.status(400).json({ error: 'sessionId and selectedIndex required' });
  }

  try {
    const db = getDb();
    const uid = userId || 'anonymous';

    const session = db.prepare('SELECT * FROM quizAdaptiveSessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const correct = Number(selectedIndex) === Number(session.currentAnswerIndex);
    const currentDifficulty = Number(session.difficulty || 3);

    // Correct => harder; Wrong => easier
    const nextDifficulty = clamp(currentDifficulty + (correct ? 1 : -1), 1, 5);

    // Track weakness if wrong
    const sub = session.currentSubtopic || session.topic;
    if (!correct) {
      const st = db.prepare('SELECT id, weakCount FROM topicStats WHERE userId = ? AND topic = ?').get(uid, sub);
      if (st) {
        db.prepare(
          "UPDATE topicStats SET weakCount = weakCount + 1, updatedAt = datetime('now') WHERE userId = ? AND topic = ?"
        ).run(uid, sub);
      } else {
        db.prepare('INSERT INTO topicStats (userId, topic, weakCount) VALUES (?, ?, 1)').run(uid, sub);
      }
    }

    // Next question prioritizes weakest topic
    const nextSubtopic = pickWeakestTopic(db, uid, session.topic);

    const nextQ = await generateOneMCQ({
      userId: uid,
      topic: session.topic,
      difficulty: nextDifficulty,
      subtopic: nextSubtopic
    });

    // Update session
    db.prepare(
      `UPDATE quizAdaptiveSessions
       SET difficulty = ?, currentQuestion = ?, currentOptions = ?, currentAnswerIndex = ?, currentExplanation = ?, currentSubtopic = ?, updatedAt = datetime('now')
       WHERE id = ?`
    ).run(
      nextDifficulty,
      nextQ.question,
      JSON.stringify(nextQ.options),
      nextQ.correctIndex,
      nextQ.explanation,
      nextQ.subtopic,
      sessionId
    );

    // Return top weak topics
    const weakTopics = db.prepare(
      'SELECT topic, weakCount FROM topicStats WHERE userId = ? ORDER BY weakCount DESC LIMIT 5'
    ).all(uid);

    res.json({
      correct,
      explanation: session.currentExplanation,
      newDifficulty: nextDifficulty,
      nextQuestion: nextQ.question,
      nextOptions: nextQ.options,
      nextSubtopic: nextQ.subtopic,
      weakTopics
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================================
   History & Stats
========================================================= */

// GET /api/quiz/history?userId=...
router.get('/history', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        qa.id as attemptId,
        qa.quizId,
        qa.score,
        qa.createdAt,
        q.topic,
        q.difficulty,
        q.numQuestions
      FROM quizAttempts qa
      JOIN quizzes q ON q.id = qa.quizId
      WHERE qa.userId = ?
      ORDER BY qa.createdAt DESC
      LIMIT 25
    `).all(userId);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/quiz/stats?userId=...
router.get('/stats', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const db = getDb();

    const weak = db.prepare(`
      SELECT topic, weakCount, updatedAt
      FROM topicStats
      WHERE userId = ?
      ORDER BY weakCount DESC
      LIMIT 10
    `).all(userId);

    res.json({ userId, weakTopics: weak });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
