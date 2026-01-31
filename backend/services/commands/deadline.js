/**
 * /deadline — create milestone create_task suggestions leading up to a due date.
 * Deterministic, no AI. No direct writes to tasks table.
 */

import { getDb } from '../../db/index.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 9);
}

/** Parse YYYY-MM-DD from args if present */
function parseDateFromArgs(args) {
  const match = (args || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function run({ userId, messages, context, args }) {
  const db = getDb();
  const today = todayStr();
  let deadlineStr = parseDateFromArgs(args || '');

  let assignmentTitle = null;
  if (!deadlineStr) {
    const row = db.prepare(
      `SELECT title, dueDate FROM assignments
       WHERE userId = ? AND completed = 0 AND dueDate IS NOT NULL AND dueDate >= ?
       ORDER BY dueDate ASC LIMIT 1`
    ).get(userId, today);
    if (!row) {
      return {
        reply: 'No upcoming assignment with a due date found. Specify a date, e.g. /deadline 2026-02-15, or add an assignment with a due date.',
        suggestions: [],
      };
    }
    deadlineStr = row.dueDate;
    assignmentTitle = row.title || null;
  }

  if (deadlineStr < today) {
    return {
      reply: `The date ${deadlineStr} is in the past. Use a future date or add an assignment with a due date.`,
      suggestions: [],
    };
  }

  const deadline = new Date(deadlineStr + 'T12:00:00');
  const todayDate = new Date(today + 'T12:00:00');
  const daysAway = Math.max(0, Math.ceil((deadline - todayDate) / (24 * 60 * 60 * 1000)));

  const milestones = [
    'Outline / plan',
    'Draft / first pass',
    'Revise / polish',
    'Final review / submission check',
  ];

  let dueDates = [];
  if (daysAway <= 2) {
    if (daysAway === 0) {
      dueDates = [deadlineStr];
    } else if (daysAway === 1) {
      dueDates = [today, deadlineStr];
    } else {
      dueDates = [addDays(today, 1), deadlineStr];
    }
  } else {
    const n = Math.min(4, daysAway);
    dueDates = [];
    for (let i = 1; i <= n; i++) {
      const dayOffset = Math.round((daysAway * i) / (n + 1)) - 1;
      dueDates.push(addDays(today, Math.max(0, dayOffset)));
    }
    dueDates.push(addDays(today, daysAway - 1));
    dueDates = [...new Set(dueDates)].sort().slice(-5);
  }

  const count = Math.min(5, Math.max(3, dueDates.length), milestones.length);
  const inserted = [];

  for (let i = 0; i < count; i++) {
    const title = `Milestone: ${milestones[i]}`;
    const dueDate = dueDates[i] || deadlineStr;
    const payload = JSON.stringify({ title, dueDate });
    const id = 's-' + Date.now() + '-' + i + '-' + randomSuffix();
    const label = assignmentTitle
      ? `Deadline milestone: ${title} (${assignmentTitle})`
      : `Deadline milestone: ${title}`;
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
    `Created ${inserted.length} milestone task(s) leading to ${deadlineStr}.`,
    '',
    'To accept: POST /api/copilot/suggestions/:id/accept with body { "userId": "<your userId>" }',
    'To reject: POST /api/copilot/suggestions/:id/reject with body { "userId": "<your userId>" }',
  ].join('\n');
  return { reply, suggestions: inserted };
}
