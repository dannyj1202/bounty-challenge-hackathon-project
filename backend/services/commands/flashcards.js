/**
 * /flashcards — deterministic Q/A from text (read-only, no AI). Max 6 cards.
 * /flashcards <text> | /flashcards (uses last note)
 */

import { getDb } from '../../db/index.js';

const MAX_CARDS = 6;

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

function buildCards(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const byPunct = t.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
  const byNewline = t.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 15);
  const seen = new Set();
  const chunks = [];
  for (const x of byPunct) {
    if (!seen.has(x)) { seen.add(x); chunks.push(x); }
  }
  for (const x of byNewline) {
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
  if (cards.length < 2 && t.length > 50) {
    const parts = t.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < Math.min(MAX_CARDS - cards.length, parts.length); i++) {
      if (parts[i].length > 20) cards.push({ q: `Summarize: "${parts[i].slice(0, 60)}..."`, a: parts[i].length > maxA ? parts[i].slice(0, maxA) + '...' : parts[i] });
    }
  }
  return cards.slice(0, MAX_CARDS);
}

const DOCUMENT_CAP = 30000;

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [] };

  const db = getDb();
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
  ).get();
  if (!tableExists) {
    return {
      reply: 'Usage: /flashcards <text> — or add notes via the Notes page, then run /flashcards with no args to use your latest note.',
      suggestions: [],
    };
  }
  let text = (context?.documentText != null && context.documentText !== '')
    ? String(context.documentText).trim().slice(0, DOCUMENT_CAP)
    : (args || '').trim();
  if (!text) {
    text = getLastNoteContent(db, userId);
    if (!text) {
      return {
        reply: 'Usage: /flashcards <text> — or add a note and run /flashcards with no args to use your latest note.',
        suggestions: [],
      };
    }
  }
  const cards = buildCards(text);
  if (cards.length === 0) {
    return {
      reply: 'Not enough content to build flashcards. Provide longer text or use /flashcards <your text>.',
      suggestions: [],
    };
  }
  const lines = cards.flatMap((c, i) => [`Q${i + 1}: ${c.q}`, `A${i + 1}: ${c.a}`]);
  const reply = ['Flashcards:', '', ...lines].join('\n');
  return { reply, suggestions: [] };
}
