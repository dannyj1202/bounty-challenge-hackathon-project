import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// GET /api/assignments?userId=...
router.get('/', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const rows = db.prepare('SELECT * FROM assignments WHERE userId = ? ORDER BY dueDate ASC, createdAt DESC').all(userId);
  res.json(rows);
});

// POST /api/assignments
router.post('/', (req, res) => {
  const { userId, title, dueDate } = req.body || {};
  if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });
  const id = 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const db = getDb();
  db.prepare(
    'INSERT INTO assignments (id, userId, title, dueDate) VALUES (?, ?, ?, ?)'
  ).run(id, userId, title, dueDate || null);
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  res.status(201).json(row);
});

// PUT /api/assignments/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, dueDate } = req.body || {};
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Assignment not found' });
  if (title != null) existing.title = title;
  if (dueDate !== undefined) existing.dueDate = dueDate;
  db.prepare('UPDATE assignments SET title = ?, dueDate = ?, completed = ?, completedAt = ? WHERE id = ?').run(
    existing.title, existing.dueDate, existing.completed, existing.completedAt, id
  );
  res.json(db.prepare('SELECT * FROM assignments WHERE id = ?').get(id));
});

// DELETE /api/assignments/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.status(204).send();
});

// POST /api/assignments/:id/complete { difficulty, comment }
router.post('/:id/complete', (req, res) => {
  const { id } = req.params;
  const { difficulty, comment } = req.body || {};
  const db = getDb();
  const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  db.prepare('UPDATE assignments SET completed = 1, completedAt = datetime(\'now\'), difficulty = ?, comment = ? WHERE id = ?').run(difficulty || null, comment || null, id);
  if (a.userId && (difficulty || comment)) {
    db.prepare('INSERT INTO feedback (userId, type, value) VALUES (?, ?, ?)').run(a.userId, 'difficulty', difficulty || comment || '');
  }
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  res.json(row);
});

export default router;
