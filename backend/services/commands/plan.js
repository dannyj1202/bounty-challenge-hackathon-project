/**
 * /plan — create study block suggestions (create_calendar_block) spread across
 * the period from today until the furthest assignment due date. Avoids conflicts
 * with existing events. Supports spread: light | balanced | intensive.
 */

import { getDb } from '../../db/index.js';

const WORKING_START = 8;   // 08:00
const WORKING_END = 22;    // 22:00
const DEFAULT_DURATION = 60; // minutes
const LONG_BLOCK = 90;     // optional 90-min block
const MIN_PLANNING_DAYS = 7;   // at least 7 days if no assignments
const MAX_PLANNING_DAYS = 84;  // cap at 12 weeks
/** Blocks per week by spread: light=2, balanced=4, intensive=6 */
const BLOCKS_PER_WEEK = { light: 2, balanced: 4, intensive: 6 };
const DEFAULT_SPREAD = 'balanced';

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
  const spread = (context?.spread && BLOCKS_PER_WEEK[context.spread]) ? context.spread : DEFAULT_SPREAD;
  const blocksPerWeek = BLOCKS_PER_WEEK[spread];

  // Upcoming assignments (incomplete, due >= today; due-soon first)
  const assignments = db.prepare(
    `SELECT id, title, dueDate FROM assignments
     WHERE userId = ? AND completed = 0 AND (dueDate IS NULL OR dueDate >= ?)
     ORDER BY (dueDate IS NULL), dueDate ASC
     LIMIT 20`
  ).all(userId, today);

  // Planning window: from today until furthest due date (or MIN_PLANNING_DAYS), capped at MAX_PLANNING_DAYS
  let planningDays = MIN_PLANNING_DAYS;
  if (assignments.length > 0) {
    const withDue = assignments.filter((a) => a.dueDate);
    if (withDue.length > 0) {
      const furthestDue = withDue[withDue.length - 1].dueDate;
      const dueDate = new Date(furthestDue + 'T23:59:59');
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      planningDays = Math.min(MAX_PLANNING_DAYS, Math.max(MIN_PLANNING_DAYS, daysUntilDue));
    }
  }
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + planningDays);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Events that overlap the planning window
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

  for (let d = 0; d < planningDays; d++) {
    const dayStart = new Date(base);
    dayStart.setDate(dayStart.getDate() + d);
    for (let h = WORKING_START; h < WORKING_END; h++) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(h, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + DEFAULT_DURATION * 60 * 1000);
      const s = slotStart.getTime();
      const e = slotEnd.getTime();
      if (e <= nowTs) continue;
      const conflict = busy.some((b) => overlaps(s, e, b.start, b.end));
      if (!conflict) slots.push({ start: slotStart, end: slotEnd, duration: DEFAULT_DURATION });
    }
  }

  // Target: spread blocks evenly across the period (blocksPerWeek * weeks)
  const weeks = Math.max(1, Math.ceil(planningDays / 7));
  const targetBlocks = Math.min(blocksPerWeek * weeks, 30); // cap total blocks at 30

  // Prefer one block per day when possible: group slots by day, then pick slots spread across days
  const slotsByDay = new Map();
  for (const slot of slots) {
    const dayKey = slot.start.toISOString().slice(0, 10);
    if (!slotsByDay.has(dayKey)) slotsByDay.set(dayKey, []);
    slotsByDay.get(dayKey).push(slot);
  }
  const sortedDays = [...slotsByDay.keys()].sort();
  const chosen = [];
  const used = new Set();
  // Spread: pick one slot per day in round-robin across days until we have targetBlocks
  let dayIndex = 0;
  while (chosen.length < targetBlocks && sortedDays.length > 0) {
    const dayKey = sortedDays[dayIndex % sortedDays.length];
    const daySlots = slotsByDay.get(dayKey) || [];
    const slot = daySlots.find((sl) => {
      const key = sl.start.getTime();
      if (used.has(key)) return false;
      const conflict = chosen.some((c) => overlaps(c.start.getTime(), c.end.getTime(), sl.start.getTime(), sl.end.getTime()));
      return !conflict;
    });
    if (slot) {
      chosen.push(slot);
      used.add(slot.start.getTime());
    }
    dayIndex++;
    if (dayIndex > sortedDays.length * 2 && chosen.length < targetBlocks) break; // avoid infinite loop
  }
  // If we didn't get enough by one-per-day, fill from remaining slots in time order
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const slot of slots) {
    if (chosen.length >= targetBlocks) break;
    if (used.has(slot.start.getTime())) continue;
    const conflict = chosen.some((c) => overlaps(c.start.getTime(), c.end.getTime(), slot.start.getTime(), slot.end.getTime()));
    if (!conflict) {
      chosen.push(slot);
      used.add(slot.start.getTime());
    }
  }
  chosen.sort((a, b) => a.start.getTime() - b.start.getTime());

  const minBlocks = spread === 'light' ? 2 : 4;
  if (chosen.length < minBlocks) {
    return {
      reply: `Not enough free study slots in the next ${planningDays} days (08:00–22:00). Your calendar is busy. Try "Light" spread or free some time.`,
      suggestions: [],
    };
  }

  // Topic per block: cycle through assignments so blocks are spread by assignment
  const topicList = assignments.length > 0
    ? assignments.map((a) => a.title)
    : ['General review'];
  const inserted = [];

  for (let i = 0; i < chosen.length; i++) {
    const slot = chosen[i];
    const topic = topicList[i % topicList.length];
    const title = chosen.length === 1 ? `Study: ${topic}` : `Study: ${topic} (block ${i + 1})`;
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
  const reply = `Suggested ${inserted.length} study blocks spread over the next ${planningDays} days (until your furthest assignment) with "${spread}" pacing. No overlap with your events. Accept in the UI to add them to your calendar.`;
  return { reply, suggestions: inserted, structured: { blocks, spread, planningDays }, citations: [] };
}
