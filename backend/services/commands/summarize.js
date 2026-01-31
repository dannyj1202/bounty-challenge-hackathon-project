/**
 * /summarize — deterministic bullet summary, key terms, next steps. Read-only, no AI.
 * /summarize <text> | /summarize (uses last 1–3 notes)
 */

import { getDb } from '../../db/index.js';

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

const INPUT_CAP = 12000;

function simpleSummarize(text) {
  const t = String(text || '').trim().slice(0, INPUT_CAP);
  if (!t) return { bullets: [], terms: [], nextSteps: [] };
  const sentences = t
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^\[[^\]]+\]$/.test(s))
    .slice(0, 15);
  const bullets = sentences.slice(0, 5).map((s) => (s.length > 120 ? s.slice(0, 117) + '...' : s));
  const words = tokenize(t);
  const freq = {};
  words.forEach((w) => {
    if (w.length > 2 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  const terms = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
  const nextSteps = [
    'Review the key terms above and test yourself.',
    'Connect this material to something you already know.',
    'Practice explaining one bullet in your own words.',
  ];
  return { bullets, terms, nextSteps };
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [] };

  const db = getDb();
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
  ).get();

  let text = (args || '').trim();
  if (!text) {
    if (!tableExists) {
      return {
        reply: 'Usage: /summarize <text> — or add notes and run /summarize with no args to summarize your latest notes.',
        suggestions: [],
      };
    }
    text = getLastNotesContent(db, userId);
    if (!text) {
      return {
        reply: 'Usage: /summarize <text> — or add notes and run /summarize with no args to summarize your latest notes.',
        suggestions: [],
      };
    }
  }
  const { bullets, terms, nextSteps } = simpleSummarize(text);
  const reply = [
    'Summary (key points):',
    ...(bullets.length ? bullets.map((b) => `• ${b}`) : ['(none extracted)']),
    '',
    'Key terms:',
    terms.length ? terms.join(', ') : '(none)',
    '',
    'Next steps:',
    ...nextSteps.map((s) => `• ${s}`),
  ].join('\n');
  return { reply, suggestions: [] };
}
