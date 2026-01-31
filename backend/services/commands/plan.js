/**
 * /plan — create 2–5 pending study block suggestions (create_calendar_block)
 * that avoid conflicts with existing events. Deterministic, no AI.
 */

import { getDb } from '../../db/index.js';

const WORKING_START = 8;   // 08:00
const WORKING_END = 22;    // 22:00
const DEFAULT_DURATION = 60; // minutes
const LONG_BLOCK = 90;     // optional 90-min block
const PLANNING_DAYS = 7;
const MIN_BLOCKS = 2;
const MAX_BLOCKS = 5;

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toSqliteDatetime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/** Parse "YYYY-MM-DD HH:MM:SS" as local time (avoids timezone surprises). */
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

export async function run({ userId, messages, context, args }) {
  const db = getDb();
  const now = new Date();
  const today = todayStr();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + PLANNING_DAYS);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Upcoming assignments (incomplete, due >= today; due-soon first)
  const assignments = db.prepare(
    `SELECT id, title, dueDate FROM assignments
     WHERE userId = ? AND completed = 0 AND (dueDate IS NULL OR dueDate >= ?)
     ORDER BY (dueDate IS NULL), dueDate ASC
     LIMIT 10`
  ).all(userId, today);

  // Events that overlap the planning window (any overlap, not only fully inside)
  const windowStart = today + ' 00:00:00';
  const windowEnd = endDateStr + ' 23:59:59';
  const events = db.prepare(
    `SELECT id, title, startAt, endAt FROM events
     WHERE userId = ?
       AND NOT (endAt <= ? OR startAt >= ?)
     ORDER BY startAt ASC`
  ).all(userId, windowStart, windowEnd);

  const busy = events.map(parseEventInterval);
  const nowTs = now.getTime();

  // Candidate slots: each day 08:00–22:00 (local), 60-min slots; skip overlapping and past
  const slots = [];
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  for (let d = 0; d < PLANNING_DAYS; d++) {
    const dayStart = new Date(base);
    dayStart.setDate(dayStart.getDate() + d);
    for (let h = WORKING_START; h < WORKING_END; h++) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(h, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + DEFAULT_DURATION * 60 * 1000);
      const s = slotStart.getTime();
      const e = slotEnd.getTime();
      if (e <= nowTs) continue; // skip slots that already ended
      const conflict = busy.some((b) => overlaps(s, e, b.start, b.end));
      if (!conflict) slots.push({ start: slotStart, end: slotEnd, duration: DEFAULT_DURATION });
    }
  }

  // Sort by start time and take first 2–5 non-overlapping (60-min slots; no overlap with busy)
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  const chosen = [];
  let lastEnd = 0;
  for (const slot of slots) {
    if (chosen.length >= MAX_BLOCKS) break;
    if (slot.start.getTime() >= lastEnd) {
      chosen.push(slot);
      lastEnd = slot.end.getTime();
    }
  }
  // Optionally add one 90-min block if we have room (first free 90-min window)
  if (chosen.length >= MIN_BLOCKS && chosen.length < MAX_BLOCKS) {
    for (let d = 0; d < PLANNING_DAYS; d++) {
      const dayStart = new Date(base);
      dayStart.setDate(dayStart.getDate() + d);
      for (let h = WORKING_START; h <= WORKING_END - 2; h++) {
        const slotStart = new Date(dayStart);
        slotStart.setHours(h, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + LONG_BLOCK * 60 * 1000);
        const s = slotStart.getTime();
        const e = slotEnd.getTime();
        if (e <= nowTs) continue; // skip past
        const busyConflict = busy.some((b) => overlaps(s, e, b.start, b.end));
        const chosenConflict = chosen.some((c) => overlaps(s, e, c.start.getTime(), c.end.getTime()));
        if (!busyConflict && !chosenConflict) {
          chosen.push({ start: slotStart, end: slotEnd, duration: LONG_BLOCK });
          break;
        }
      }
      if (chosen.some((c) => c.duration === LONG_BLOCK)) break;
    }
  }

  if (chosen.length < MIN_BLOCKS) {
    return {
      reply: 'No available study slots in the next 7 days (08:00–22:00). Your calendar is full or the window is too short. Try freeing some time or use a different period.',
      suggestions: [],
    };
  }

  const firstTitle = assignments.length > 0 ? assignments[0].title : 'General review';
  const topic = args.trim() || firstTitle;
  const inserted = [];

  for (let i = 0; i < chosen.length; i++) {
    const slot = chosen[i];
    const title = i === 0 && topic ? `Study: ${topic}` : `Study: ${topic} (block ${i + 1})`;
    const startStr = toSqliteDatetime(slot.start);
    const endStr = toSqliteDatetime(slot.end);
    const payload = JSON.stringify({ title, start: startStr, end: endStr });
    const id = 's-' + Date.now() + '-' + i + '-' + randomSuffix();
    const label = `Study block ${i + 1}: ${slot.duration} min — ${topic}`;

    db.prepare(
      `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status, createdAt)
       VALUES (?, ?, 'create_calendar_block', ?, ?, 'pending', datetime('now'))`
    ).run(id, userId, label, payload);

    const row = db.prepare(
      'SELECT id, userId, type, label, payload, status, createdAt FROM copilot_suggestions WHERE id = ?'
    ).get(id);
    inserted.push(row);
  }

  const blocks = inserted.map((s) => {
    let p = {};
    try {
      p = s.payload ? JSON.parse(s.payload) : {};
    } catch {}
    return { title: p.title, start: p.start, end: p.end };
  });
  const reply = [
    `Suggested ${inserted.length} study block(s) for the next 7 days (no overlap with your events). Use Accept in the UI to add them.`,
  ].join('\n');
  return { reply, suggestions: inserted, structured: { blocks }, citations: [] };
}
