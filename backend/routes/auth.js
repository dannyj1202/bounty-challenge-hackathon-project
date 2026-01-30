import { Router } from 'express';
import { getDb } from '../db/index.js';
import * as msGraph from '../services/msGraphService/index.js';

const router = Router();

// POST /api/auth/mock-login { email, role }
router.post('/mock-login', (req, res) => {
  const rawEmail = req.body?.email;
  const rawRole = req.body?.role ?? 'student';

  if (!rawEmail) return res.status(400).json({ error: 'email required' });

  const email = String(rawEmail).trim().toLowerCase();
  const role = String(rawRole).trim().toLowerCase() === 'admin' ? 'admin' : 'student';

  const db = getDb();

  try {
    // 1) If user already exists by email, reuse the SAME id (critical for FK integrity)
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // 2) Create a stable-ish id (email-based) instead of random per login
      // (Simple + deterministic, good enough for hackathon)
      const id = 'user-' + Buffer.from(email).toString('base64').replace(/=+/g, '').slice(0, 20);

      db.prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)').run(id, email, role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      // 3) If user exists, update role if needed (don’t change id)
      if (user.role !== role) {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    }

    const token = 'mock-token-' + user.id;
    return res.json({ userId: user.id, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    console.error('mock-login error:', e);
    return res.status(500).json({ error: 'mock-login failed', message: e.message });
  }
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
