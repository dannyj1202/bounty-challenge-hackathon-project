/**
 * /quiz — deterministic 5-question quiz from text (read-only, no AI).
 * Mix of MCQ (fill-in-the-blank) + short answer, with answer key.
 *
 * /quiz <text> | /quiz (uses last note)
 */

import { getDb } from '../../db/index.js';

const NUM_QUESTIONS = 5;
const INPUT_CAP = 12000;

const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','can','this','that','these','those',
  'it','its','as','if','so','than','when','which','who','what','where','how','i','you','we','they',
]);

function tableExists(db, name) {
  try {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  } catch {
    return false;
  }
}

function getLastNoteContent(db, userId) {
  try {
    const row = db.prepare(
      `SELECT content, title
       FROM notes
       WHERE userId = ? AND content IS NOT NULL AND content != ""
       ORDER BY createdAt DESC, id DESC
       LIMIT 1`
    ).get(userId);
    return row ? ((row.title ? `[${row.title}]\n` : '') + (row.content || '')) : '';
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

function hash32(s) {
  // simple deterministic hash
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickKeyword(sentence, allKeywords) {
  const words = tokenize(sentence).filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  // prefer a keyword that also appears elsewhere
  for (const w of words) {
    if (allKeywords.includes(w)) return w;
  }
  return words[0] || null;
}

function unique(arr) {
  return [...new Set(arr)];
}

function buildQuestions(text) {
  const t = String(text || '').trim().slice(0, INPUT_CAP);
  if (!t) return [];

  const sentences = t
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25)
    .slice(0, 20);

  const words = tokenize(t);
  const keywords = unique(
    words.filter((w) => w.length >= 5 && !STOPWORDS.has(w))
  );

  const questions = [];
  for (let i = 0; i < Math.min(NUM_QUESTIONS, sentences.length); i++) {
    const s = sentences[i];

    // alternate MCQ + short
    const wantMcq = i % 2 === 0;

    if (wantMcq) {
      const key = pickKeyword(s, keywords);
      if (!key) continue;

      const stem = s.replace(new RegExp(`\\b${key}\\b`, 'i'), '_____').trim().replace(/\s+/g, ' ');
      const distractors = keywords.filter((k) => k !== key);

      // pick 3 distractors deterministically
      const base = hash32(s + '|' + key);
      const opts = [key];
      for (let j = 0; j < distractors.length && opts.length < 4; j++) {
        const idx = (base + j * 9973) % distractors.length;
        const cand = distractors[idx];
        if (!opts.includes(cand)) opts.push(cand);
      }
      // if not enough distractors, pad with generic
      while (opts.length < 4) opts.push('none of the above');

      // shuffle options deterministically
      const correctWord = key;
      const shuffled = [...opts].sort((a, b) => {
        const ha = hash32(a), hb = hash32(b);
        if (ha !== hb) return ha - hb;
        return a.localeCompare(b);
      });
      const correctIndex = shuffled.indexOf(correctWord);

      questions.push({
        type: 'mcq',
        q: `Fill in the blank:\n"${stem}"`,
        options: shuffled.map((x) => x),
        correct: correctIndex,
        a: correctWord,
      });
    } else {
      questions.push({
        type: 'short',
        q: `Explain this in your own words:\n"${s.slice(0, 160)}${s.length > 160 ? '...' : ''}"`,
        a: s.slice(0, 220) + (s.length > 220 ? '...' : ''),
      });
    }
  }

  // Ensure we return exactly up to NUM_QUESTIONS
  return questions.slice(0, NUM_QUESTIONS);
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [] };

  const db = getDb();
  const notesOk = tableExists(db, 'notes');

  let text = String(args || '').trim();
  if (!text) {
    if (!notesOk) {
      return {
        reply: 'Usage: /quiz <text> — or add notes via the Notes page, then run /quiz with no args to use your latest note.',
        suggestions: [],
      };
    }
    text = getLastNoteContent(db, userId);
    if (!text) {
      return {
        reply: 'Usage: /quiz <text> — or add a note and run /quiz with no args to quiz from your latest note.',
        suggestions: [],
      };
    }
  }

  const questions = buildQuestions(text);
  if (questions.length === 0) {
    return {
      reply: 'Not enough content to build a quiz. Provide longer text or use /quiz <your text>.',
      suggestions: [],
    };
  }

  const lines = [];
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.q}`);
    if (q.options) {
      q.options.forEach((o, j) => lines.push(`   ${String.fromCharCode(65 + j)}) ${o}`));
    }
    lines.push('');
  });

  lines.push('--- Answer key ---');
  questions.forEach((q, i) => {
    if (q.options) lines.push(`${i + 1}. ${String.fromCharCode(65 + q.correct)}) ${q.a}`);
    else lines.push(`${i + 1}. ${q.a}`);
  });

  const reply = ['Quiz:', '', ...lines].join('\n');
  return { reply, suggestions: [] };
}
