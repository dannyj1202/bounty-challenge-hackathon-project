import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// POST /api/webhooks/power-automate/deadline-reminder
router.post('/power-automate/deadline-reminder', (req, res) => {
  const { userId, assignmentId, title, dueDate } = req.body || {};
  const db = getDb();
  if (userId) {
    db.prepare(
      'INSERT INTO notifications (userId, type, title, body) VALUES (?, ?, ?, ?)'
    ).run(userId, 'deadline-reminder', title || 'Assignment due soon', `Due: ${dueDate || 'N/A'}`);
  }
  res.status(202).json({ received: true });
});

// POST /api/webhooks/power-automate/weekly-summary
router.post('/power-automate/weekly-summary', (req, res) => {
  const { userId, summary } = req.body || {};
  const db = getDb();
  if (userId) {
    db.prepare(
      'INSERT INTO notifications (userId, type, title, body) VALUES (?, ?, ?, ?)'
    ).run(userId, 'weekly-summary', 'Weekly summary', summary || 'Your week at a glance.');
  }
  res.status(202).json({ received: true });
});

export default router;
