/**
 * One-time seed for copilot E2E: user u-e2e, suggestions for accept/reject/404/400 tests.
 * Run: node scripts/e2e-seed-copilot.js
 */
import { getDb } from '../db/index.js';

const db = getDb();

// Ensure user exists (FK)
db.prepare(
  'INSERT OR IGNORE INTO users (id, email, role) VALUES (?, ?, ?)'
).run('u-e2e', 'e2e@test.edu', 'student');

// Fresh suggestions for this run (delete old e2e ones so we can re-run)
db.prepare("DELETE FROM copilot_suggestions WHERE id LIKE 's-e2e-%'").run();

// s-e2e-1: create_task, pending -> accept
db.prepare(
  `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status)
   VALUES (?, ?, ?, ?, ?, 'pending')`
).run('s-e2e-1', 'u-e2e', 'create_task', 'Add task', JSON.stringify({ title: 'E2E task', dueDate: '2026-02-15' }));

// s-e2e-2: for reject (pending)
db.prepare(
  `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status)
   VALUES (?, ?, ?, ?, ?, 'pending')`
).run('s-e2e-2', 'u-e2e', 'create_task', 'Reject me', JSON.stringify({ title: 'Reject task' }));

// s-e2e-3: create_calendar_block with NO start/end -> 400 on accept
db.prepare(
  `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status)
   VALUES (?, ?, ?, ?, ?, 'pending')`
).run('s-e2e-3', 'u-e2e', 'create_calendar_block', 'Bad block', JSON.stringify({ title: 'No times' }));

// s-e2e-4: owned by u-e2e; we'll call accept with wrong userId -> 404
db.prepare(
  `INSERT INTO copilot_suggestions (id, userId, type, label, payload, status)
   VALUES (?, ?, ?, ?, ?, 'pending')`
).run('s-e2e-4', 'u-e2e', 'create_task', 'Wrong user', JSON.stringify({ title: 'X' }));

console.log('E2E seed done. u-e2e, s-e2e-1..4 (pending).');
console.log('Run: curl -X POST http://localhost:3001/api/copilot/suggestions/s-e2e-1/accept -H "Content-Type: application/json" -d \'{"userId":"u-e2e"}\'');
