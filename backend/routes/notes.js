import { Router } from 'express';
import * as copilot from '../services/copilotService/index.js';
import * as translate from '../services/translateService/index.js';
import * as speech from '../services/speechService/index.js';
import * as msGraph from '../services/msGraphService/index.js';

const router = Router();

async function notesChat(prompt, text) {
  const result = await copilot.chat({
    messages: [{ role: 'user', content: `${prompt}\n\nText:\n${text.slice(0, 4000)}` }],
  });
  return { ...result, text: result.reply };
}

// POST /api/notes/summarize { text }
router.post('/summarize', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await notesChat('Summarize the following text concisely. Return only the summary.', text);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/translate { text, language }
router.post('/translate', async (req, res) => {
  const { text, language = 'es' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await translate.translate({ text, toLanguage: language });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/flashcards { text }
router.post('/flashcards', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await notesChat('Generate 5 flashcards (question/answer pairs) from this text. Format as JSON: { "cards": [ { "front": "...", "back": "..." } ] }', text);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/questions { text }
router.post('/questions', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await notesChat('Generate 3 practice questions (with short answers) from this text. Return JSON: { "questions": [ { "q": "...", "a": "..." } ] }', text);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/transcribe - audio base64 or blob
router.post('/transcribe', async (req, res) => {
  const { audioBase64, contentType } = req.body || {};
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
  try {
    const result = await speech.transcribe({ audioBase64, contentType: contentType || 'audio/wav' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes/save-onenote { userId, title, content }
router.post('/save-onenote', async (req, res) => {
  const { userId, title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || null;
    const result = await msGraph.createOneNotePage({ userId, title, content, accessToken });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
