/**
 * /flashcards — cards[{q,a}], citations[].
 * Uses RAG when useRag; GPT-4o when configured; else deterministic fallback.
 */

import { getDb } from '../../db/index.js';
import { getRagContext } from '../ragService.js';
import { chatCompletion, isConfigured as openAiConfigured } from '../azureOpenAIClient.js';

const MAX_CARDS = 6;
const DOCUMENT_CAP = 30000;

function getLastNoteContent(db, userId) {
  try {
    const row = db.prepare(
      'SELECT content, title FROM notes WHERE userId = ? AND (content IS NOT NULL AND content != "") ORDER BY createdAt DESC, id DESC LIMIT 1'
    ).get(userId);
    return row ? ((row.title ? `[${row.title}]\n` : '') + (row.content || '')) : '';
  } catch {
    return '';
  }
}

function buildCardsFallback(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const byPunct = t.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
  const seen = new Set();
  const chunks = [];
  for (const x of byPunct) {
    if (!seen.has(x)) { seen.add(x); chunks.push(x); }
  }
  const cards = [];
  const maxA = 220;
  for (let i = 0; i < Math.min(MAX_CARDS, chunks.length); i++) {
    const s = chunks[i];
    const q = s.length > 80 ? `What is the main idea of: "${s.slice(0, 77)}..."?` : `What does this mean: "${s}"?`;
    const a = s.length > maxA ? s.slice(0, maxA) + '...' : s;
    cards.push({ q, a });
  }
  return cards.slice(0, MAX_CARDS);
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [], citations: [] };

  const db = getDb();
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get();
  let text = (context?.documentText != null && context.documentText !== '')
    ? String(context.documentText).trim().slice(0, DOCUMENT_CAP)
    : (args || '').trim();
  if (!text && tableExists) text = getLastNoteContent(db, userId);
  if (!text) {
    return {
      reply: 'Usage: /flashcards <text> — or add a note/upload a doc and run /flashcards.',
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
      console.warn('[flashcards] RAG:', e.message);
    }
  }

  if (openAiConfigured() && rag.contextText) {
    try {
      const system = `You are a study assistant. Generate up to ${MAX_CARDS} flashcards from the content. Return valid JSON only with key "cards" (array of objects with "q" and "a" strings). No other text.`;
      const userContent = `Content:\n${rag.contextText.slice(0, 6000)}\n\nProvide the JSON with cards array.`;
      const { content } = await chatCompletion({
        system,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.4,
        maxTokens: 600,
        responseFormat: { type: 'json_object' },
      });
      let parsed = { cards: [] };
      try {
        parsed = JSON.parse(content || '{}');
      } catch {}
      const cards = Array.isArray(parsed.cards) ? parsed.cards.slice(0, MAX_CARDS) : [];
      const valid = cards.filter((c) => c && typeof c.q === 'string' && typeof c.a === 'string');
      const reply = valid.flatMap((c, i) => [`Q${i + 1}: ${c.q}`, `A${i + 1}: ${c.a}`]).join('\n\n');
      const citations = rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score }));
      return {
        reply: reply || 'No flashcards generated. Try longer content.',
        suggestions: [],
        structured: { cards: valid },
        citations,
      };
    } catch (e) {
      console.warn('[flashcards] OpenAI:', e.message);
    }
  }

  const cards = buildCardsFallback(text);
  if (cards.length === 0) {
    return {
      reply: 'Not enough content to build flashcards. Provide longer text or upload a doc.',
      suggestions: [],
      structured: { cards: [] },
      citations: [],
    };
  }
  const reply = cards.flatMap((c, i) => [`Q${i + 1}: ${c.q}`, `A${i + 1}: ${c.a}`]).join('\n\n');
  return {
    reply,
    suggestions: [],
    structured: { cards },
    citations: rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score })),
  };
}
