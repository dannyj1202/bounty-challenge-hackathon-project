import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, ClipboardEdit, Share2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Notes() {
  const { userId } = useAuth();

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [pages, setPages] = useState([]);

  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);

  const selectedNotebook = useMemo(
    () => notebooks.find(n => n.id === selectedNotebookId) || null,
    [notebooks, selectedNotebookId]
  );
  const selectedSection = useMemo(
    () => sections.find(s => s.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const loadNotebooks = async () => {
    if (!userId) return;
    setLoading(true);
    setErr('');
    setNotebooks([]);
    setSections([]);
    setPages([]);
    setSelectedNotebookId(null);
    setSelectedSectionId(null);

    try {
      const res = await fetch(`${API_BASE}/api/onenote/notebooks?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load notebooks');
      setNotebooks(data.notebooks || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSections = async (notebookId) => {
    if (!userId || !notebookId) return;
    setLoading(true);
    setErr('');
    setSections([]);
    setPages([]);
    setSelectedNotebookId(notebookId);
    setSelectedSectionId(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load sections');
      setSections(data.sections || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPages = async (sectionId) => {
    if (!userId || !sectionId) return;
    setLoading(true);
    setErr('');
    setPages([]);
    setSelectedSectionId(sectionId);

    try {
      const res = await fetch(
        `${API_BASE}/api/onenote/sections/${encodeURIComponent(sectionId)}/pages?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load pages');
      setPages(data.pages || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const paneBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/80 overflow-hidden';
  const paneHeader = 'px-4 py-3 border-b border-gray-200 dark:border-violet-500/20 bg-gray-100 dark:bg-black/20 flex items-center justify-between';
  const listItem = (active) =>
    `px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-violet-500/10 last:border-0 transition-all duration-200 ${
      active ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border-l-2 border-l-violet-500 dark:border-l-violet-400' : 'text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
    }`;

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-6xl mx-auto px-6 py-8 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Notes</h2>

      {/* OneNote Explorer — 3-column dark layout */}
      <div className={`${cardBase} p-5 mb-8`}>
        <div className="flex flex-wrap items-start gap-4 mb-4">
          <img
            src="/onenote-logo.png"
            alt=""
            className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl object-contain bg-white dark:bg-white/5 ring-1 ring-gray-200 dark:ring-violet-500/20"
            aria-hidden
          />
          <div className="min-w-0 flex-1 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-1 flex items-center gap-2">
                <BookOpen className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
                Sync OneNote
              </h3>
              <p className="text-gray-400 text-sm">
                Browse notebooks → sections → pages. Click Open to launch in OneNote.
              </p>
            </div>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50"
              onClick={loadNotebooks}
              disabled={loading || !userId}
            >
              {loading ? 'Loading…' : 'Load OneNote'}
            </button>
          </div>
        </div>

        {err && <p className="text-red-400 text-sm mb-4">{err}</p>}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-4">
          {/* Notebooks */}
          <div className={paneBase}>
            <div className={paneHeader}>
              <span className="font-semibold text-gray-900 dark:text-white">Notebooks</span>
              {selectedNotebook?.url && (
                <a href={selectedNotebook.url} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200 text-sm transition-colors">
                  Open
                </a>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notebooks.length === 0 && (
                <div className="px-4 py-4 text-gray-400 text-sm">
                  {loading ? 'Loading…' : 'No notebooks loaded yet.'}
                </div>
              )}
              {notebooks.map((n) => (
                <div
                  key={n.id}
                  className={listItem(n.id === selectedNotebookId)}
                  onClick={() => loadSections(n.id)}
                  title={n.name}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{n.name}</div>
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-violet-300 hover:text-violet-200 mt-1 block">
                      Open in OneNote
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div className={paneBase}>
            <div className={paneHeader}>
              <span className="font-semibold text-gray-900 dark:text-white">Sections</span>
              {selectedSection?.url && (
                <a href={selectedSection.url} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200 text-sm transition-colors">
                  Open
                </a>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!selectedNotebookId && (
                <div className="px-4 py-4 text-gray-400 text-sm">Select a notebook</div>
              )}
              {selectedNotebookId && sections.length === 0 && (
                <div className="px-4 py-4 text-gray-400 text-sm">
                  {loading ? 'Loading…' : 'No sections found.'}
                </div>
              )}
              {sections.map((s) => (
                <div
                  key={s.id}
                  className={listItem(s.id === selectedSectionId)}
                  onClick={() => loadPages(s.id)}
                  title={s.name}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-violet-300 hover:text-violet-200 mt-1 block">
                      Open section
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div className={paneBase}>
            <div className={paneHeader}>
              <span className="font-semibold text-gray-900 dark:text-white">Pages</span>
              <span className="text-gray-400 text-xs">
                {pages.length ? `${pages.length} loaded` : ''}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!selectedSectionId && (
                <div className="px-4 py-4 text-gray-400 text-sm">Select a section</div>
              )}
              {selectedSectionId && pages.length === 0 && (
                <div className="px-4 py-4 text-gray-400 text-sm">
                  {loading ? 'Loading…' : 'No pages found.'}
                </div>
              )}
              {pages.map((p) => (
                <div key={p.id} className="px-4 py-3 border-b border-gray-200 dark:border-violet-500/10 last:border-0 text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                  <div className="font-medium text-gray-900 dark:text-white">{p.title}</div>
                  <div className="flex flex-wrap gap-3 items-center mt-2 text-xs">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200">Open page</a>
                    ) : (
                      <span className="text-gray-500">No link</span>
                    )}
                    {p.lastModifiedDateTime && (
                      <span className="text-gray-500">
                        Updated {new Date(p.lastModifiedDateTime).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Paste / upload — dark textarea, purple focus, voice CTA */}
      <div className={`${cardBase} p-5 mb-6`}>
        <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-2 flex items-center gap-2">
          <ClipboardEdit className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Paste text or upload (optional)
        </h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your notes here..."
          className="w-full min-h-40 py-3 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-y transition-all duration-200"
        />
      </div>

      {/* Export / Save to OneNote */}
      <div className={`${cardBase} p-5`}>
        <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-2 flex items-center gap-2">
          <Share2 className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Export / Save to OneNote
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          (Optional) You can keep this as a “future work” bullet if time is tight.
        </p>
        <button type="button" className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]">
          Save to OneNote
        </button>
      </div>
    </div>
  );
}
