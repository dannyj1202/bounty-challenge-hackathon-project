import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// POST /api/notifications/checkin { userId }
router.post('/checkin', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  db.prepare('INSERT INTO checkins (userId) VALUES (?)').run(userId);
  res.json({ ok: true });
});

// GET /api/notifications?userId=...
router.get('/', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50').all(userId);
  res.json(rows);
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
