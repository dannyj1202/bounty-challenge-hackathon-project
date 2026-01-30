import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { events, plan, assignments } from '../api/client';

export default function Calendar() {
  const { userId } = useAuth();
  const [eventList, setEventList] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scheduleResult, setScheduleResult] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const load = () => {
    if (!userId) return;
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    Promise.all([
      events.list(userId, start, end),
      assignments.list(userId),
    ]).then(([ev, as]) => {
      setEventList(ev);
      setAssignmentsList(as.filter((a) => !a.completed && a.dueDate));
    }).catch(() => {});
  };

  useEffect(load, [userId]);

  const addEvent = async (e) => {
    e.preventDefault();
    if (!newTitle || !newStart || !newEnd) return;
    setError('');
    try {
      const created = await events.create({ userId, title: newTitle, startAt: newStart, endAt: newEnd, type: 'personal' });
      setEventList((prev) => [...prev, created]);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
    } catch (err) {
      setError(err.message);
    }
  };

  const generateSchedule = async () => {
    setLoading(true);
    setError('');
    setScheduleResult(null);
    try {
      const result = await plan.generate(userId);
      setScheduleResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const acceptBlock = async (block) => {
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today}T${block.start}:00`;
    const end = `${today}T${block.end}:00`;
    setError('');
    try {
      const created = await events.create({ userId, title: block.title || 'Study block', startAt: start, endAt: end, type: 'personal', sourceId: 'plan' });
      setEventList((prev) => [...prev, created]);
      setScheduleResult((prev) => prev ? { ...prev, blocks: prev.blocks.filter((b) => b !== block) } : null);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEvent = async (id) => {
    try {
      await events.delete(id);
      setEventList((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Calendar</h2>
      <div className="card">
        <h3>Add personal event</h3>
        <form onSubmit={addEvent} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Title</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Football practice" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Start</label>
            <input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>End</label>
            <input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} required />
          </div>
          <button type="submit" className="btn">Add event</button>
        </form>
      </div>

      <div className="card">
        <h3>Assignment due dates</h3>
        <ul className="widget-list">
          {assignmentsList.length === 0 && <li>No upcoming assignments</li>}
          {assignmentsList.map((a) => (
            <li key={a.id}><strong>{a.title}</strong> — Due {a.dueDate}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Events (list view)</h3>
        <ul className="widget-list">
          {eventList.length === 0 && <li>No events</li>}
          {eventList.map((e) => (
            <li key={e.id} className="event-item">
              <strong>{e.title}</strong> {e.startAt} – {e.endAt}
              <button type="button" className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => deleteEvent(e.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <button type="button" className="btn" onClick={generateSchedule} disabled={loading}>
          {loading ? 'Generating…' : 'Generate study schedule around my calendar'}
        </button>
        {error && <p className="error">{error}</p>}
        {scheduleResult && scheduleResult.blocks && (
          <div style={{ marginTop: 16 }}>
            <p><strong>Suggested study blocks</strong> — Accept to create events.</p>
            {scheduleResult.explanation && <p style={{ color: 'var(--text-muted)' }}>{scheduleResult.explanation}</p>}
            <ul className="widget-list">
              {scheduleResult.blocks.map((block, i) => (
                <li key={i}>
                  {block.start}–{block.end}: {block.title} {block.suggestedTopic && `(${block.suggestedTopic})`}
                  <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => acceptBlock(block)}>Accept</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
