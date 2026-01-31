import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { assignments, copilot, notifications, user, docs, tasks as tasksApi } from '../api/client';

const WIDGET_IDS = ['notifications', 'tasks', 'copilot'];
const COMMAND_CHIPS = ['/help', '/plan', '/summarize', '/flashcards', '/quiz', '/notes', '/check', '/tasks', '/deadline', '/reschedule'];

export default function Home() {
  const { userId } = useAuth();
  const { canUseCopilot, copilotRemaining, copilotLimit, incrementCopilotUsage, plan } = usePlan();
  const [widgets, setWidgets] = useState(WIDGET_IDS);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [taskList, setTaskList] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', dueDate: '', difficulty: 'medium', notes: '' });
  const [taskModal, setTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
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
      tasksApi.list(userId),
      notifications.list(userId),
      user.getPreferences(userId).catch(() => ({ widgets: '[]' })),
    ]).then(([a, t, n, prefs]) => {
      setAssignmentsList(a);
      setTaskList(t);
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
    ...(activeDocument?.noteId ? { noteId: activeDocument.noteId, attachments: [activeDocument.noteId], useRag: true } : {}),
  });

  const sendMessage = async (commandOverride = null) => {
    const raw = commandOverride ?? input.trim();
    if (!raw) return;
    if (!raw.startsWith('/')) {
      setError('');
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
      let structured = null;
      let citations = [];
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
        } else if (event.type === 'structured') {
          structured = event.structured;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, structured };
            return next;
          });
        } else if (event.type === 'citations' && Array.isArray(event.citations)) {
          citations = event.citations;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, citations };
            return next;
          });
        } else if (event.type === 'error') {
          setError(event.message || 'Stream error');
        } else if (event.type === 'done') {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false, ...(structured != null && { structured }), ...(citations.length > 0 && { citations }) };
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
      setAssignmentsList(list);
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

  const addAssignment = async (e) => {
    e?.preventDefault();
    if (!newAssignment.title?.trim()) return;
    setError('');
    try {
      const created = await assignments.create({
        userId,
        title: newAssignment.title.trim(),
        dueDate: newAssignment.dueDate || null,
        difficulty: newAssignment.difficulty || null,
        notes: newAssignment.notes?.trim() || null,
      });
      setAssignmentsList((prev) => [created, ...prev]);
      setNewAssignment({ title: '', dueDate: '', difficulty: 'medium', notes: '' });
      setAssignmentModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const addPersonalTask = async (e) => {
    e?.preventDefault();
    if (!newTaskTitle?.trim()) return;
    setError('');
    try {
      const created = await tasksApi.create({
        userId,
        title: newTaskTitle.trim(),
        dueDate: newTaskDue || null,
      });
      setTaskList((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskDue('');
      setTaskModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTaskItem = async (id) => {
    try {
      await tasksApi.complete(id);
      setTaskList((prev) => prev.map((t) => (t.id === id ? { ...t, completed: 1 } : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTaskItem = async (id) => {
    try {
      await tasksApi.delete(id);
      setTaskList((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTask = async (id, difficulty, comment) => {
    setError('');
    try {
      await assignments.complete(id, { difficulty, comment });
      setAssignmentsList((t) => t.map((x) => (x.id === id ? { ...x, completed: 1, completedAt: new Date().toISOString() } : x)));
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
          <>
            <div className="card">
              <h3>Assignments</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deadline, difficulty, and notes are used when generating your study schedule.</p>
              <button type="button" className="btn" onClick={() => setAssignmentModal(true)}>Add assignment</button>
              <ul className="widget-list" style={{ marginTop: 12 }}>
                {assignmentsList.filter((a) => !a.completed).slice(0, 8).map((a) => (
                  <li key={a.id} className={`task-item ${a.completed ? 'done' : ''}`}>
                    <input type="checkbox" checked={!!a.completed} onChange={() => !a.completed && setCompleteModal(a)} />
                    <span className="task-title">{a.title}</span>
                    {a.dueDate && <small>Due {a.dueDate}</small>}
                    {a.difficulty && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>({a.difficulty})</span>}
                    {a.comment && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.comment.slice(0, 60)}{a.comment.length > 60 ? '…' : ''}</div>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>Tasks</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Personal tasks and auto-created “Work on…” from assignments.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setTaskModal(true)}>Add personal task</button>
              <ul className="widget-list" style={{ marginTop: 12 }}>
                {taskList.filter((t) => !t.completed).slice(0, 10).map((t) => (
                  <li key={t.id} className={`task-item ${t.completed ? 'done' : ''}`}>
                    <input type="checkbox" checked={!!t.completed} onChange={() => !t.completed && completeTaskItem(t.id)} />
                    <span className="task-title">{t.title}</span>
                    {t.dueDate && <small>Due {t.dueDate}</small>}
                    <button type="button" className="btn btn-secondary" style={{ marginLeft: 8, padding: '2px 6px', fontSize: 11 }} onClick={() => deleteTaskItem(t.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </>
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
                <span className="badge" style={{ marginLeft: 8, padding: '4px 8px', fontSize: 12, background: 'var(--primary)', color: 'white', borderRadius: 4 }}>
                  Uploaded: 1 — {activeDocument.title}
                </span>
              )}
              {activeDocument && (
                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setActiveDocument(null)}>Clear</button>
                </div>
              )}
              <div className="command-chips" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMMAND_CHIPS.map((cmd) => (
                  <button key={cmd} type="button" className="btn btn-secondary command-chip" onClick={() => sendMessage(cmd)} disabled={!canUseCopilot || loading}>
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              {messages.map((m, i) => (
                <div key={i} className={`copilot-message ${m.role}`}>
                  {m.role === 'user' ? m.content : (
                    <>
                      <div>
                        {m.streaming && !m.reply ? 'Copilot is thinking…' : m.reply}
                      </div>
                      {m.structured && (
                        <div className="structured-output" style={{ marginTop: 12, padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                          {m.structured.keyPoints && (
                            <div><strong>Key points</strong><ul>{m.structured.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
                          )}
                          {m.structured.cards && (
                            <div><strong>Flashcards</strong><ul>{m.structured.cards.map((c, i) => <li key={i}><strong>Q:</strong> {c.q} <strong>A:</strong> {c.a}</li>)}</ul></div>
                          )}
                          {m.structured.questions && (
                            <div><strong>Questions</strong><ul>{m.structured.questions.map((q, i) => <li key={i}>{q.q} → {q.answer}</li>)}</ul></div>
                          )}
                          {m.structured.outline && (
                            <div><strong>Outline</strong><ul>{m.structured.outline.map((o, i) => <li key={i}>{o}</li>)}</ul></div>
                          )}
                          {m.structured.glossary && (
                            <div><strong>Glossary</strong><ul>{m.structured.glossary.map((g, i) => <li key={i}><strong>{g.term}</strong>: {g.definition}</li>)}</ul></div>
                          )}
                          {m.structured.commands && (
                            <div><strong>Commands</strong><ul>{m.structured.commands.map((c, i) => <li key={i}>{c.cmd}: {c.description}</li>)}</ul></div>
                          )}
                        </div>
                      )}
                      {m.citations && m.citations.length > 0 && (
                        <div className="citations" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          <strong>Sources:</strong> {m.citations.map((c, i) => <span key={i} title={c.content}>[{c.id}] </span>)}
                        </div>
                      )}
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
                Commands start with /. Try: {COMMAND_CHIPS.slice(0, 5).map((c) => (
                  <button key={c} type="button" className="link-like" onClick={() => setInput(c)} style={{ marginRight: 8, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>{c}</button>
                ))} or click a chip above.
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
          <h3>Upcoming</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assignments and tasks with due dates feed into your study schedule.</p>
          <Link to="/calendar" className="btn">Calendar &amp; generate study schedule</Link>
        </div>
      </div>

      {assignmentModal && (
        <div className="modal-overlay" onClick={() => setAssignmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add assignment</h3>
            <form onSubmit={addAssignment}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={newAssignment.title} onChange={(e) => setNewAssignment((a) => ({ ...a, title: e.target.value }))} placeholder="e.g. Math homework ch.3" required />
              </div>
              <div className="form-group">
                <label>Deadline (optional)</label>
                <input type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment((a) => ({ ...a, dueDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <select value={newAssignment.difficulty} onChange={(e) => setNewAssignment((a) => ({ ...a, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes / important info (optional)</label>
                <textarea value={newAssignment.notes} onChange={(e) => setNewAssignment((a) => ({ ...a, notes: e.target.value }))} placeholder="e.g. Focus on problem set 2" rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignmentModal(false)}>Cancel</button>
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal && (
        <div className="modal-overlay" onClick={() => setTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add personal task</h3>
            <form onSubmit={addPersonalTask}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Review notes" required />
              </div>
              <div className="form-group">
                <label>Due date (optional)</label>
                <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
