/**
 * /quiz — questions[{q, choices?, answer, explanation}], citations[].
 * Uses RAG when useRag; GPT-4o for generation.
 */

import { getDb } from '../../db/index.js';
import { getRagContext } from '../ragService.js';
import { chatCompletion, isConfigured as openAiConfigured } from '../azureOpenAIClient.js';

const QUIZ_DOCUMENT_CAP = 8000;
const NUM_QUESTIONS = 5;

export async function run({ userId, messages, context, args }) {
  const db = getDb();
  const text = (context?.documentText != null && context.documentText !== '')
    ? String(context.documentText).trim().slice(0, QUIZ_DOCUMENT_CAP)
    : (args || '').trim() || 'General study topic';
  const useRag = context?.useRag !== false;
  const query = (context?.topic || text.slice(0, 200)).trim();
  let rag = { contextText: text.slice(0, 8000), citations: [] };
  if (useRag) {
    try {
      rag = await getRagContext({ query, documentText: text, useRag: true, topK: 5, userId });
    } catch (e) {
      console.warn('[quiz] RAG:', e.message);
    }
  }

  const weak = db.prepare('SELECT COALESCE(SUM(weakCount), 0) as total FROM topicStats WHERE userId = ?').get(userId || 'anonymous');
  const difficulty = (weak?.total || 0) >= 5 ? 'easy' : 'medium';

  if (openAiConfigured() && rag.contextText) {
    try {
      const system = `You are a study assistant. Generate ${NUM_QUESTIONS} multiple-choice quiz questions from the content. Return valid JSON only with key "questions" (array of objects). Each object: "q" (question text), "choices" (array of 4 option strings), "answer" (correct option text or index 0-3), "explanation" (short explanation). No other text.`;
      const userContent = `Content:\n${rag.contextText.slice(0, 6000)}\n\nDifficulty: ${difficulty}. Provide the JSON.`;
      const { content } = await chatCompletion({
        system,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.5,
        maxTokens: 1200,
        responseFormat: { type: 'json_object' },
      });
      let parsed = { questions: [] };
      try {
        parsed = JSON.parse(content || '{}');
      } catch {}
      const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
      const questions = raw.slice(0, NUM_QUESTIONS).map((q, i) => ({
        q: q.q || q.question || `Question ${i + 1}`,
        choices: Array.isArray(q.choices) ? q.choices : (q.options || []),
        answer: q.answer ?? (q.choices?.[0] ?? q.options?.[0] ?? ''),
        explanation: q.explanation || '',
      }));

      const quizId = 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      db.prepare(
        'INSERT INTO quizzes (id, userId, topic, difficulty, numQuestions, questions) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(quizId, userId || 'anonymous', query, difficulty, questions.length, JSON.stringify(questions));

      const preview = questions.slice(0, 3).map((q, i) => {
        const opts = (q.choices || []).map((o, idx) => `${idx + 1}) ${o}`).join('  ');
        return `Q${i + 1}: ${q.q}\n${opts}`;
      }).join('\n\n');
      const reply = `✅ Quiz on: ${query}\nDifficulty: ${difficulty}\nQuiz ID: ${quizId}\n\n${preview}`;
      const citations = rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score }));
      return {
        reply,
        suggestions: [],
        structured: { questions, quizId, topic: query, difficulty },
        citations,
      };
    } catch (e) {
      console.warn('[quiz] OpenAI:', e.message);
    }
  }

  const copilot = await import('../copilotService/index.js');
  const result = await copilot.generateQuiz({
    userId: userId || 'anonymous',
    topic: text,
    difficulty,
    numQuestions: NUM_QUESTIONS,
  });
  const quizId = 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  db.prepare(
    'INSERT INTO quizzes (id, userId, topic, difficulty, numQuestions, questions) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(quizId, userId || 'anonymous', result.topic, result.difficulty, result.questions.length, JSON.stringify(result.questions));

  const questions = (result.questions || []).map((q) => ({
    q: q.question || q.q,
    choices: q.options || q.choices || [],
    answer: q.options?.[q.correctIndex ?? 0] ?? '',
    explanation: q.explanation || '',
  }));
  const preview = questions.slice(0, 3).map((q, i) => {
    const opts = (q.choices || []).map((o, idx) => `${idx + 1}) ${o}`).join('  ');
    return `Q${i + 1}: ${q.q}\n${opts}`;
  }).join('\n\n');
  const reply = `✅ Quiz on: ${result.topic}\nDifficulty: ${result.difficulty}\nQuiz ID: ${quizId}\n\n${preview}`;
  return {
    reply,
    suggestions: [],
    structured: { questions, quizId, topic: result.topic, difficulty: result.difficulty },
    citations: [],
  };
}
