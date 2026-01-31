/**
 * /reschedule — suggest alternative create_calendar_block options (no direct event writes).
 * With args: window e.g. 2026-02-01 14:00-16:00. Empty: next "Study:" event alternatives.
 */

import { getDb } from '../../db/index.js';

const WORKING_START = 8;
const WORKING_END = 22;
const SLOT_MINS = 60;
const PLANNING_DAYS = 7;
const MAX_SUGGESTIONS = 5;
const MIN_SUGGESTIONS = 2;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toSqliteDatetime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function parseSqliteDatetimeLocal(s) {
  const [datePart, timePart] = String(s).trim().split(' ');
  const [y, m, d] = (datePart || '').split('-').map(Number);
  const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}

function parseEventInterval(event) {
  const start = parseSqliteDatetimeLocal(event.startAt);
  const end = parseSqliteDatetimeLocal(event.endAt);
  return { start: start.getTime(), end: end.getTime() };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 9);
}

/** Parse /reschedule 2026-02-01 14:00-16:00 → { date, startH, startM, endH, endM } or null */
function parseWindowArgs(args) {
  const s = (args || '').trim();
  const match = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?$/);
  if (match) {
    const [, date, sh, sm, eh, em] = match;
    return {
      date,
      startH: parseInt(sh, 10),
      startM: parseInt(sm || '0', 10),
      endH: parseInt(eh, 10),
      endM: parseInt(em || '0', 10),
    };
  }
  return null;
}

export async function run({ userId, messages, context, args }) {
  const db = getDb();
  const now = new Date();
  const nowTs = now.getTime();
  const today = todayStr();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + PLANNING_DAYS);
  const endDateStr = endDate.toISOString().slice(0, 10);
  const windowStart = today + ' 00:00:00';
  const windowEnd = endDateStr + ' 23:59:59';

  const events = db.prepare(
    `SELECT id, title, startAt, endAt FROM events
     WHERE userId = ? AND NOT (endAt <= ? OR startAt >= ?)
     ORDER BY startAt ASC`
  ).all(userId, windowStart, windowEnd);
  const busy = events.map(parseEventInterval);

  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const slots = [];
  for (let d = 0; d < PLANNING_DAYS; d++) {
    const dayStart = new Date(base);
    dayStart.setDate(dayStart.getDate() + d);
    for (let h = WORKING_START; h < WORKING_END; h++) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(h, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINS * 60 * 1000);
      const s = slotStart.getTime();
      const e = slotEnd.getTime();
      if (s < nowTs) continue; // skip slots that have already started
      if (!busy.some((b) => overlaps(s, e, b.start, b.end))) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
  }
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());

  let titleBase = 'Study: rescheduled block';
  let excludeStart = null;
  let excludeEnd = null;
  let slotsInWindow = []; // when windowArg: 60-min slots within the given window on that date

  const windowArg = parseWindowArgs(args || '');

  if (windowArg) {
    titleBase = `Study: ${windowArg.date} ${windowArg.startH}:${String(windowArg.startM).padStart(2, '0')}-${windowArg.endH}:${String(windowArg.endM).padStart(2, '0')}`;
    const [y, m, d] = windowArg.date.split('-').map(Number);
    const originalStart = new Date(y, m - 1, d, windowArg.startH, windowArg.startM, 0, 0);
    const originalEnd = new Date(y, m - 1, d, windowArg.endH, windowArg.endM, 0, 0);
    excludeStart = originalStart.getTime();
    excludeEnd = originalEnd.getTime();
    // Propose alternatives within the given window on that date (60-min slots)
    for (let h = windowArg.startH; h < windowArg.endH; h++) {
      const slotStart = new Date(y, m - 1, d, h, h === windowArg.startH ? windowArg.startM : 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINS * 60 * 1000);
      if (slotEnd.getTime() > excludeEnd) break;
      const s = slotStart.getTime();
      const e = slotEnd.getTime();
      if (s < nowTs) continue;
      if (!busy.some((b) => overlaps(s, e, b.start, b.end))) {
        slotsInWindow.push({ start: slotStart, end: slotEnd });
      }
    }
  } else {
    const studyEvent = db.prepare(
      `SELECT id, title, startAt, endAt FROM events
       WHERE userId = ? AND (title LIKE 'Study:%' OR (type = 'personal' AND sourceId IS NOT NULL))
         AND startAt >= ?
       ORDER BY startAt ASC LIMIT 1`
    ).get(userId, today + ' 00:00:00');
    if (studyEvent) {
      titleBase = studyEvent.title || 'Study: block';
      const ival = parseEventInterval(studyEvent);
      excludeStart = ival.start;
      excludeEnd = ival.end;
    } else {
      return {
        reply: 'No upcoming Study event found. Provide a window like /reschedule 2026-02-01 14:00-16:00',
        suggestions: [],
      };
    }
  }

  const chosen = [];
  let lastEnd = 0;
  // When windowArg: prefer slots within the window first
  for (const slot of slotsInWindow) {
    if (chosen.length >= MAX_SUGGESTIONS) break;
    const s = slot.start.getTime();
    const e = slot.end.getTime();
    if (s < lastEnd) continue;
    chosen.push(slot);
    lastEnd = e;
  }
  // Then global slots (or only global when no windowArg), excluding the original window when set
  for (const slot of slots) {
    if (chosen.length >= MAX_SUGGESTIONS) break;
    const s = slot.start.getTime();
    const e = slot.end.getTime();
    if (s < lastEnd) continue;
    if (excludeStart != null && excludeEnd != null && overlaps(s, e, excludeStart, excludeEnd)) continue;
    chosen.push(slot);
    lastEnd = e;
  }

  if (chosen.length < MIN_SUGGESTIONS) {
    return {
      reply: [
        'Not enough free 60-min slots in the next 7 days to suggest alternatives. Try freeing time or a different window.',
        '',
        'To accept a suggestion: POST /api/copilot/suggestions/:id/accept with body { "userId": "<your userId>" }',
        'To reject: POST /api/copilot/suggestions/:id/reject with body { "userId": "<your userId>" }',
      ].join('\n'),
      suggestions: [],
    };
  }

  const inserted = [];
  for (let i = 0; i < chosen.length; i++) {
    const slot = chosen[i];
    const title = i === 0 ? titleBase : `${titleBase} (option ${i + 1})`;
    const startStr = toSqliteDatetime(slot.start);
    const endStr = toSqliteDatetime(slot.end);
    const payload = JSON.stringify({ title, start: startStr, end: endStr });
    const id = 's-' + Date.now() + '-' + i + '-' + randomSuffix();
    const label = `Reschedule: Study block option ${i + 1}`;
    db.prepare(
      `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status, createdAt)
       VALUES (?, ?, 'create_calendar_block', ?, ?, 'pending', datetime('now'))`
    ).run(id, userId, label, payload);
    const row = db.prepare(
      'SELECT id, userId, type, label, payload, status, createdAt FROM copilot_suggestions WHERE id = ?'
    ).get(id);
    inserted.push(row);
  }

  const reply = [
    `Suggested ${inserted.length} alternative study block(s). Original event is unchanged.`,
    '',
    'To accept: POST /api/copilot/suggestions/:id/accept with body { "userId": "<your userId>" }',
    'To reject: POST /api/copilot/suggestions/:id/reject with body { "userId": "<your userId>" }',
  ].join('\n');
  return { reply, suggestions: inserted };
}
