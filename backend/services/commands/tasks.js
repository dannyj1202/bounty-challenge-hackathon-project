/**
 * /tasks — create create_task suggestions from args or from upcoming assignments.
 * Deterministic, no AI. No direct writes to tasks table.
 */

import { getDb } from '../../db/index.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 9);
}

/** Parse /tasks add "Title" due YYYY-MM-DD → { title, dueDate } or null */
function parseAddTaskArgs(args) {
  const addMatch = args.match(/\badd\s+"([^"]+)"\s+due\s+(\d{4}-\d{2}-\d{2})/i);
  if (addMatch) return { title: addMatch[1].trim(), dueDate: addMatch[2] };
  const addMatch2 = args.match(/\badd\s+"([^"]+)"/i);
  if (addMatch2) return { title: addMatch2[1].trim(), dueDate: null };
  return null;
}

export async function run({ userId, messages, context, args }) {
  const db = getDb();
  const today = todayStr();
  const inserted = [];

  const parsed = parseAddTaskArgs(args || '');

  if (parsed) {
    // 1–3 task suggestions: use user's title as first (e.g. "Read chapter 3"), then optional follow-ups
    const titles = [
      parsed.title,
      parsed.dueDate ? `Review notes for ${parsed.title}` : null,
      parsed.dueDate ? `Practice problems for ${parsed.title}` : null,
    ].filter(Boolean);
    const count = Math.min(3, Math.max(1, titles.length));
    for (let i = 0; i < count; i++) {
      const title = titles[i];
      const payload = JSON.stringify({ title, dueDate: parsed.dueDate });
      const id = 's-' + Date.now() + '-' + i + '-' + randomSuffix();
      const label = `Task: ${title}`;
      db.prepare(
        `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status, createdAt)
         VALUES (?, ?, 'create_task', ?, ?, 'pending', datetime('now'))`
      ).run(id, userId, label, payload);
      const row = db.prepare(
        'SELECT id, userId, type, label, payload, status, createdAt FROM copilot_suggestions WHERE id = ?'
      ).get(id);
      inserted.push(row);
    }
    const reply = [
      `Created ${inserted.length} task suggestion(s).`,
      '',
      'To accept: POST /api/copilot/suggestions/:id/accept with body { "userId": "<your userId>" }',
      'To reject: POST /api/copilot/suggestions/:id/reject with body { "userId": "<your userId>" }',
    ].join('\n');
    return { reply, suggestions: inserted };
  }

  // No quoted task: use upcoming assignments or generic
  const assignments = db.prepare(
    `SELECT id, title, dueDate FROM assignments
     WHERE userId = ? AND completed = 0 AND (dueDate IS NULL OR dueDate >= ?)
     ORDER BY (dueDate IS NULL), dueDate ASC
     LIMIT 5`
  ).all(userId, today);

  const toCreate = [];
  if (assignments.length > 0) {
    const templates = [
      (a) => ({ title: `Work on ${a.title}`, dueDate: a.dueDate }),
      (a) => ({ title: `Review notes for ${a.title}`, dueDate: a.dueDate }),
      (a) => ({ title: `Practice problems for ${a.title}`, dueDate: a.dueDate }),
    ];
    for (const a of assignments.slice(0, 5)) {
      for (const t of templates) toCreate.push(t(a));
    }
    toCreate.splice(5); // keep first 5 only
  } else {
    toCreate.push(
      { title: 'Review lecture notes', dueDate: null },
      { title: 'Practice 10 questions', dueDate: null },
      { title: 'Organize notes', dueDate: null },
    );
  }

  for (let i = 0; i < toCreate.length; i++) {
    const { title, dueDate } = toCreate[i];
    const payload = JSON.stringify({ title, dueDate });
    const id = 's-' + Date.now() + '-' + i + '-' + randomSuffix();
    const label = `Task: ${title}`;
    db.prepare(
      `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status, createdAt)
       VALUES (?, ?, 'create_task', ?, ?, 'pending', datetime('now'))`
    ).run(id, userId, label, payload);
    const row = db.prepare(
      'SELECT id, userId, type, label, payload, status, createdAt FROM copilot_suggestions WHERE id = ?'
    ).get(id);
    inserted.push(row);
  }

  const summary = assignments.length > 0
    ? `Suggested ${inserted.length} tasks from your upcoming assignments.`
    : `Suggested ${inserted.length} generic tasks (no upcoming assignments).`;
  const reply = [
    summary,
    '',
    'To accept: POST /api/copilot/suggestions/:id/accept with body { "userId": "<your userId>" }',
    'To reject: POST /api/copilot/suggestions/:id/reject with body { "userId": "<your userId>" }',
  ].join('\n');
  return { reply, suggestions: inserted };
}
