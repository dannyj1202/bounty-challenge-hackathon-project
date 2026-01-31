import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Notes() {
  const { userId } = useAuth();

  // Your existing note UI state (keep minimal)
  const [text, setText] = useState('');

  // OneNote explorer state
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

  const paneStyle = {
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 10,
    background: 'white',
    overflow: 'hidden'
  };

  const headerStyle = {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    background: '#f7f7f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const listItem = (active) => ({
    padding: '10px 12px',
    cursor: 'pointer',
    background: active ? '#eef3ff' : 'white',
    borderBottom: '1px solid rgba(0,0,0,0.06)'
  });

  return (
    <div>
      <h2>Notes</h2>

      {/* ✅ OneNote Explorer */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>OneNote</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Browse notebooks → sections → pages. Click Open to launch in OneNote.
            </p>
          </div>
          <button className="btn" type="button" onClick={loadNotebooks} disabled={loading || !userId}>
            {loading ? 'Loading…' : 'Load OneNote'}
          </button>
        </div>

        {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12, marginTop: 12 }}>
          {/* Notebooks */}
          <div style={paneStyle}>
            <div style={headerStyle}>
              <strong>Notebooks</strong>
              {selectedNotebook?.url && (
                <a href={selectedNotebook.url} target="_blank" rel="noreferrer">Open</a>
              )}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {notebooks.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>
                  {loading ? 'Loading…' : 'No notebooks loaded yet.'}
                </div>
              )}
              {notebooks.map((n) => (
                <div
                  key={n.id}
                  style={listItem(n.id === selectedNotebookId)}
                  onClick={() => loadSections(n.id)}
                  title={n.name}
                >
                  <div style={{ fontWeight: 600 }}>{n.name}</div>
                  {n.url && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <a href={n.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Open in OneNote
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div style={paneStyle}>
            <div style={headerStyle}>
              <strong>Sections</strong>
              {selectedSection?.url && (
                <a href={selectedSection.url} target="_blank" rel="noreferrer">Open</a>
              )}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {!selectedNotebookId && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>
                  Select a notebook
                </div>
              )}
              {selectedNotebookId && sections.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>
                  {loading ? 'Loading…' : 'No sections found.'}
                </div>
              )}
              {sections.map((s) => (
                <div
                  key={s.id}
                  style={listItem(s.id === selectedSectionId)}
                  onClick={() => loadPages(s.id)}
                  title={s.name}
                >
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.url && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Open section
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div style={paneStyle}>
            <div style={headerStyle}>
              <strong>Pages</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {pages.length ? `${pages.length} loaded` : ''}
              </span>
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {!selectedSectionId && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>
                  Select a section
                </div>
              )}
              {selectedSectionId && pages.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>
                  {loading ? 'Loading…' : 'No pages found.'}
                </div>
              )}
              {pages.map((p) => (
                <div key={p.id} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer">Open page</a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No link</span>
                    )}
                    {p.lastModifiedDateTime && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
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

      {/* Existing area (keep) */}
      <div className="card">
        <h3>Paste text or upload (optional)</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your notes here..."
          style={{ width: '100%', minHeight: 160 }}
        />
        <button type="button" className="btn" style={{ marginTop: 10 }}>
          Voice record (speech-to-text)
        </button>
      </div>

      <div className="card">
        <h3>Actions</h3>
        <p style={{ color: 'var(--text-muted)' }}>AI suggests; you control (accept / edit / ignore).</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn">Summarize</button>
          <button type="button" className="btn">Translate</button>
          <button type="button" className="btn">Generate flashcards</button>
          <button type="button" className="btn">Generate practice Qs</button>
        </div>
      </div>

      <div className="card">
        <h3>Export / Save to OneNote</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          (Optional) You can keep this as a “future work” bullet if time is tight.
        </p>
        <button type="button" className="btn">Save to OneNote</button>
      </div>
    </div>
  );
}