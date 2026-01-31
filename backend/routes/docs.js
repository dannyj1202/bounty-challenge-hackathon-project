/**
 * POST /api/docs/ingest — upload PDF/image, extract text via Azure Document Intelligence, store as note.
 * Body: multipart with file; fields: userId (required), title (optional).
 * Response: { ok: true, noteId, title, chars } or error.
 */

import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/index.js';
import { extractTextFromBuffer, isAvailable } from '../services/documentIntelligenceService/index.js';

const router = Router();

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIMES.has(mime)) return cb(null, true);
    cb(new Error('Only PDF, PNG, and JPG are allowed.'));
  },
});

router.post('/ingest', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 20 MB.' });
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  const file = req.file;
  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No file uploaded. Send multipart with field "file".' });
  }

  const title = (req.body?.title ?? file.originalname ?? 'Untitled document').toString().trim() || 'Untitled document';

  let extracted = '';
  try {
    if (!isAvailable()) {
      return res.status(503).json({
        error: 'Document Intelligence is disabled. Set USE_AZURE_DOCUMENT_INTELLIGENCE=true and configure AZURE_DOCINTEL_* in .env.',
      });
    }
    extracted = await extractTextFromBuffer(file.buffer, file.mimetype);
  } catch (e) {
    console.warn('[docs/ingest] extract failed:', e.message);
    return res.status(502).json({ error: e.message || 'Text extraction failed.' });
  }

  const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const db = getDb();
  try {
    db.prepare(
      'INSERT INTO notes (id, userId, title, content, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(noteId, userId, title, extracted);
  } catch (dbErr) {
    console.error('[docs/ingest] db insert:', dbErr);
    return res.status(500).json({ error: 'Failed to save note.' });
  }

  res.status(200).json({
    ok: true,
    noteId,
    title,
    chars: (extracted || '').length,
  });
});

export default router;
