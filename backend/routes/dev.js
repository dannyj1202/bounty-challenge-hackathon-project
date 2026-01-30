import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// POST /api/dev/seed - demo data
router.post('/seed', (req, res) => {
  const db = getDb();
  const userId = 'user-demo-' + Date.now();
  db.prepare('INSERT OR IGNORE INTO users (id, email, role) VALUES (?, ?, ?)').run(userId, 'demo@university.edu', 'student');
  db.prepare('INSERT OR REPLACE INTO preferences (userId, widgets, notifications) VALUES (?, ?, ?)').run(userId, '["notifications","tasks","copilot"]', '{"email":true,"push":false}');
  const a1 = 'a-seed-1', a2 = 'a-seed-2';
  const due1 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const due2 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.prepare('INSERT OR IGNORE INTO assignments (id, userId, title, dueDate) VALUES (?, ?, ?, ?)').run(a1, userId, 'Math homework ch.5', due1);
  db.prepare('INSERT OR IGNORE INTO assignments (id, userId, title, dueDate) VALUES (?, ?, ?, ?)').run(a2, userId, 'Essay draft', due2);
  const start = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const end = new Date(Date.now() + 90 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO events (id, userId, title, startAt, endAt, type) VALUES (?, ?, ?, ?, ?, ?)').run('e-seed-1', userId, 'Football practice', start, end, 'personal');
  db.prepare('INSERT INTO notifications (userId, type, title, body) VALUES (?, ?, ?, ?)').run(userId, 'info', 'Welcome', 'Try the Copilot and Quiz!');
  res.json({
    message: 'Seed data created',
    userId,
    token: 'mock-token-' + userId,
    user: { id: userId, email: 'demo@university.edu', role: 'student' },
  });
});

export default router;
