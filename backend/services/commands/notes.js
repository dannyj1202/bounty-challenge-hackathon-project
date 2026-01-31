/**
 * /notes — list/show/search (read-only) OR organizedMarkdown + outline + glossary + citations[] when content provided.
 * /notes | /notes show N | /notes search <keyword> — list/show/search.
 * When context has documentText or noteId, return organized notes output with RAG + GPT-4o.
 */

import { getDb } from '../../db/index.js';
import { getRagContext } from '../ragService.js';
import { chatCompletion, isConfigured as openAiConfigured } from '../azureOpenAIClient.js';

const LIST_LIMIT = 5;
const SNIPPET_LEN = 80;

function getLastNotes(db, userId, limit = LIST_LIMIT) {
  try {
    return db.prepare(
      'SELECT id, title, content, createdAt FROM notes WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ?'
    ).all(userId, limit);
  } catch (e) {
    return [];
  }
}

function getNoteById(db, id, userId) {
  try {
    return db.prepare('SELECT id, title, content, createdAt FROM notes WHERE id = ? AND userId = ?').get(id, userId);
  } catch {
    return null;
  }
}

function searchNotes(db, userId, keyword, limit = LIST_LIMIT) {
  try {
    const like = '%' + String(keyword).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
    return db.prepare(
      `SELECT id, title, content, createdAt FROM notes WHERE userId = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') ORDER BY createdAt DESC LIMIT ?`
    ).all(userId, like, like, limit);
  } catch (e) {
    return [];
  }
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [], citations: [] };

  const db = getDb();
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get();
  if (!tableExists) {
    return {
      reply: 'Notes are not set up yet. Add notes via the Notes page or upload a doc.',
      suggestions: [],
      structured: null,
      citations: [],
    };
  }

  const arg = (args || '').trim();
  const showMatch = arg.match(/^show\s+(\d+)$/i);
  const searchMatch = arg.match(/^search\s+(.+)$/i);

  if (showMatch) {
    let n = parseInt(showMatch[1], 10);
    if (!Number.isFinite(n) || n < 1) {
      return { reply: 'Usage: /notes show <number> (1-based).', suggestions: [], structured: null, citations: [] };
    }
    if (n > 50) n = 50;
    const note = db.prepare(
      'SELECT id, title, content, createdAt FROM notes WHERE userId = ? ORDER BY createdAt DESC LIMIT 1 OFFSET ?'
    ).get(userId, n - 1);
    if (!note) {
      return { reply: `You have fewer than ${n} note(s). Use /notes to list.`, suggestions: [], structured: null, citations: [] };
    }
    const content = String(note.content || '').slice(0, 3000);
    const reply = [`Note ${n}: ${note.title || '(no title)'}`, `Id: ${note.id}`, '', content || '(empty)'].join('\n');
    return { reply, suggestions: [], structured: { noteId: note.id, title: note.title, content }, citations: [] };
  }

  if (searchMatch) {
    const keyword = String(searchMatch[1] || '').trim();
    if (!keyword) return { reply: 'Usage: /notes search <keyword>', suggestions: [], structured: null, citations: [] };
    const list = searchNotes(db, userId, keyword);
    if (list.length === 0) {
      return { reply: `No notes found matching "${keyword}".`, suggestions: [], structured: { notes: [] }, citations: [] };
    }
    const lines = list.map((n, i) => {
      const snippet = (n.content || n.title || '').slice(0, SNIPPET_LEN).replace(/\n/g, ' ');
      return `${i + 1}. ${n.title || '(no title)'} — ${n.createdAt}\n   ${snippet}${(n.content && n.content.length > SNIPPET_LEN) ? '...' : ''}`;
    });
    const reply = ['Matching notes:', '', ...lines].join('\n');
    return { reply, suggestions: [], structured: { notes: list.map((n) => ({ id: n.id, title: n.title, snippet: (n.content || '').slice(0, 100) })) }, citations: [] };
  }

  const documentText = context?.documentText?.trim();
  if (documentText && openAiConfigured()) {
    const useRag = context?.useRag !== false;
    const query = (context?.topic || documentText.slice(0, 200)).trim();
    let rag = { contextText: documentText.slice(0, 8000), citations: [] };
    if (useRag) {
      try {
        rag = await getRagContext({ query, documentText, useRag: true, topK: 5, userId });
      } catch (e) {
        console.warn('[notes] RAG:', e.message);
      }
    }
    try {
      const system = `You are a study assistant. Organize the following content into structured notes. Return valid JSON only with keys: organizedMarkdown (string, markdown), outline (array of section titles), glossary (array of { term, definition }). No other text.`;
      const userContent = `Content:\n${rag.contextText.slice(0, 6000)}\n\nProvide the JSON.`;
      const { content } = await chatCompletion({
        system,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.3,
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });
      let parsed = {};
      try {
        parsed = JSON.parse(content || '{}');
      } catch {}
      const organizedMarkdown = parsed.organizedMarkdown ?? parsed.markdown ?? '';
      const outline = Array.isArray(parsed.outline) ? parsed.outline : [];
      const glossary = Array.isArray(parsed.glossary) ? parsed.glossary : [];
      const reply = organizedMarkdown || [outline.join('\n'), glossary.map((g) => `${g.term}: ${g.definition}`).join('\n')].join('\n\n');
      const citations = rag.citations.map((c) => ({ id: c.id, content: c.content?.slice(0, 200), score: c.score }));
      return {
        reply,
        suggestions: [],
        structured: { organizedMarkdown, outline, glossary },
        citations,
      };
    } catch (e) {
      console.warn('[notes] OpenAI:', e.message);
    }
  }

  const list = getLastNotes(db, userId);
  if (list.length === 0) {
    return {
      reply: 'No notes found. Add notes or upload a doc, then use /notes.',
      suggestions: [],
      structured: { notes: [] },
      citations: [],
    };
  }
  const lines = list.map((n, i) => {
    const snippet = (n.content || n.title || '').slice(0, SNIPPET_LEN).replace(/\n/g, ' ');
    return `${i + 1}. ${n.title || '(no title)'} — ${n.createdAt}\n   ${snippet}${(n.content && n.content.length > SNIPPET_LEN) ? '...' : ''}`;
  });
  const reply = ['Your latest notes (use /notes show <n> to open):', '', ...lines].join('\n');
  return {
    reply,
    suggestions: [],
    structured: { notes: list.map((n) => ({ id: n.id, title: n.title, snippet: (n.content || '').slice(0, 100) })) },
    citations: [],
  };
}
