import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// GET /api/insights/student?userId=...
router.get('/student', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const checkins = db.prepare('SELECT COUNT(*) as c FROM checkins WHERE userId = ?').get(userId);
  const feedback = db.prepare('SELECT type, value, COUNT(*) as c FROM feedback WHERE userId = ? GROUP BY type, value').all(userId);
  const topics = db.prepare('SELECT topic, weakCount FROM topicStats WHERE userId = ? ORDER BY weakCount DESC LIMIT 10').all(userId);
  res.json({
    checkins: checkins?.c || 0,
    feedbackDistribution: feedback,
    weakTopics: topics,
  });
});

// GET /api/insights/university - aggregated anonymized (admin only; no per-user data)
router.get('/university', (req, res) => {
  const db = getDb();
  const engagement = db.prepare('SELECT COUNT(*) as totalCheckins, COUNT(DISTINCT userId) as uniqueUsers FROM checkins').get();
  const feedback = db.prepare('SELECT value as difficulty, COUNT(*) as c FROM feedback WHERE type = ? GROUP BY value').all('difficulty');
  const weakTopics = db.prepare('SELECT topic, SUM(weakCount) as total FROM topicStats GROUP BY topic ORDER BY total DESC LIMIT 15').all();
  const workload = db.prepare(`
    SELECT strftime('%Y-%W', dueDate) as week, COUNT(*) as dueCount
    FROM assignments WHERE dueDate IS NOT NULL GROUP BY week ORDER BY week LIMIT 20
  `).all();
  res.json({
    aggregated: true,
    anonymized: true,
    engagementCheckins: engagement?.totalCheckins || 0,
    uniqueUsers: engagement?.uniqueUsers || 0,
    feedbackDistribution: feedback,
    mostCommonWeakTopics: weakTopics,
    workloadPressureWeeks: workload,
  });
});

export default router;
