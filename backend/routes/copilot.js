import { Router } from 'express';
import { getDb } from '../db/index.js';
import { execute as executeCopilotCommand } from '../services/copilotCommands.js';
import { streamChatCompletion } from '../services/copilotService/index.js';
import { buildContext, contextSummaryForPrompt } from '../services/contextBuilder.js';

const router = Router();
const DOCUMENT_TEXT_CAP = 50000;

/** Build documentText from noteId (load from DB) or pasted text; cap length. */
function resolveDocumentText(userId, noteId, text) {
  let out = '';
  if (noteId && userId) {
    try {
      const db = getDb();
      const row = db.prepare('SELECT content FROM notes WHERE id = ? AND userId = ?').get(noteId, userId);
      if (row && row.content) out = String(row.content);
    } catch (e) {
      console.warn('[copilot] resolveDocumentText noteId:', e.message);
    }
  }
  if (!out && text != null && text !== '') out = String(text);
  return out.slice(0, DOCUMENT_TEXT_CAP);
}

// POST /api/copilot/chat { userId, messages, context, noteId?, text? } — command-gated
router.post('/chat', async (req, res) => {
  const { userId, messages, context: reqContext, noteId, text } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  const latestUser = [...messages].reverse().find((m) => m && m.role === 'user');
  const content = latestUser && latestUser.content ? String(latestUser.content).trim() : '';

  if (!content.startsWith('/')) {
    return res.status(200).json({
      reply: 'Commands only. Try /help',
      suggestions: [],
    });
  }

  const documentText = resolveDocumentText(userId, noteId, text);
  const context = { ...(reqContext || {}), documentText: documentText || undefined };

  try {
    const result = await executeCopilotCommand({ userId, messages, context });
    return res.status(200).json({ reply: result.reply, suggestions: result.suggestions || [] });
  } catch (e) {
    return res.status(500).json({ reply: e.message, suggestions: [] });
  }
});

// POST /api/copilot/chat/stream — SSE stream. Same validation as /chat. Body may include noteId, text.
router.post('/chat/stream', async (req, res) => {
  const { userId, messages, noteId, text } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  const latestUser = [...messages].reverse().find((m) => m && m.role === 'user');
  const raw = latestUser && latestUser.content ? String(latestUser.content).trim() : '';

  if (!raw.startsWith('/')) {
    return res.status(200).json({ reply: 'Commands only. Try /help', suggestions: [] });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const documentText = resolveDocumentText(userId, noteId, text);
  const baseContext = buildContext(userId || '');
  const context = { ...baseContext, documentText: documentText || undefined };

  try {
    const contextSummary = contextSummaryForPrompt(context);
    const result = await executeCopilotCommand({ userId, messages, context });
    const { reply: fallbackReply, suggestions = [] } = result;

    const system = `You are a study assistant. User context:\n${contextSummary}\nReply briefly and helpfully to the user's command. Do not repeat the command.`;
    const streamMessages = [{ role: 'user', content: raw }];

    let streamed = false;
    try {
      for await (const chunk of streamChatCompletion({ system, messages: streamMessages, temperature: 0.7, maxTokens: 600 })) {
        streamed = true;
        send({ type: 'chunk', text: chunk });
      }
    } catch (streamErr) {
      console.warn('[copilot/stream] Azure stream failed, using fallback:', streamErr.message);
    }

    if (!streamed) {
      const chunks = fallbackReply.match(/.{1,30}(\s|$)|.{1,30}/g) || [fallbackReply];
      for (const c of chunks) send({ type: 'chunk', text: c });
    }

    send({ type: 'suggestions', suggestions });
    send({ type: 'done' });
  } catch (e) {
    console.error('[copilot/stream]', e);
    send({ type: 'error', message: e.message });
    send({ type: 'done' });
  } finally {
    res.end();
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
