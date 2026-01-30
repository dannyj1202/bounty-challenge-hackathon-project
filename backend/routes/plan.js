import { Router } from 'express';
import { getDb } from '../db/index.js';
import * as copilot from '../services/copilotService/index.js';

const router = Router();

// POST /api/plan/generate { userId } -> suggested study blocks
router.post('/generate', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const assignments = db.prepare('SELECT * FROM assignments WHERE userId = ? AND completed = 0').all(userId);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const events = db.prepare('SELECT * FROM events WHERE userId = ? AND startAt >= ? AND endAt <= ? ORDER BY startAt').all(userId, today, nextWeek);
  try {
    const result = await copilot.generateStudyPlan({ userId, assignments, events });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
