import { Router } from 'express';
import { getDb } from '../db/index.js';
import * as msGraph from '../services/msGraphService/index.js';

const router = Router();

// POST /api/auth/mock-login { email, role }
router.post('/mock-login', (req, res) => {
  const { email, role = 'student' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const db = getDb();
  const id = 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, role) VALUES (?, ?, ?)'
  ).run(id, email, role === 'admin' ? 'admin' : 'student');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = 'mock-token-' + id;
  res.json({ userId: id, token, user: { id: user.id, email: user.email, role: user.role } });
});

// GET /api/auth/entra/login - redirect to Entra ID (OAuth)
router.get('/entra/login', (req, res) => {
  const state = req.query.state || req.query.redirect_uri || '';
  try {
    const url = msGraph.getAuthorizeUrl(state);
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ error: 'OAuth not configured', message: e.message });
  }
});

// GET /api/auth/entra/callback - TODO: exchange code for tokens, create session, redirect to app
router.get('/entra/callback', (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
  // TODO: exchangeCodeForTokens(code), store tokens, redirect to app with session
  res.redirect((process.env.FRONTEND_ORIGIN || 'http://localhost:5173') + '/home');
});

export default router;
