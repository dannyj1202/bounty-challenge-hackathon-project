import { Router } from 'express';
import { getDb } from '../db/index.js';
import { execute as executeCopilotCommand } from '../services/copilotCommands.js';

const router = Router();

// POST /api/copilot/chat { userId, messages, context } — command-gated: /command or hint
router.post('/chat', async (req, res) => {
  const { userId, messages, context } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  const latestUser = [...messages].reverse().find((m) => m && m.role === 'user');
  const content = latestUser && latestUser.content ? String(latestUser.content).trim() : '';

  if (!content.startsWith('/')) {
    return res.status(200).json({
      reply: 'Use a command like /help',
      suggestions: [],
    });
  }

  try {
    const result = await executeCopilotCommand({ userId, messages, context });
    return res.status(200).json({ reply: result.reply, suggestions: result.suggestions || [] });
  } catch (e) {
    return res.status(500).json({ reply: e.message, suggestions: [] });
  }
});

// GET /api/copilot/suggestions?userId=...&status=pending&limit=50
router.get('/suggestions', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const status = req.query.status ?? 'pending';
  let limit = parseInt(req.query.limit, 10);
  if (Number.isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM copilot_suggestions WHERE userId = ? AND status = ? ORDER BY createdAt DESC LIMIT ?'
  ).all(userId, status, limit);
  res.json(rows);
});

// POST /api/copilot/suggestions/:id/reject { userId }
router.post('/suggestions/:id/reject', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const row = db.prepare('SELECT * FROM copilot_suggestions WHERE id = ? AND userId = ?').get(id, userId);
  if (!row) return res.status(404).json({ error: 'Suggestion not found' });
  if (row.decidedAt != null || (row.status && row.status !== 'pending')) {
    return res.status(409).json({ error: 'Suggestion already decided' });
  }
  db.prepare(
    "UPDATE copilot_suggestions SET status = 'rejected', decidedAt = datetime('now') WHERE id = ? AND userId = ?"
  ).run(id, userId);
  const updated = db.prepare('SELECT * FROM copilot_suggestions WHERE id = ? AND userId = ?').get(id, userId);
  res.json(updated);
});

// POST /api/copilot/suggestions/:id/accept { userId }
router.post('/suggestions/:id/accept', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const row = db.prepare('SELECT * FROM copilot_suggestions WHERE id = ? AND userId = ?').get(id, userId);
  if (!row) return res.status(404).json({ error: 'Suggestion not found' });
  if (row.decidedAt != null || (row.status && row.status !== 'pending')) {
    return res.status(409).json({ error: 'Suggestion already decided' });
  }
  db.prepare(
    "UPDATE copilot_suggestions SET status = 'accepted', decidedAt = datetime('now') WHERE id = ? AND userId = ?"
  ).run(id, userId);
  const suggestion = db.prepare('SELECT * FROM copilot_suggestions WHERE id = ? AND userId = ?').get(id, userId);


  let executed = null;
  let payload = {};
  try {
    if (suggestion.payload) {
      try {
        payload = JSON.parse(suggestion.payload);
      } catch {
        return res.status(400).json({ error: 'Invalid suggestion payload' });
      }
    }
    if (suggestion.type === 'create_task') {
      const taskId = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      db.prepare(
        'INSERT INTO tasks (id, userId, title, dueDate, source, createdAt, completed) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), 0)'
      ).run(taskId, userId, payload.title || 'Untitled', payload.dueDate || null, `copilot:${id}`);
      executed = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    } else if (suggestion.type === 'create_calendar_block') {
      const eventId = 'e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      const startAt = payload.start ?? payload.startAt ?? null;
      const endAt = payload.end ?? payload.endAt ?? null;
      if (!startAt || !endAt) {
        return res.status(400).json({ error: 'payload.start and payload.end required for create_calendar_block' });
      }
      db.prepare(
        'INSERT INTO events (id, userId, title, startAt, endAt, type, sourceId) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(eventId, userId, payload.title || 'Study block', startAt, endAt, 'personal', id);
      executed = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.json({ suggestion, executed });
});

export default router;
