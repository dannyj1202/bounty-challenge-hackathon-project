import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { assignments, copilot, notifications, user } from '../api/client';

const WIDGET_IDS = ['notifications', 'tasks', 'copilot'];

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

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!canUseCopilot) {
      setError('Daily copilot limit reached. Upgrade to Elite for unlimited prompts.');
      return;
    }
    const userMsg = { role: 'user', content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const res = await copilot.chat({ userId, messages: [...messages, userMsg] });
      incrementCopilotUsage();
      setMessages((m) => [...m, { role: 'assistant', ...res }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            <div style={{ marginBottom: 12 }}>
              {messages.map((m, i) => (
                <div key={i} className={`copilot-message ${m.role}`}>
                  {m.role === 'user' ? m.content : (
                    <>
                      <div>{m.reply}</div>
                      {m.explanation && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>{m.explanation}</div>}
                      {m.confidence != null && <div className="confidence">Confidence: {(m.confidence * 100).toFixed(0)}%</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" className="form-group" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ask the copilot…" disabled={!canUseCopilot} />
              <button type="button" className="btn" onClick={sendMessage} disabled={loading || !canUseCopilot}>{loading ? '…' : 'Send'}</button>
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
