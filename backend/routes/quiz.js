import { Router } from 'express';
import { getDb } from '../db/index.js';
import * as copilot from '../services/copilotService/index.js';

const router = Router();

// POST /api/quiz/generate { userId, topic, difficulty, numQuestions }
router.post('/generate', async (req, res) => {
  const { userId, topic, difficulty, numQuestions = 5 } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try {
    const result = await copilot.generateQuiz({ userId, topic, difficulty, numQuestions });
    const id = 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const db = getDb();
    db.prepare(
      'INSERT INTO quizzes (id, userId, topic, difficulty, numQuestions, questions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId || 'anonymous', result.topic, result.difficulty, result.questions.length, JSON.stringify(result.questions));
    res.status(201).json({ quizId: id, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/quiz/submit { userId, quizId, answers: [...] }
router.post('/submit', async (req, res) => {
  const { userId, quizId, answers } = req.body || {};
  if (!quizId || !Array.isArray(answers)) return res.status(400).json({ error: 'quizId and answers required' });
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const questions = JSON.parse(quiz.questions);
  let correct = 0;
  questions.forEach((q, i) => { if (q.correctIndex === answers[i]) correct++; });
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  try {
    const result = await copilot.getWeakTopicsAndSuggestions({ quizId, answers, userId });
    const weakTopics = result.weakTopics || [];
    const suggestions = result.suggestions || [];
    const attemptId = 'attempt-' + Date.now();
    db.prepare(
      'INSERT INTO quizAttempts (id, quizId, userId, answers, score, weakTopics, suggestions) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(attemptId, quizId, userId || 'anonymous', JSON.stringify(answers), result.score ?? score, JSON.stringify(weakTopics), JSON.stringify(suggestions));
    weakTopics.forEach((t) => {
      const st = db.prepare('SELECT id, weakCount FROM topicStats WHERE userId = ? AND topic = ?').get(userId || 'anonymous', t);
      if (st) db.prepare('UPDATE topicStats SET weakCount = weakCount + 1, updatedAt = datetime(\'now\') WHERE userId = ? AND topic = ?').run(userId || 'anonymous', t);
      else db.prepare('INSERT INTO topicStats (userId, topic, weakCount) VALUES (?, ?, 1)').run(userId || 'anonymous', t);
    });
    res.json({
      score: result.score ?? score,
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

export default router;
