import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { events, plan, assignments, copilot, calendar } from '../api/client';

// ✅ FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';


export default function Calendar() {
  const { userId } = useAuth();

  const [eventList, setEventList] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [scheduleResult, setScheduleResult] = useState(null);
  const [spread, setSpread] = useState('balanced');

  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [syncNote, setSyncNote] = useState('');

  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const load = () => {
    if (!userId) return;
    const rangeStart = new Date().toISOString();
    const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
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

  // Auto-sync from Outlook when Calendar loads so the view stays in sync with your real Outlook calendar
  useEffect(() => {
    if (!userId) return;
    setSyncing(true);
    const rangeStart = new Date().toISOString();
    const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    calendar.sync(userId, rangeStart, rangeEnd)
      .then(() => { load(); setSyncNote('Calendar synced with Outlook.'); })
      .catch(() => { load(); setSyncNote(''); })
      .finally(() => setSyncing(false));
  }, [userId]);

  const syncOutlook = async () => {
    if (!userId) return;
    setSyncing(true);
    setError('');
    setSyncNote('');
    try {
      const rangeStart = new Date().toISOString();
      const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const data = await calendar.sync(userId, rangeStart, rangeEnd);
      load();
      setSyncNote(
        data.source === 'outlook'
          ? (data.events?.length === 0
              ? 'Synced with Outlook (no events in range).'
              : `Synced ${data.events?.length ?? 0} events from Outlook.`)
          : `Loaded ${data.events?.length ?? 0} mock events.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const syncAssignmentDeadlinesToOutlook = async () => {
    if (!userId) return;
    setError('');
    try {
      const data = await calendar.syncAssignmentDeadlines(userId);
      setSyncNote(`Added ${data.created ?? 0} assignment deadline(s) to your Outlook calendar.`);
      load();
    } catch (err) {
      setError(err.message);
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

  // Generate study schedule — uses /plan command (no Azure). Spread: light / balanced / intensive.
  const generateSchedule = async () => {
    setLoading(true);
    setError('');
    setScheduleResult(null);
    try {
      const result = await plan.generate(userId, spread);
      setScheduleResult({ ...result, suggestions: result.suggestions || [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Accept a study block suggestion → creates event (and Outlook if connected) via copilot accept
  const acceptBlockSuggestion = async (suggestionId) => {
    setError('');
    try {
      await copilot.acceptSuggestion(suggestionId, userId);
      setScheduleResult((prev) =>
        prev?.suggestions
          ? { ...prev, suggestions: prev.suggestions.filter((s) => s.id !== suggestionId) }
          : prev
      );
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Reject a study block suggestion
  const rejectBlockSuggestion = async (suggestionId) => {
    setError('');
    try {
      await copilot.rejectSuggestion(suggestionId, userId);
      setScheduleResult((prev) =>
        prev?.suggestions
          ? { ...prev, suggestions: prev.suggestions.filter((s) => s.id !== suggestionId) }
          : prev
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

  // ✅ Convert eventList + assignment deadlines => FullCalendar events
  const calendarEvents = useMemo(() => {
    const fromEvents = eventList
      .filter((e) => e.startAt && e.endAt)
      .map((e) => ({
        id: String(e.id),
        title: e.title || '(No title)',
        start: e.startAt,
        end: e.endAt,
        extendedProps: { raw: e, kind: 'event' },
      }));
    const fromAssignments = (assignmentsList || [])
      .filter((a) => a.dueDate)
      .map((a) => ({
        id: `assignment:${a.id}`,
        title: `Due: ${a.title}`,
        start: a.dueDate,
        allDay: true,
        className: 'fc-event-assignment',
        extendedProps: { raw: a, kind: 'assignment' },
      }));
    return [...fromEvents, ...fromAssignments];
  }, [eventList, assignmentsList]);

  // Click on calendar event => delete (only real events; assignment deadlines are read-only)
  const onEventClick = async (clickInfo) => {
    const kind = clickInfo.event.extendedProps?.kind;
    const raw = clickInfo.event.extendedProps?.raw;
    if (kind === 'assignment') {
      // Assignment deadline: just show info (or could link to assignment)
      return;
    }
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
        <h3>Outlook Calendar (Microsoft Graph)</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          When you connect Microsoft in Settings, events sync both ways: Outlook events appear here on load, and events you add here (including accepted study blocks) are created in your real Outlook calendar.
        </p>
        <button type="button" className="btn" onClick={syncOutlook} disabled={syncing || !userId}>
          {syncing ? 'Syncing…' : 'Sync from Outlook now'}
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
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          Shown on the calendar above. With Microsoft connected, you can add them to Outlook too.
        </p>
        {assignmentsList.length > 0 && (
          <button type="button" className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={syncAssignmentDeadlinesToOutlook}>
            Add assignment deadlines to Outlook
          </button>
        )}
        <ul className="widget-list">
          {assignmentsList.length === 0 && <li>No upcoming assignments</li>}
          {assignmentsList.map((a) => (
            <li key={a.id}><strong>{a.title}</strong> — Due {a.dueDate}</li>
          ))}
        </ul>
      </div>

      {/* Study schedule */}
      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          Study blocks are spread from today until your furthest assignment due date. Choose how many blocks per week:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          {[
            { value: 'light', label: 'Light (2/week)', desc: 'Fewer blocks, spread out' },
            { value: 'balanced', label: 'Balanced (4/week)', desc: 'Steady pace' },
            { value: 'intensive', label: 'Intensive (6/week)', desc: 'More blocks per week' },
          ].map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name="spread"
                value={opt.value}
                checked={spread === opt.value}
                onChange={() => setSpread(opt.value)}
              />
              <span><strong>{opt.label}</strong> — {opt.desc}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn" onClick={generateSchedule} disabled={loading}>
          {loading ? 'Generating…' : 'Generate study schedule around my calendar'}
        </button>

        {error && <p className="error">{error}</p>}

        {scheduleResult && (scheduleResult.suggestions?.length > 0 || scheduleResult.blocks?.length > 0) && (
          <div style={{ marginTop: 16 }}>
            <p><strong>Suggested study blocks</strong> — Accept to add to your calendar (and Outlook if connected).</p>
            {scheduleResult.reply && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{scheduleResult.reply}</p>}
            {scheduleResult.suggestions && scheduleResult.suggestions.length > 0 ? (
              <ul className="widget-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                {scheduleResult.suggestions.map((s) => {
                  let payload = {};
                  try {
                    payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload || {};
                  } catch {}
                  const start = payload.start || payload.startAt || '';
                  const end = payload.end || payload.endAt || '';
                  const title = payload.title || s.label || 'Study block';
                  return (
                    <li key={s.id} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                      <strong>{title}</strong>
                      {start && end && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{String(start).slice(0, 16)} – {String(end).slice(11, 16)}</span>}
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-secondary" style={{ marginRight: 8 }} onClick={() => rejectBlockSuggestion(s.id)}>Reject</button>
                        <button type="button" className="btn" onClick={() => acceptBlockSuggestion(s.id)}>Accept</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="widget-list">
                {scheduleResult.blocks?.map((block, i) => (
                  <li key={i}>
                    {block.start}–{block.end}: {block.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
