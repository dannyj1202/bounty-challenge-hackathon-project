import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

function getPrefs(db, userId) {
  const row = db.prepare('SELECT * FROM preferences WHERE userId = ?').get(userId);
  if (!row) return { widgets: '[]', notifications: '{}', monetizationAck: 0 };
  return {
    widgets: row.widgets || '[]',
    notifications: row.notifications || '{}',
    monetizationAck: row.monetizationAck || 0,
  };
}

// GET /api/user/preferences?userId=...
router.get('/preferences', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const prefs = getPrefs(db, userId);
  res.json({ userId, ...prefs });
});

// PUT /api/user/preferences
router.put('/preferences', (req, res) => {
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const { widgets, notifications, monetizationAck } = req.body;
  const db = getDb();
  db.prepare(
    `INSERT INTO preferences (userId, widgets, notifications, monetizationAck, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(userId) DO UPDATE SET
       widgets = COALESCE(excluded.widgets, widgets),
       notifications = COALESCE(excluded.notifications, notifications),
       monetizationAck = COALESCE(excluded.monetizationAck, monetizationAck),
       updatedAt = datetime('now')`
  ).run(
    userId,
    widgets != null ? JSON.stringify(widgets) : null,
    notifications != null ? JSON.stringify(notifications) : null,
    monetizationAck != null ? (monetizationAck ? 1 : 0) : null
  );
  const prefs = getPrefs(db, userId);
  res.json({ userId, ...prefs });
});

export default router;
