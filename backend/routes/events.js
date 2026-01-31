import { Router } from 'express';
import { getDb } from '../db/index.js';
import { getStoredAccessToken, createCalendarEvent } from '../services/msGraphService/index.js';

const router = Router();
const USE_MS_GRAPH = process.env.USE_MS_GRAPH === 'true';

// GET /api/events?userId=...&start=...&end=...
router.get('/', (req, res) => {
  const { userId, start, end } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  let sql = 'SELECT * FROM events WHERE userId = ?';
  const params = [userId];
  if (start) { sql += ' AND endAt >= ?'; params.push(start); }
  if (end) { sql += ' AND startAt <= ?'; params.push(end); }
  sql += ' ORDER BY startAt ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// POST /api/events — create locally; if user has Outlook token, also create in Outlook and link
router.post('/', async (req, res) => {
  const { userId, title, startAt, endAt, type, sourceId } = req.body || {};
  if (!userId || !title || !startAt || !endAt) return res.status(400).json({ error: 'userId, title, startAt, endAt required' });
  const db = getDb();

  let id;
  let finalSourceId = sourceId || null;

  const accessToken = USE_MS_GRAPH ? getStoredAccessToken(userId) : null;
  if (accessToken) {
    try {
      const created = await createCalendarEvent({
        userId,
        subject: title,
        start: startAt,
        end: endAt,
        body: null,
        accessToken,
      });
      const graphId = created?.id;
      if (graphId) {
        id = `ms:outlook:${graphId}`;
        finalSourceId = `outlook:${graphId}`;
      }
    } catch (e) {
      console.warn('[events] Outlook create failed, saving locally only:', e.message);
    }
  }

  if (!id) {
    id = 'e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  db.prepare(
    'INSERT INTO events (id, userId, title, startAt, endAt, type, sourceId) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, title, startAt, endAt, type || 'personal', finalSourceId);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.status(201).json(row);
});

// DELETE /api/events/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Event not found' });
  res.status(204).send();
});

export default router;