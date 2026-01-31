/**
 * Microsoft Graph - Calendar: list/create events.
 * Uses OAuth access token when USE_MS_GRAPH=true; otherwise mock.
 */

import * as oauth from './graph.oauth.js';
import * as mock from './graph.mock.js';

const useGraph = process.env.USE_MS_GRAPH === 'true';

export async function getCalendarEvents({ userId, start, end, accessToken }) {
  if (!useGraph || !accessToken) return mock.getCalendarEvents({ userId, start, end });
  const path = `/me/calendar/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`;
  const data = await oauth.graphRequest(accessToken, 'GET', path);
  const raw = data?.value || [];
  console.log("[calendar/graph] calendarView start=" + start + " end=" + end + " -> " + raw.length + " events from Outlook");
  return raw.map((e) => ({
    id: e.id,
    subject: e.subject,
    start: e.start,
    end: e.end,
    isAllDay: e.isAllDay,
  }));
}

export async function createCalendarEvent({ userId, subject, start, end, body, accessToken, isAllDay }) {
  if (!useGraph || !accessToken) return mock.createCalendarEvent({ userId, subject, start, end, body, isAllDay });
  const path = '/me/events';
  let payload;
  if (isAllDay && start) {
    // All-day: start is "YYYY-MM-DD"; Graph expects end = midnight of day after (exclusive)
    const startDate = start.slice(0, 10);
    const d = new Date(startDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    const endDate = d.toISOString().slice(0, 10);
    payload = {
      subject,
      start: { dateTime: startDate + 'T00:00:00', timeZone: 'UTC' },
      end: { dateTime: endDate + 'T00:00:00', timeZone: 'UTC' },
      isAllDay: true,
      body: body ? { content: body, contentType: 'text' } : undefined,
    };
  } else {
    payload = {
      subject,
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      body: body ? { content: body, contentType: 'text' } : undefined,
    };
  }
  return oauth.graphRequest(accessToken, 'POST', path, payload);
}

/** Delete an event from Outlook. eventId = Graph API event id (not our ms:outlook:xxx id). */
export async function deleteCalendarEvent(accessToken, eventId) {
  if (!useGraph || !accessToken) return;
  const path = `/me/events/${encodeURIComponent(eventId)}`;
  await oauth.graphRequest(accessToken, 'DELETE', path);
}
