import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import express from 'express';
import cors from 'cors';
import { getDb, initDb } from './db/index.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import assignmentRoutes from './routes/assignments.js';
import eventRoutes from './routes/events.js';
import planRoutes from './routes/plan.js';
import copilotRoutes from './routes/copilot.js';
import quizRoutes from './routes/quiz.js';
import notesRoutes from './routes/notes.js';
import teamsRoutes from './routes/teams.js';
import notificationsRoutes from './routes/notifications.js';
import insightsRoutes from './routes/insights.js';
import webhooksRoutes from './routes/webhooks.js';
import devRoutes from './routes/dev.js';
import communityRoutes from './routes/community.js';
import calendarRoutes from './routes/calendar.js';

const app = express();
const PORT = process.env.PORT || 3001;
// Comma-separated list so you and friends can use different URLs (e.g. localhost + your LAN IP)
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin or non-browser
    if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
    // In dev, allow any origin ending with :5173 so friends on your network can log in
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/[^/]+:5173$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Ensure DB exists and run migrations
try {
  initDb();
} catch (e) {
  console.warn('DB init:', e.message);
}

// ✅ add this (public route)
app.use('/api/community', communityRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/calendar', calendarRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Smart Study Copilot API running at http://localhost:${PORT}`);
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});
