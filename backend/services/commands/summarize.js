/**
 * /summarize — summary, keyPoints[], definitions[], nextSteps[], citations[].
 * Uses RAG when useRag; GPT-4o when Azure OpenAI configured; else deterministic fallback.
 */

import { getDb } from '../../db/index.js';
import { getRagContext } from '../ragService.js';
import { chatCompletion, isConfigured as openAiConfigured } from '../azureOpenAIClient.js';

const INPUT_CAP = 12000;
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'as', 'if', 'so', 'than', 'when', 'which', 'who', 'what', 'where', 'how', 'i', 'you', 'we', 'they',
]);

function getLastNotesContent(db, userId, limit = 3) {
  try {
    const rows = db.prepare(
      'SELECT content, title FROM notes WHERE userId = ? AND (content IS NOT NULL AND content != "") ORDER BY createdAt DESC, id DESC LIMIT ?'
    ).all(userId, limit);
    return rows.map((r) => (r.title ? `[${r.title}]\n` : '') + (r.content || '')).join('\n\n');
  } catch {
    return '';
  }
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function simpleSummarize(text) {
  const t = String(text || '').trim().slice(0, INPUT_CAP);
  if (!t) return { summary: '', keyPoints: [], definitions: [], nextSteps: [] };
  const sentences = t.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s && s.length > 10).slice(0, 15);
  const keyPoints = sentences.slice(0, 5).map((s) => (s.length > 120 ? s.slice(0, 117) + '...' : s));
  const words = tokenize(t);
  const freq = {};
  words.forEach((w) => {
    if (w.length > 2 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  const definitions = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  const nextSteps = [
    'Review the key points and test yourself.',
    'Connect this material to something you already know.',
    'Practice explaining one point in your own words.',
  ];
  const summary = keyPoints.slice(0, 3).join(' ') || t.slice(0, 300);
  return { summary, keyPoints, definitions, nextSteps };
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [], citations: [] };

  const db = getDb();
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get();
  let text = (context?.documentText != null && context.documentText !== '')
    ? String(context.documentText).trim().slice(0, INPUT_CAP)
    : (args || '').trim();
  if (!text && tableExists) text = getLastNotesContent(db, userId);
  if (!text) {
    return {
      reply: 'Usage: /summarize <text> — or add notes/upload a doc and run /summarize to summarize.',
      suggestions: [],
      structured: null,
      citations: [],
    };
  }

  const useRag = context?.useRag !== false;
  const query = (context?.topic || text.slice(0, 200)).trim();
  let rag = { contextText: text.slice(0, 8000), citations: [] };
  if (useRag) {
    try {
      rag = await getRagContext({ query, documentText: text, useRag: true, topK: 5, userId });
    } catch (e) {
      console.warn('[summarize] RAG:', e.message);
    }
  }

  if (openAiConfigured() && rag.contextText) {
    try {
      const system = `You are a study assistant. Summarize the following content. Return valid JSON only with keys: summary (string), keyPoints (array of strings), definitions (array of key terms), nextSteps (array of strings). No other text.`;
      const userContent = `Content:\n${rag.contextText.slice(0, 6000)}\n\nProvide the JSON summary.`;
      const { content } = await chatCompletion({
        system,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.3,
        maxTokens: 800,
        responseFormat: { type: 'json_object' },
      });
      let parsed = {};
      try {
        parsed = JSON.parse(content || '{}');
      } catch {
        parsed = { summary: content || '', keyPoints: [], definitions: [], nextSteps: [] };
      }
      const summary = parsed.summary ?? '';
      const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      const definitions = Array.isArray(parsed.definitions) ? parsed.definitions : [];
      const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];
      const reply = [
        'Summary:',
        summary,
        '',
        'Key points:',
        ...keyPoints.map((p) => `• ${p}`),
        '',
        'Key terms:',
        definitions.length ? definitions.join(', ') : '(none)',
        '',
        'Next steps:',
        ...nextSteps.map((s) => `• ${s}`),
      ].join('\n');
      const citations = rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score }));
      return {
        reply,
        suggestions: [],
        structured: { summary, keyPoints, definitions, nextSteps },
        citations,
      };
    } catch (e) {
      console.warn('[summarize] OpenAI:', e.message);
    }
  }

  const { summary, keyPoints, definitions, nextSteps } = simpleSummarize(text);
  const reply = [
    'Summary:',
    summary,
    '',
    'Key points:',
    ...keyPoints.map((b) => `• ${b}`),
    '',
    'Key terms:',
    definitions.length ? definitions.join(', ') : '(none)',
    '',
    'Next steps:',
    ...nextSteps.map((s) => `• ${s}`),
  ].join('\n');
  return {
    reply,
    suggestions: [],
    structured: { summary, keyPoints, definitions, nextSteps },
    citations: rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score })),
  };
}
