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


// GET /api/auth/entra/login?userId=...  - redirect to Entra ID (OAuth)
router.get('/entra/login', async (req, res) => {
  const userId = req.query.userId || req.query.state || '';
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const url = await msGraph.getAuthorizeUrl(String(userId));
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ error: 'OAuth not configured', message: e.message });
  }
});

// GET /api/auth/entra/callback - exchange code for tokens, store, redirect
router.get('/entra/callback', async (req, res) => {
  const { code, state } = req.query; // state = userId
  if (!code || !state) return res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');

  try {
    await msGraph.exchangeCodeForTokens(String(code), String(state));
    res.redirect((process.env.FRONTEND_ORIGIN || 'http://localhost:5173') + '/settings?ms=connected');
  } catch (e) {
    console.error('entra callback error:', e);
    res.status(500).send('Microsoft login failed');
  }
});

// GET /api/auth/microsoft/login  (alias)
router.get('/microsoft/login', async (req, res) => {
  const userId = req.query.userId || req.query.state || '';
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const url = await msGraph.getAuthorizeUrl(String(userId));
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ error: 'OAuth not configured', message: e.message });
  }
});

// GET /api/auth/microsoft/callback (alias)  <-- IMPORTANT
router.get('/microsoft/callback', async (req, res) => {
  const { code, state } = req.query; // state = userId
  if (!code || !state) return res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');

  try {
    await msGraph.exchangeCodeForTokens(String(code), String(state));
    res.redirect((process.env.FRONTEND_ORIGIN || 'http://localhost:5173') + '/settings?ms=connected');
  } catch (e) {
    console.error('microsoft callback error:', e);
    res.status(500).send('Microsoft login failed');
  }
});

// GET /api/auth/microsoft/status?userId=...
router.get('/microsoft/status', (req, res) => {
  const userId = req.query.userId || '';
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const db = getDb();
  const row = db
    .prepare("SELECT username, expiresAt FROM oauth_accounts WHERE userId = ? AND provider = 'microsoft'")
    .get(String(userId));

  const connected = !!row && typeof row.expiresAt === 'number' && row.expiresAt > Date.now();
  res.json({ connected, username: row?.username || null, expiresAt: row?.expiresAt || null });
});


export default router;
