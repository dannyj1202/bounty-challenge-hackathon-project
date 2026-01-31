/**
 * Repeatable demo seed: u-demo user, assignments, events, one Study event.
 * Run: cd backend && node scripts/demo-seed.js
 *
 * Demo flow (backend and server must be running):
 *
 * 0) Seed the demo state
 *    cd backend && node scripts/demo-seed.js
 *
 * 1) Show /plan generating study blocks (avoids busy events)
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo","messages":[{"role":"user","content":"/plan math exam"}]}' | jq
 *
 * 2) List pending suggestions (frontend can do this)
 *    curl -s "http://localhost:3001/api/copilot/suggestions?userId=u-demo&status=pending&limit=50" | jq
 *
 * 3) Accept one study block (creates event)
 *    SUGGESTION_ID="s-..."   # paste from list
 *    curl -s -X POST "http://localhost:3001/api/copilot/suggestions/${SUGGESTION_ID}/accept" \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo"}' | jq
 *
 * 4) Show /reschedule suggesting alternatives for the existing Study event
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo","messages":[{"role":"user","content":"/reschedule"}]}' | jq
 *
 * 5) Show /deadline milestone breakdown
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo","messages":[{"role":"user","content":"/deadline"}]}' | jq
 *
 * 6) Show /tasks add ... quick task creation
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo","messages":[{"role":"user","content":"/tasks add \"Read chapter 3\" due 2026-02-02"}]}' | jq
 *
 * Phase 3 (after seeding):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-demo","messages":[{"role":"user","content":"/notes"}]}' | jq
 *    curl -s -X POST ... "/summarize" | jq
 *    curl -s -X POST ... "/flashcards" | jq
 *    curl -s -X POST ... "/quiz" | jq
 */

import { getDb } from '../db/index.js';

const DEMO_USER_ID = 'u-demo';

function run() {
  const db = getDb();

  // Ensure demo user
  const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(DEMO_USER_ID);
  if (existingUser) {
    db.prepare('UPDATE users SET email = ?, displayName = ? WHERE id = ?').run('demo@local', 'Demo Student', DEMO_USER_ID);
  } else {
    db.prepare(
      `INSERT INTO users (id, email, role, displayName, createdAt)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(DEMO_USER_ID, 'demo@local', 'student', 'Demo Student');
  }

  // Delete existing suggestions for u-demo (repeatable)
  const delSuggestions = db.prepare('DELETE FROM copilot_suggestions WHERE userId = ?').run(DEMO_USER_ID);

  // 3 assignments (next 7 days) — insert if not present by title
  const assignmentTitles = [
    { title: 'Math homework ch.5', dueOffset: 2 },
    { title: 'Essay draft', dueOffset: 4 },
    { title: 'Read chapter 3', dueOffset: 6 },
  ];
  for (const { title, dueOffset } of assignmentTitles) {
    const exists = db.prepare(
      'SELECT id FROM assignments WHERE userId = ? AND title = ?'
    ).get(DEMO_USER_ID, title);
    if (!exists) {
      const dueStr = dueOffset === 0 ? null : new Date(Date.now() + dueOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
      const id = `a-demo-${slug}`;
      db.prepare(
        `INSERT INTO assignments (id, userId, title, dueDate, completed, createdAt)
         VALUES (?, ?, ?, ?, 0, datetime('now'))`
      ).run(id, DEMO_USER_ID, title, dueStr);
    }
  }

  // 2 busy events in next 2 days (for conflict avoidance demo)
  const now = new Date();
  const day1 = new Date(now);
  day1.setDate(day1.getDate() + 1);
  const day2 = new Date(now);
  day2.setDate(day2.getDate() + 2);
  function toSqlite(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const busyEvents = [
    { title: 'Team standup', date: toSqlite(day1), startH: 10, startM: 0, endH: 10, endM: 30 },
    { title: 'Lab session', date: toSqlite(day2), startH: 14, startM: 0, endH: 16, endM: 0 },
  ];
  for (const ev of busyEvents) {
    const startAt = `${ev.date} ${String(ev.startH).padStart(2, '0')}:${String(ev.startM).padStart(2, '0')}:00`;
    const endAt = `${ev.date} ${String(ev.endH).padStart(2, '0')}:${String(ev.endM).padStart(2, '0')}:00`;
    const exists = db.prepare(
      'SELECT id FROM events WHERE userId = ? AND title = ? AND startAt = ?'
    ).get(DEMO_USER_ID, ev.title, startAt);
    if (!exists) {
      const id = 'e-demo-' + ev.title.replace(/\s/g, '-').slice(0, 10);
      db.prepare(
        `INSERT INTO events (id, userId, title, startAt, endAt, type, createdAt)
         VALUES (?, ?, ?, ?, ?, 'personal', datetime('now'))`
      ).run(id, DEMO_USER_ID, ev.title, startAt, endAt);
    }
  }

  // 1 "Study:" event in next day (for /reschedule target)
  const studyDate = toSqlite(day1);
  const studyStart = `${studyDate} 15:00:00`;
  const studyEnd = `${studyDate} 16:00:00`;
  const studyExists = db.prepare(
    "SELECT id FROM events WHERE userId = ? AND title LIKE 'Study:%' AND startAt = ?"
  ).get(DEMO_USER_ID, studyStart);
  if (!studyExists) {
    db.prepare(
      `INSERT INTO events (id, userId, title, startAt, endAt, type, createdAt)
       VALUES (?, ?, ?, ?, ?, 'personal', datetime('now'))`
    ).run('e-demo-study', DEMO_USER_ID, 'Study: Math review', studyStart, studyEnd);
  }

  // Notes (Phase 3 demo) — repeatable
  function upsertNote({ id, title, content }) {
    const exists = db.prepare('SELECT id FROM notes WHERE id = ? AND userId = ?').get(id, DEMO_USER_ID);
    if (exists) {
      db.prepare(
        'UPDATE notes SET title = ?, content = ?, createdAt = datetime(\'now\') WHERE id = ? AND userId = ?'
      ).run(title, content, id, DEMO_USER_ID);
    } else {
      db.prepare(
        `INSERT INTO notes (id, userId, title, content, createdAt)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(id, DEMO_USER_ID, title, content);
    }
  }
  const demoNotes = [
    {
      id: 'n-demo-bio',
      title: 'Biology: Cell basics',
      content:
        'The mitochondria produce ATP and are often called the powerhouse of the cell.\n' +
        'Ribosomes synthesize proteins from amino acids.\n' +
        'The nucleus stores DNA and regulates gene expression.\n' +
        'Cell membranes control what enters and leaves the cell.',
    },
    {
      id: 'n-demo-econ',
      title: 'Economics: Supply & demand',
      content:
        'Demand generally increases when price falls, holding other factors constant.\n' +
        'Supply generally increases when price rises.\n' +
        'Equilibrium is where quantity demanded equals quantity supplied.\n' +
        'Shifts happen due to income, tastes, substitutes, or input costs.',
    },
  ];
  for (const n of demoNotes) upsertNote(n);

  const assignCount = db.prepare('SELECT COUNT(*) as c FROM assignments WHERE userId = ?').get(DEMO_USER_ID).c;
  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events WHERE userId = ?').get(DEMO_USER_ID).c;
  const noteCount = db.prepare('SELECT COUNT(*) as c FROM notes WHERE userId = ?').get(DEMO_USER_ID).c;

  console.log('Demo seed complete.');
  console.log('  User: u-demo (demo@local, Demo Student)');
  console.log('  Suggestions removed:', delSuggestions.changes);
  console.log('  Assignments:', assignCount);
  console.log('  Events:', eventCount);
  console.log('  Notes:', noteCount);
  console.log('  Use userId=u-demo for /plan, /tasks, /deadline, /reschedule.');
  console.log('  Use userId=u-demo for /notes, /summarize, /flashcards, /quiz, /check.');
  console.log('');
  console.log('Curl examples (backend and server must be running):');
  console.log('  1) /plan for u-demo:');
  console.log('     curl -s -X POST http://localhost:3001/api/copilot/chat \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"userId":"u-demo","messages":[{"role":"user","content":"/plan"}]}\' | jq');
  console.log('  2) List pending suggestions:');
  console.log('     curl -s "http://localhost:3001/api/copilot/suggestions?userId=u-demo&status=pending&limit=50" | jq');
}

run();
