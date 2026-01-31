import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { assignments, copilot, notifications, user, docs } from '../api/client';

const WIDGET_IDS = ['notifications', 'tasks', 'copilot'];
const DOC_COMMAND_CHIPS = ['/summarize', '/flashcards', '/quiz', '/notes'];

export default function Home() {
  const { userId } = useAuth();
  const { canUseCopilot, copilotRemaining, copilotLimit, incrementCopilotUsage, plan } = usePlan();
  const [widgets, setWidgets] = useState(WIDGET_IDS);
  const [tasks, setTasks] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completeModal, setCompleteModal] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      assignments.list(userId),
      notifications.list(userId),
      user.getPreferences(userId).catch(() => ({ widgets: '[]' })),
    ]).then(([t, n, prefs]) => {
      setTasks(t);
      setNotifs(n);
      try {
        const w = JSON.parse(prefs.widgets || '[]');
        if (Array.isArray(w) && w.length) setWidgets(w);
      } catch {}
    }).catch(() => {});
  }, [userId]);

  const buildStreamPayload = (userMsg) => ({
    userId,
    messages: [...messages, userMsg],
    ...(activeDocument?.noteId ? { noteId: activeDocument.noteId } : {}),
  });

  const sendMessage = async (commandOverride = null) => {
    const raw = commandOverride ?? input.trim();
    if (!raw) return;
    if (!raw.startsWith('/')) {
      setError('Commands only. Use a command starting with / (e.g. /help, /plan) or click a chip.');
      return;
    }
    if (!canUseCopilot) {
      setError('Daily copilot limit reached. Upgrade to Elite for unlimited prompts.');
      return;
    }
    const userMsg = { role: 'user', content: raw };
    setMessages((m) => [...m, userMsg]);
    if (!commandOverride) setInput('');
    setLoading(true);
    setError('');
    setMessages((m) => [...m, { role: 'assistant', reply: '', suggestions: [], streaming: true }]);
    try {
      let fullReply = '';
      let suggestions = [];
      for await (const event of copilot.chatStream(buildStreamPayload(userMsg))) {
        if (event.type === 'chunk' && event.text) {
          fullReply += event.text;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, reply: fullReply, streaming: true };
            return next;
          });
        } else if (event.type === 'suggestions' && Array.isArray(event.suggestions)) {
          suggestions = event.suggestions;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, reply: fullReply, suggestions, streaming: false };
            return next;
          });
        } else if (event.type === 'error') {
          setError(event.message || 'Stream error');
        } else if (event.type === 'done') {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false };
            return next;
          });
        }
      }
      incrementCopilotUsage();
    } catch (err) {
      setError(err.message);
      setMessages((m) => m.filter((msg) => !(msg.role === 'assistant' && msg.streaming)));
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !userId) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type?.toLowerCase())) {
      setUploadError('Only PDF, PNG, and JPG are allowed.');
      return;
    }
    setUploadLoading(true);
    setUploadError('');
    try {
      const res = await docs.ingest(userId, file, file.name || '');
      setActiveDocument({ noteId: res.noteId, title: res.title || file.name });
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAcceptSuggestion = async (id) => {
    if (!userId) return;
    setError('');
    try {
      await copilot.acceptSuggestion(id, userId);
      setMessages((m) =>
        m.map((msg) =>
          msg.role === 'assistant' && msg.suggestions
            ? { ...msg, suggestions: msg.suggestions.filter((s) => s.id !== id) }
            : msg
        )
      );
      const list = await assignments.list(userId);
      setTasks(list);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectSuggestion = async (id) => {
    if (!userId) return;
    setError('');
    try {
      await copilot.rejectSuggestion(id, userId);
      setMessages((m) =>
        m.map((msg) =>
          msg.role === 'assistant' && msg.suggestions
            ? { ...msg, suggestions: msg.suggestions.filter((s) => s.id !== id) }
            : msg
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const addTask = async () => {
    const title = window.prompt('Assignment title');
    if (!title) return;
    setError('');
    try {
      const created = await assignments.create({ userId, title });
      setTasks((t) => [created, ...t]);
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTask = async (id, difficulty, comment) => {
    setError('');
    try {
      await assignments.complete(id, { difficulty, comment });
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, completed: 1, completedAt: new Date().toISOString() } : x)));
      setCompleteModal(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const leftWidgets = widgets.filter((w) => w === 'notifications' || w === 'tasks');
  const centerCopilot = widgets.includes('copilot');

  return (
    <div className="grid-3">
      <div>
        {leftWidgets.includes('notifications') && (
          <div className="card">
            <h3>Notifications</h3>
            <ul className="widget-list">
              {notifs.length === 0 && <li>No notifications</li>}
              {notifs.slice(0, 5).map((n) => (
                <li key={n.id}><strong>{n.title}</strong><br /><small>{n.body}</small></li>
              ))}
            </ul>
          </div>
        )}
        {leftWidgets.includes('tasks') && (
          <div className="card">
            <h3>Assignments</h3>
            <button type="button" className="btn" onClick={addTask}>Add</button>
            <ul className="widget-list" style={{ marginTop: 12 }}>
              {tasks.slice(0, 8).map((t) => (
                <li key={t.id} className={`task-item ${t.completed ? 'done' : ''}`}>
                  <input type="checkbox" checked={!!t.completed} onChange={() => !t.completed && setCompleteModal(t)} />
                  <span className="task-title">{t.title}</span>
                  {t.dueDate && <small>{t.dueDate}</small>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        {centerCopilot && (
          <div className="card">
            <h3>Copilot</h3>
            {plan === 'free' && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
                {copilotRemaining !== null && (
                  <>Daily prompts: {copilotRemaining} of {copilotLimit} left. Upgrade to Elite for unlimited.</>
                )}
              </p>
            )}
            {!canUseCopilot && (
              <div className="copilot-limit-cta">
                You&apos;ve used all {copilotLimit} copilot prompts for today. <Link to="/pricing">Upgrade to Elite</Link> for unlimited prompts.
              </div>
            )}
            <div className="doc-upload-section" style={{ marginBottom: 12 }}>
              <input type="file" ref={fileInputRef} accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={handleDocUpload} style={{ display: 'none' }} />
              <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={!userId || uploadLoading}>
                {uploadLoading ? 'Uploading…' : 'Upload PDF / image'}
              </button>
              {uploadError && <span className="error" style={{ marginLeft: 8 }}>{uploadError}</span>}
              {activeDocument && (
                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                  Active document: <strong>{activeDocument.title}</strong>
                  <button type="button" className="btn btn-secondary" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }} onClick={() => setActiveDocument(null)}>Clear</button>
                </div>
              )}
              {activeDocument && (
                <div className="command-chips" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DOC_COMMAND_CHIPS.map((cmd) => (
                    <button key={cmd} type="button" className="btn btn-secondary command-chip" onClick={() => sendMessage(cmd)} disabled={!canUseCopilot || loading}>
                      {cmd}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              {messages.map((m, i) => (
                <div key={i} className={`copilot-message ${m.role}`}>
                  {m.role === 'user' ? m.content : (
                    <>
                      <div>
                        {m.streaming && !m.reply ? 'Copilot is thinking…' : m.reply}
                      </div>
                      {m.explanation && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>{m.explanation}</div>}
                      {m.confidence != null && <div className="confidence">Confidence: {(m.confidence * 100).toFixed(0)}%</div>}
                      {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                        <div className="suggestion-cards" style={{ marginTop: 12 }}>
                          {m.suggestions.map((s) => (
                            <div key={s.id} className="suggestion-card">
                              <div className="suggestion-card-type">{s.type}</div>
                              <div className="suggestion-card-label">{s.label || s.type}</div>
                              <div className="suggestion-card-preview">
                                {(() => {
                                  const p = s.payload;
                                  if (p == null) return '—';
                                  const str = typeof p === 'string' ? p : JSON.stringify(p);
                                  return str.length > 80 ? str.slice(0, 80) + '…' : str;
                                })()}
                              </div>
                              <div className="suggestion-card-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => handleRejectSuggestion(s.id)}>Reject</button>
                                <button type="button" className="btn" onClick={() => handleAcceptSuggestion(s.id)}>Accept</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
            {input.trim() && !input.trim().startsWith('/') && (
              <p className="copilot-tip" style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Commands start with /. Try: {DOC_COMMAND_CHIPS.map((c) => (
                  <button key={c} type="button" className="link-like" onClick={() => setInput(c)} style={{ marginRight: 8, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>{c}</button>
                ))}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" className="form-group" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a command (e.g. /help, /plan)…" disabled={!canUseCopilot} />
              <button type="button" className="btn" onClick={() => sendMessage()} disabled={loading || !canUseCopilot}>{loading ? '…' : 'Send'}</button>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="card">
          <h3>Tasks</h3>
          <button type="button" className="btn btn-secondary" onClick={addTask}>Add assignment</button>
          <ul className="widget-list" style={{ marginTop: 12 }}>
            {tasks.map((t) => (
              <li key={t.id} className={`task-item ${t.completed ? 'done' : ''}`}>
                <input type="checkbox" checked={!!t.completed} onChange={() => !t.completed && setCompleteModal(t)} />
                <span className="task-title">{t.title}</span>
                {t.dueDate && <small>{t.dueDate}</small>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {completeModal && (
        <div className="modal-overlay" onClick={() => setCompleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mark complete: {completeModal.title}</h3>
            <p>Optional: rate difficulty and add a comment (AI suggests, you control).</p>
            <div className="form-group">
              <label>Difficulty</label>
              <select id="complete-difficulty">
                <option value="">—</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Comment</label>
              <input type="text" id="complete-comment" placeholder="Optional" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setCompleteModal(null)}>Cancel</button>
              <button type="button" className="btn" onClick={() => {
                const d = document.getElementById('complete-difficulty')?.value;
                const c = document.getElementById('complete-comment')?.value;
                completeTask(completeModal.id, d, c);
              }}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
