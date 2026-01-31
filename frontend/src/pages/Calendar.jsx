import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { events, plan, assignments } from '../api/client';

// ✅ FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// Use relative /api so Vite proxy works; set VITE_API_BASE only if backend is on another origin.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Calendar() {
  const { userId } = useAuth();

  const [eventList, setEventList] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [scheduleResult, setScheduleResult] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [syncNote, setSyncNote] = useState('');

  // Load existing events + assignments from your current API
  const load = () => {
    if (!userId) return;

    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    Promise.all([
      events.list(userId, start, end),
      assignments.list(userId),
    ])
      .then(([ev, as]) => {
        setEventList(ev);
        setAssignmentsList(as.filter((a) => !a.completed && a.dueDate));
      })
      .catch(() => {});
  };

  useEffect(load, [userId]);

  // ✅ Sync Outlook -> backend /api/calendar/sync (mock today, real when token exists)
  const syncOutlook = async () => {
    if (!userId) return;
    setSyncing(true);
    setError('');
    setSyncNote('');

    try {
      const now = new Date();
      const startISO = now.toISOString();
      const endISO = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // IMPORTANT:
      // When your friend finishes Entra ID, you will add:
      // Authorization: `Bearer ${accessToken}`
      const res = await fetch(`${API_BASE}/api/calendar/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, start: startISO, end: endISO })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to sync Outlook');

      // Backend returns { id, title, startAt, endAt, type, sourceId } (already normalized)
      const incoming = (data.events || []).map((e) => ({
        id: e.id || `outlook-${Math.random()}`,
        title: e.title || e.subject || 'Outlook event',
        startAt: e.startAt || e.start?.dateTime || e.startTime,
        endAt: e.endAt || e.end?.dateTime || e.endTime,
        type: e.type || 'academic',
        sourceId: e.sourceId || 'outlook',
      }));

      // Refetch from API so calendar shows DB state (includes upserted Outlook events)
      load();

      setSyncNote(
        data.source === 'outlook'
          ? (incoming.length === 0
              ? '✅ Synced 0 Outlook events (none in the next 30 days).'
              : `✅ Synced ${incoming.length} Outlook events.`)
          : `✅ Loaded ${incoming.length} mock events.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Add personal event (your existing backend route)
  const addEvent = async (e) => {
    e.preventDefault();
    if (!newTitle || !newStart || !newEnd) return;

    setError('');
    try {
      const created = await events.create({
        userId,
        title: newTitle,
        startAt: newStart,
        endAt: newEnd,
        type: 'personal'
      });

      setEventList((prev) => [...prev, created]);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Generate study schedule (existing)
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

  // Accept study block => create an event (existing events.create)
  const acceptBlock = async (block) => {
    const today = new Date().toISOString().slice(0, 10);
    const startAt = `${today}T${block.start}:00`;
    const endAt = `${today}T${block.end}:00`;

    setError('');
    try {
      const created = await events.create({
        userId,
        title: block.title || 'Study block',
        startAt,
        endAt,
        type: 'personal',
        sourceId: 'plan'
      });

      setEventList((prev) => [...prev, created]);
      setScheduleResult((prev) =>
        prev ? { ...prev, blocks: prev.blocks.filter((b) => b !== block) } : null
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete event (existing)
  const deleteEvent = async (id) => {
    try {
      await events.delete(id);
      setEventList((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // ✅ Convert your eventList => FullCalendar events
  const calendarEvents = useMemo(() => {
    return eventList
      .filter(e => e.startAt && e.endAt)
      .map((e) => ({
        id: String(e.id),
        title: e.title || '(No title)',
        start: e.startAt,
        end: e.endAt,
        extendedProps: { raw: e }
      }));
  }, [eventList]);

  // Click on calendar event => delete
  const onEventClick = async (clickInfo) => {
    const raw = clickInfo.event.extendedProps?.raw;
    if (!raw?.id) return;

    const ok = window.confirm(`Delete "${clickInfo.event.title}"?`);
    if (!ok) return;

    await deleteEvent(raw.id);
  };

  return (
    <div>
      <h2>Calendar</h2>

      {/* Outlook Sync */}
      <div className="card">
        <h3>Outlook Calendar</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Sync commitments from your Microsoft Outlook Calendar.
        </p>
        <button type="button" className="btn" onClick={syncOutlook} disabled={syncing || !userId}>
          {syncing ? 'Syncing…' : 'Sync Outlook Calendar'}
        </button>
        {syncNote && <p style={{ marginTop: 10, color: 'var(--text-muted)' }}>{syncNote}</p>}
      </div>

      {/* ✅ Real Calendar Grid */}
      <div className="card">
        <h3>Calendar view</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Events appear on the exact date/time blocks. Click an event to delete it.
        </p>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          height="auto"
          events={calendarEvents}
          eventClick={onEventClick}
        />
      </div>

      {/* Add personal event */}
      <div className="card">
        <h3>Add personal event</h3>
        <form onSubmit={addEvent} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Football practice"
              required
            />
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

      {/* Assignment due dates */}
      <div className="card">
        <h3>Assignment due dates</h3>
        <ul className="widget-list">
          {assignmentsList.length === 0 && <li>No upcoming assignments</li>}
          {assignmentsList.map((a) => (
            <li key={a.id}><strong>{a.title}</strong> — Due {a.dueDate}</li>
          ))}
        </ul>
      </div>

      {/* Study schedule */}
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
                  <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => acceptBlock(block)}>
                    Accept
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
