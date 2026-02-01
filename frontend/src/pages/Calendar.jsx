import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { events, plan, assignments, copilot, calendar } from '../api/client';
import { CalendarSync, CalendarDays, Plus, CalendarCheck, Sparkles, Calendar as CalendarIcon } from 'lucide-react';

// ✅ FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';


export default function Calendar() {
  const { userId } = useAuth();
  const { theme } = useTheme();

  const [eventList, setEventList] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [scheduleResult, setScheduleResult] = useState(null);
  const [spread, setSpread] = useState('balanced');

  const [newTitle, setNewTitle] = useState('');
  const getDefaultStart = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  };
  const getDefaultEnd = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  };
  const [newStart, setNewStart] = useState(getDefaultStart);
  const [newEnd, setNewEnd] = useState(getDefaultEnd);
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
      setNewStart(getDefaultStart());
      setNewEnd(getDefaultEnd());
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

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardTitle = 'text-gray-900 dark:text-white font-semibold text-base';
  const cardMuted = 'text-gray-800 dark:text-gray-400 text-sm';

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-6xl mx-auto px-6 py-8 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Calendar</h2>

      {/* Outlook Sync */}
      <div className={`${cardBase} p-5 mb-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <img
            src="/outlook-calendar-logo.png"
            alt=""
            className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl object-contain bg-white dark:bg-white/5 ring-1 ring-gray-200 dark:ring-violet-500/20"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}>
              <CalendarSync className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
              Sync Outlook
            </h3>
            <p className={`${cardMuted} mb-4`}>
              When you connect Microsoft in Settings, events sync both ways: Outlook events appear here on load, and events you add here (including accepted study blocks) are created in your real Outlook calendar.
            </p>
            <button type="button" className="btn px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50" onClick={syncOutlook} disabled={syncing || !userId}>
              {syncing ? 'Syncing…' : 'Sync from Outlook now'}
            </button>
            {syncNote && <p className={`${cardMuted} mt-3`}>{syncNote}</p>}
          </div>
        </div>
      </div>

      {/* ✅ Real Calendar Grid */}
      <div className={`${cardBase} p-5 mb-6 overflow-hidden`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}>
          <CalendarDays className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Calendar view
        </h3>
        <p className={`${cardMuted} mb-4`}>
          Events appear on the exact date/time blocks. Click an event to delete it.
        </p>

        <div className={theme === 'dark' ? 'fc-dark-theme' : 'fc-light-theme'}>
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
      </div>

      {/* Add personal event */}
      <div className={`${cardBase} p-6 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-1`}>
          <Plus className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Add personal event
        </h3>
        <p className={`${cardMuted} mb-5`}>
          Create an event with a title and time. It will appear on the calendar and sync to Outlook when connected.
        </p>
        <form onSubmit={addEvent} className="rounded-xl bg-gray-100/80 dark:bg-black/20 border border-gray-200 dark:border-violet-500/20 p-5 transition-colors duration-200">
          <div className="flex flex-wrap gap-5 items-end">
            <div className="min-w-[200px] flex-1">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1.5">Event name</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Football practice, Study session"
                required
                className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1.5">Starts</label>
              <div className="datetime-input-wrapper relative">
                <input
                  type="datetime-local"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                  className="w-full py-2.5 pl-4 pr-10 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-violet-500/30 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200 [color-scheme:inherit]"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-gray-500 dark:text-violet-200 shrink-0" aria-hidden />
              </div>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1.5">Ends</label>
              <div className="datetime-input-wrapper relative">
                <input
                  type="datetime-local"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  min={newStart || new Date().toISOString().slice(0, 16)}
                  required
                  className="w-full py-2.5 pl-4 pr-10 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-violet-500/30 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200 [color-scheme:inherit]"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-gray-500 dark:text-violet-200 shrink-0" aria-hidden />
              </div>
            </div>
            <button
              type="submit"
              className="shrink-0 px-6 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-[#16161d]"
            >
              Add event
            </button>
          </div>
        </form>
      </div>

      {/* Assignment due dates */}
      <div className={`${cardBase} p-5 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}>
          <CalendarCheck className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Assignment due dates
        </h3>
        <p className={`${cardMuted} mb-4`}>
          Shown on the calendar above. With Microsoft connected, you can add them to Outlook too.
        </p>
        {assignmentsList.length > 0 && (
          <button type="button" className="btn px-4 py-2 rounded-xl border border-violet-500/40 text-violet-200 hover:bg-violet-500/10 text-sm font-medium transition-all duration-200 mb-4" onClick={syncAssignmentDeadlinesToOutlook}>
            Add assignment deadlines to Outlook
          </button>
        )}
        <ul className="space-y-2 list-none p-0 m-0">
          {assignmentsList.length === 0 && <li className={cardMuted}>No upcoming assignments</li>}
          {assignmentsList.map((a) => (
            <li key={a.id} className="py-2 border-b border-gray-200 dark:border-violet-500/10 last:border-0 text-gray-800 dark:text-gray-300">
              <strong className="text-gray-900 dark:text-white">{a.title}</strong>
              <span className={`${cardMuted} ml-2`}>— Due {a.dueDate}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Study schedule */}
      <div className={`${cardBase} p-5 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}>
          <Sparkles className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Study schedule
        </h3>
        <p className={`${cardMuted} mb-4`}>
          Study blocks are spread from today until your furthest assignment due date. Choose how many blocks per week:
        </p>
        <div className="flex flex-wrap gap-6 items-start mb-4">
          {[
            { value: 'light', label: 'Light (2/week)', desc: 'Fewer blocks, spread out' },
            { value: 'balanced', label: 'Balanced (4/week)', desc: 'Steady pace' },
            { value: 'intensive', label: 'Intensive (6/week)', desc: 'More blocks per week' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-transparent dark:border-transparent hover:border-violet-400/30 dark:hover:border-violet-500/30 hover:bg-violet-500/5 dark:hover:bg-violet-500/5 transition-all duration-200">
              <input
                type="radio"
                name="spread"
                value={opt.value}
                checked={spread === opt.value}
                onChange={() => setSpread(opt.value)}
                className="w-5 h-5 rounded-full border-2 border-gray-400 dark:border-gray-500 bg-transparent text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#16161d] accent-violet-500"
              />
              <span className="text-gray-800 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                <strong className="text-gray-900 dark:text-white block">{opt.label}</strong>
                <span className={`${cardMuted} text-xs`}>{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-semibold transition-all duration-200 hover:shadow-[0_0_24px_rgba(139,92,246,0.4)] disabled:opacity-50"
          onClick={generateSchedule}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate study schedule around my calendar'}
        </button>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        {scheduleResult && (scheduleResult.suggestions?.length > 0 || scheduleResult.blocks?.length > 0) && (
          <div className="mt-6 pt-4 border-t border-violet-500/20">
            <p className="text-gray-900 dark:text-white font-medium mb-2">Suggested study blocks</p>
            <p className={`${cardMuted} mb-4`}>Accept to add to your calendar (and Outlook if connected).</p>
            {scheduleResult.reply && <p className={`${cardMuted} text-sm mb-3`}>{scheduleResult.reply}</p>}
            {scheduleResult.suggestions && scheduleResult.suggestions.length > 0 ? (
              <ul className="space-y-3 list-none p-0 m-0">
                {scheduleResult.suggestions.map((s) => {
                  let payload = {};
                  try {
                    payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload || {};
                  } catch {}
                  const startVal = payload.start || payload.startAt || '';
                  const endVal = payload.end || payload.endAt || '';
                  const title = payload.title || s.label || 'Study block';
                  return (
                    <li key={s.id} className="p-4 rounded-xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-violet-500/20 transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40">
                      <span className="text-white font-medium">{title}</span>
                      {startVal && endVal && <span className={`${cardMuted} ml-2`}>{String(startVal).slice(0, 16)} – {String(endVal).slice(11, 16)}</span>}
                      <div className="flex gap-2 mt-3">
                        <button type="button" className="px-3 py-1.5 rounded-lg border border-violet-400/50 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/10 text-sm transition-all duration-200" onClick={() => rejectBlockSuggestion(s.id)}>Reject</button>
                        <button type="button" className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-[0_0_12px_rgba(139,92,246,0.4)]" onClick={() => acceptBlockSuggestion(s.id)}>Accept</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {scheduleResult.blocks?.map((block, i) => (
                  <li key={i} className="py-2 border-b border-gray-200 dark:border-violet-500/10 text-gray-800 dark:text-gray-300 last:border-0">
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
