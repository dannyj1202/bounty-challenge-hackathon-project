/**
 * /notes — list and show notes (read-only). No DB writes.
 * /notes | /notes show <n> | /notes search <keyword>
 */

import { getDb } from '../../db/index.js';

const LIST_LIMIT = 5;
const SNIPPET_LEN = 80;

function getLastNotes(db, userId, limit = LIST_LIMIT) {
  try {
    return db.prepare(
      'SELECT id, title, content, createdAt FROM notes WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ?'
    ).all(userId, limit);
  } catch (e) {
    if (e && e.message) console.warn('notes getLastNotes:', e.message);
    return [];
  }
}

function getNoteById(db, id, userId) {
  try {
    return db.prepare(
      'SELECT id, title, content, createdAt FROM notes WHERE id = ? AND userId = ?'
    ).get(id, userId);
  } catch {
    return null;
  }
}

function searchNotes(db, userId, keyword, limit = LIST_LIMIT) {
  try {
    const like = '%' + keyword
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_') + '%';
    return db.prepare(
      `SELECT id, title, content, createdAt FROM notes
       WHERE userId = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
       ORDER BY createdAt DESC, id DESC LIMIT ?`
    ).all(userId, like, like, limit);
  } catch (e) {
    if (e && e.message) console.warn('notes searchNotes:', e.message);
    return [];
  }
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [] };

  const db = getDb();
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
  ).get();
  if (!tableExists) {
    return {
      reply: 'Notes are not set up yet. Add notes via the Notes page, then use /notes here.',
      suggestions: [],
    };
  }

  const arg = (args || '').trim();
  const showMatch = arg.match(/^show\s+(\d+)$/i);
  const searchMatch = arg.match(/^search\s+(.+)$/i);

  if (showMatch) {
    let n = parseInt(showMatch[1], 10);
    if (!Number.isFinite(n) || n < 1) {
      return { reply: 'Usage: /notes show <number> (1-based, from latest list).', suggestions: [] };
    }
    if (n > 50) n = 50; // prevent abuse

    let note = null;
    try {
      note = db.prepare(
        `SELECT id, title, content, createdAt
         FROM notes
         WHERE userId = ?
         ORDER BY createdAt DESC, id DESC
         LIMIT 1 OFFSET ?`
      ).get(userId, n - 1);
    } catch (e) {
      if (e && e.message) console.warn('notes show:', e.message);
      note = null;
    }

    if (!note) {
      return {
        reply: `You have fewer than ${n} note(s). Use /notes to list your latest notes.`,
        suggestions: [],
      };
    }

    const rawContent = String(note.content || '');
    const content = rawContent.slice(0, 3000);
    const totalLen = rawContent.length;
    const reply = [
      `Note ${n}: ${note.title || '(no title)'}`,
      `Created: ${note.createdAt || ''}`,
      `Id: ${note.id}`,
      totalLen > 0 ? `Length: ${totalLen} chars${totalLen > 3000 ? ' (showing first 3000)' : ''}` : '',
      '',
      content || '(empty)',
    ].filter(Boolean).join('\n');

    return { reply, suggestions: [] };
  }

  if (searchMatch) {
    const keyword = String(searchMatch[1] || '').trim();
    if (!keyword) {
      return { reply: 'Usage: /notes search <keyword>', suggestions: [] };
    }
    const list = searchNotes(db, userId, keyword);
    if (list.length === 0) {
      return {
        reply: `No notes found matching "${keyword}". Try /notes to list your latest notes.`,
        suggestions: [],
      };
    }
    const lines = list.map((n, i) => {
      const snippet = (n.content || n.title || '').slice(0, SNIPPET_LEN).replace(/\n/g, ' ');
      return `${i + 1}. ${n.title || '(no title)'} — ${n.createdAt || ''}\n   ${snippet}${(n.content && n.content.length > SNIPPET_LEN) ? '...' : ''}`;
    });
    const reply = ['Matching notes:', '', ...lines].join('\n');
    return { reply, suggestions: [] };
  }

  // /notes — list last 5
  const list = getLastNotes(db, userId);
  if (list.length === 0) {
    return {
      reply: 'No notes found. Add notes on the Notes page, then use /notes here to list them.',
      suggestions: [],
    };
  }
  const lines = list.map((n, i) => {
    const snippet = (n.content || n.title || '').slice(0, SNIPPET_LEN).replace(/\n/g, ' ');
    return `${i + 1}. ${n.title || '(no title)'} — ${n.createdAt || ''}\n   ${snippet}${(n.content && n.content.length > SNIPPET_LEN) ? '...' : ''}`;
  });
  const reply = [
    'Your latest notes (use /notes show <n> to open one):',
    '',
    ...lines,
  ].join('\n');
  return { reply, suggestions: [] };
}
