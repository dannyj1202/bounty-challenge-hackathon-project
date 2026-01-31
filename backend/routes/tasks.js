import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// GET /api/tasks?userId=... — list tasks (personal + from assignments)
router.get('/', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM tasks WHERE userId = ? ORDER BY dueDate IS NULL, dueDate ASC, createdAt DESC'
  ).all(userId);
  res.json(rows);
});

// POST /api/tasks — create personal task (userId, title, dueDate?)
router.post('/', (req, res) => {
  const { userId, title, dueDate } = req.body || {};
  if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });
  const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const db = getDb();
  db.prepare(
    'INSERT INTO tasks (id, userId, title, dueDate, source, createdAt, completed) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), 0)'
  ).run(id, userId, title, dueDate || null, 'personal');
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(row);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

// PATCH /api/tasks/:id/complete — mark task completed
router.patch('/:id/complete', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  db.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

export default router;
