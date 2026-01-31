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
// Used by admin/teacher dashboard: heatmaps, workload patterns, engagement trends.
router.get('/university', (req, res) => {
  const db = getDb();
  const engagement = db.prepare('SELECT COUNT(*) as totalCheckins, COUNT(DISTINCT userId) as uniqueUsers FROM checkins').get();
  const feedback = db.prepare('SELECT value as difficulty, COUNT(*) as c FROM feedback WHERE type = ? GROUP BY value').all('difficulty');
  const weakTopics = db.prepare('SELECT topic, SUM(weakCount) as total FROM topicStats GROUP BY topic ORDER BY total DESC LIMIT 15').all();
  const workload = db.prepare(`
    SELECT strftime('%Y-%W', dueDate) as week, COUNT(*) as dueCount
    FROM assignments WHERE dueDate IS NOT NULL GROUP BY week ORDER BY week LIMIT 52
  `).all();

  // Completed assignments by week (completedAt) for pressure trend
  const completedByWeek = db.prepare(`
    SELECT strftime('%Y-%W', completedAt) as week, COUNT(*) as completedCount
    FROM assignments WHERE completed = 1 AND completedAt IS NOT NULL
    GROUP BY week ORDER BY week LIMIT 52
  `).all();

  // Feedback (difficulty) by week for heatmap: which weeks had hard vs easy feedback
  const feedbackByWeek = db.prepare(`
    SELECT strftime('%Y-%W', createdAt) as week, value as difficulty, COUNT(*) as c
    FROM feedback WHERE type = 'difficulty' AND value IN ('easy','medium','hard')
    GROUP BY week, value ORDER BY week LIMIT 200
  `).all();

  // Build heatmap rows: one entry per week with dueCount, completedCount, easy/medium/hard, pressureScore
  const weekMap = new Map();
  for (const row of workload) {
    weekMap.set(row.week, { week: row.week, dueCount: row.dueCount || 0, completedCount: 0, easy: 0, medium: 0, hard: 0 });
  }
  for (const row of completedByWeek) {
    if (!weekMap.has(row.week)) weekMap.set(row.week, { week: row.week, dueCount: 0, completedCount: 0, easy: 0, medium: 0, hard: 0 });
    weekMap.get(row.week).completedCount = row.completedCount || 0;
  }
  for (const row of feedbackByWeek) {
    if (!weekMap.has(row.week)) weekMap.set(row.week, { week: row.week, dueCount: 0, completedCount: 0, easy: 0, medium: 0, hard: 0 });
    const w = weekMap.get(row.week);
    if (row.difficulty === 'easy') w.easy = row.c || 0;
    else if (row.difficulty === 'medium') w.medium = row.c || 0;
    else if (row.difficulty === 'hard') w.hard = row.c || 0;
  }
  const heatmapWeeks = [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-26);
  for (const w of heatmapWeeks) {
    w.weekLabel = formatWeekLabel(w.week);
    w.pressureScore = (w.dueCount || 0) + (w.completedCount || 0) + (w.hard || 0) * 2 + (w.medium || 0) * 1.5 + (w.easy || 0);
  }

  res.json({
    aggregated: true,
    anonymized: true,
    engagementCheckins: engagement?.totalCheckins || 0,
    uniqueUsers: engagement?.uniqueUsers || 0,
    feedbackDistribution: feedback,
    mostCommonWeakTopics: weakTopics,
    workloadPressureWeeks: workload,
    workloadHeatmap: heatmapWeeks,
  });
});

function formatWeekLabel(week) {
  if (!week || week.length < 7) return week;
  const [y, w] = week.split('-');
  const d = new Date(Number(y), 0, 1 + (Number(w) || 0) * 7);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default router;
