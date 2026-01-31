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
import docsRoutes from './routes/docs.js';
import documentsRoutes from './routes/documents.js';
import tasksRoutes from './routes/tasks.js';
import onenoteRoutes from "./routes/onenote.js";

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
app.use('/api/docs', docsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use("/api/onenote", onenoteRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// GET /api/health/azure — verify OpenAI chat, embeddings, Search, Document Intelligence
app.get('/api/health/azure', async (req, res) => {
  const checks = { openaiChat: false, openaiEmbeddings: false, search: false, documentIntelligence: false };
  const errors = [];
  try {
    const openai = await import('./services/azureOpenAIClient.js');
    if (openai.isConfigured()) {
      try {
        await openai.chatCompletion({ messages: [{ role: 'user', content: 'Say OK' }], maxTokens: 5 });
        checks.openaiChat = true;
      } catch (e) {
        errors.push('openaiChat: ' + (e.message || 'failed'));
      }
      try {
        await openai.embedOne('test');
        checks.openaiEmbeddings = true;
      } catch (e) {
        errors.push('openaiEmbeddings: ' + (e.message || 'failed'));
      }
    }
    const searchMod = await import('./services/azureSearchClient.js');
    if (searchMod.isConfigured()) {
      try {
        await searchMod.simpleSearch({ query: '*', top: 1 });
        checks.search = true;
      } catch (e) {
        errors.push('search: ' + (e.message || 'failed'));
      }
    }
    const di = await import('./services/documentIntelligenceClient.js');
    if (di.isAvailable()) {
      checks.documentIntelligence = true;
    }
  } catch (e) {
    errors.push(String(e.message));
  }
  const ok = checks.openaiChat && checks.openaiEmbeddings && checks.search && checks.documentIntelligence;
  res.status(ok ? 200 : 503).json({ ok, checks, errors });
});

// 404 catch-all (so 404s don't look like 500s)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Error handler MUST be last (before listen). Catches errors from routes/middleware.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && err.stack && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`Smart Study Copilot API running at http://localhost:${PORT}`);
});