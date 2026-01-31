/**
 * Document ingestion + search.
 * POST /api/documents/upload — multipart; extract, chunk, embed, index, store note.
 * POST /api/documents/text — pasted text; chunk, embed, index, store note.
 * GET /api/documents/search?q=... — vector search.
 */

import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/index.js';
import { extractTextFromBuffer, isAvailable as docIntelAvailable } from '../services/documentIntelligenceClient.js';
import { embed } from '../services/azureOpenAIClient.js';
import * as search from '../services/azureSearchClient.js';

const router = Router();
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has((file.mimetype || '').toLowerCase())) return cb(null, true);
    cb(new Error('Only PDF, PNG, and JPG are allowed.'));
  },
});

/** Chunk text into ~CHUNK_SIZE with overlap. Returns array of strings. */
function chunkText(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const chunks = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + CHUNK_SIZE, t.length);
    if (end < t.length) {
      const nextSpace = t.lastIndexOf(' ', end);
      if (nextSpace > start) end = nextSpace + 1;
    }
    chunks.push(t.slice(start, end));
    start = end - (end - start < CHUNK_SIZE ? 0 : CHUNK_OVERLAP);
    if (start >= t.length) break;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

/** Ingest extracted text: chunk, embed, index, store note. Returns { noteId, documentId, chars }. */
async function ingestText(userId, extractedText, title) {
  const db = getDb();
  const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const documentId = noteId;
  const content = extractedText.slice(0, 500000);
  db.prepare(
    'INSERT INTO notes (id, userId, title, content, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))'
  ).run(noteId, userId, title || 'Untitled document', content);

  const chunks = chunkText(content);
  if (chunks.length === 0) return { noteId, documentId, chars: content.length };

  const useSearch = process.env.USE_AZURE_SEARCH === 'true';
  const useEmbed = process.env.USE_AZURE_OPENAI === 'true';
  if (useSearch && useEmbed) {
    try {
      const embeddings = await embed(chunks);
      const docs = chunks.map((c, i) => ({
        id: `${documentId}-${i}`,
        content: c,
        embedding: embeddings[i] || [],
      }));
      await search.upsertDocuments(docs);
    } catch (e) {
      console.warn('[documents] index failed:', e.message);
    }
  }
  return { noteId, documentId, chars: content.length };
}

// POST /api/documents/upload — multipart file(s). Field: "files" (array) or "file" (single); "userId" required.
router.post('/upload', (req, res, next) => {
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 5 }])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 20 MB.' });
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const fromArray = (req.files && req.files.files) ? (Array.isArray(req.files.files) ? req.files.files : [req.files.files]) : [];
  const fromSingle = (req.files && req.files.file) ? (Array.isArray(req.files.file) ? req.files.file : [req.files.file]) : [];
  const files = [...fromSingle, ...fromArray];
  if (files.length === 0) return res.status(400).json({ error: 'No files. Send multipart with "files" or "file".' });

  if (!docIntelAvailable()) {
    return res.status(503).json({
      error: 'Document Intelligence is disabled. Set USE_AZURE_DOCUMENT_INTELLIGENCE=true and configure AZURE_DOCINTEL_* in .env.',
    });
  }

  const results = [];
  for (const file of files) {
    if (!file.buffer) continue;
    let extracted = '';
    try {
      extracted = await extractTextFromBuffer(file.buffer, file.mimetype);
    } catch (e) {
      results.push({ file: file.originalname, error: e.message });
      continue;
    }
    const title = (req.body?.title ?? file.originalname ?? 'Untitled').toString().trim() || 'Untitled';
    try {
      const out = await ingestText(userId, extracted, title);
      results.push({ file: file.originalname, ...out });
    } catch (e) {
      results.push({ file: file.originalname, error: e.message });
    }
  }
  res.status(200).json({ ok: true, results });
});

// POST /api/documents/text — pasted text
router.post('/text', async (req, res) => {
  const { userId, text, title } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const raw = text != null ? String(text) : '';
  if (!raw.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const out = await ingestText(userId, raw.trim(), (title || 'Pasted text').toString().trim());
    res.status(200).json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents/search?q=...
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const topK = Math.min(20, Math.max(1, parseInt(req.query.top, 10) || 5));
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const { embedOne } = await import('../services/azureOpenAIClient.js');
    const queryVector = await embedOne(q);
    if (!queryVector || !Array.isArray(queryVector)) {
      return res.json({ results: [], totalCount: 0 });
    }
    const { results, totalCount } = await search.vectorSearch({ queryVector, topK });
    res.json({ results, totalCount });
  } catch (e) {
    console.warn('[documents/search]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
