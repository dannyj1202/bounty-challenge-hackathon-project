import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// Store reviews in feedback table with type='review' (no new table needed)
// GET /api/reviews?userId=...
router.get('/', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, value as text, createdAt FROM feedback WHERE userId = ? AND type = 'review' ORDER BY createdAt DESC LIMIT 50`
  ).all(userId);
  res.json(rows);
});

// POST /api/reviews { userId, text }
router.post('/', (req, res) => {
  const { userId, text } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const value = text != null ? String(text).trim() : '';
  if (!value) return res.status(400).json({ error: 'text required' });
  const db = getDb();
  db.prepare(
    `INSERT INTO feedback (userId, type, value) VALUES (?, 'review', ?)`
  ).run(userId, value);
  const row = db.prepare('SELECT id, value as text, createdAt FROM feedback WHERE id = last_insert_rowid()').get();
  res.status(201).json(row);
});

export default router;
