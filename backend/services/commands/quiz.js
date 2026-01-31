import { getDb } from '../../db/index.js';
import * as copilot from '../copilotService/index.js';

/**
 * Copilot command handler for "/quiz"
 * NOTE: This is NOT an Express router file.
 * It must export a named function: run()
 *
 * Usage examples in Copilot:
 *  /quiz Binary Search Trees
 *  /quiz Operating Systems scheduling
 */
const QUIZ_DOCUMENT_CAP = 8000;

export async function run({ userId, messages, context, args }) {
  // Use document (noteId/text) as topic when provided; else command args
  const text = (context?.documentText != null && context.documentText !== '')
    ? String(context.documentText).trim().slice(0, QUIZ_DOCUMENT_CAP)
    : (args || '').trim() || 'General study topic';
  const db = getDb();

  // Decide a simple difficulty hint (string) for your existing generateQuiz
  // If user has many weak topics recorded, start "easy", else "medium".
  const weak = db
    .prepare('SELECT COALESCE(SUM(weakCount), 0) as total FROM topicStats WHERE userId = ?')
    .get(userId || 'anonymous');

  const totalWeak = weak?.total || 0;
  const difficulty = totalWeak >= 5 ? 'easy' : 'medium';

  // Generate quiz (5 questions)
  const result = await copilot.generateQuiz({
    userId: userId || 'anonymous',
    topic: text,
    difficulty,
    numQuestions: 5
  });

  // Persist like your route does
  const quizId = 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  db.prepare(
    'INSERT INTO quizzes (id, userId, topic, difficulty, numQuestions, questions) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    quizId,
    userId || 'anonymous',
    result.topic,
    result.difficulty,
    result.questions.length,
    JSON.stringify(result.questions)
  );

  // Format a short response for Copilot UI
  const preview = (result.questions || []).slice(0, 3).map((q, i) => {
    const opts = (q.options || []).map((o, idx) => `${idx + 1}) ${o}`).join('  ');
    return `Q${i + 1}: ${q.question}\n${opts}`;
  }).join('\n\n');

  const reply =
    `✅ Generated a quiz on: ${result.topic}\n` +
    `Difficulty: ${result.difficulty}\n` +
    `Quiz ID: ${quizId}\n\n` +
    `${preview}\n\n` +
    `Go to Quiz Mode page to answer it, or use: /check ${quizId} 1,2,3,4,1`;

  return { reply, suggestions: [] };
}
