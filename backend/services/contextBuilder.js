/**
 * Minimal user context for Copilot: next 7 days assignments/events, top 5 tasks, last 2 notes.
 * Capped tokens; cached in-memory per userId for 30–60s.
 */

import { getDb } from '../db/index.js';

const CACHE_TTL_MS = 45 * 1000; // 45 seconds
const MAX_NOTE_CHARS = 800;
const cache = new Map(); // userId -> { context, ts }

function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max) + '…';
}

export function buildContext(userId) {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.context;

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const endStr = endDate.toISOString().slice(0, 10);

  let assignments = [];
  let events = [];
  let tasks = [];
  let notes = [];

  try {
    assignments = db.prepare(
      `SELECT id, title, dueDate FROM assignments
       WHERE userId = ? AND completed = 0 AND (dueDate IS NULL OR dueDate >= ?)
       ORDER BY (dueDate IS NULL), dueDate ASC LIMIT 7`
    ).all(userId, today);

    events = db.prepare(
      `SELECT id, title, startAt, endAt FROM events
       WHERE userId = ? AND startAt >= ? AND startAt <= ?
       ORDER BY startAt ASC LIMIT 15`
    ).all(userId, today + 'T00:00:00', endStr + 'T23:59:59');

    const taskRows = db.prepare(
      `SELECT id, title, dueDate FROM tasks WHERE userId = ? AND completed = 0 ORDER BY dueDate IS NULL, dueDate ASC LIMIT 5`
    ).all(userId);
    tasks = taskRows;

    const noteRows = db.prepare(
      `SELECT id, title, content FROM notes WHERE userId = ? ORDER BY createdAt DESC LIMIT 2`
    ).all(userId);
    notes = noteRows.map((n) => ({
      id: n.id,
      title: n.title,
      content: truncate(n.content || '', MAX_NOTE_CHARS),
    }));
  } catch (e) {
    console.warn('[contextBuilder]', e.message);
  }

  const context = {
    assignments: assignments.map((a) => ({ id: a.id, title: a.title, dueDate: a.dueDate })),
    events: events.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, endAt: e.endAt })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
    notes,
  };

  cache.set(userId, { context, ts: now });
  return context;
}

export function contextSummaryForPrompt(context) {
  const parts = [];
  if (context.assignments?.length) {
    parts.push('Assignments (next 7 days): ' + context.assignments.map((a) => `${a.title}${a.dueDate ? ` (due ${a.dueDate})` : ''}`).join('; '));
  }
  if (context.events?.length) {
    parts.push('Events: ' + context.events.map((e) => `${e.title} ${e.startAt}`).join('; '));
  }
  if (context.tasks?.length) {
    parts.push('Tasks: ' + context.tasks.map((t) => t.title).join('; '));
  }
  if (context.notes?.length) {
    parts.push('Recent notes: ' + context.notes.map((n) => (n.title || 'Note') + ': ' + (n.content || '').slice(0, 120)).join(' | '));
  }
  return parts.join('\n') || 'No assignments, events, or notes.';
}
