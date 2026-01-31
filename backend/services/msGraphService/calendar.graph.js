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

export async function createCalendarEvent({ userId, subject, start, end, body, accessToken }) {
  if (!useGraph || !accessToken) return mock.createCalendarEvent({ userId, subject, start, end, body });
  const path = '/me/events';
  const payload = { subject, start: { dateTime: start, timeZone: 'UTC' }, end: { dateTime: end, timeZone: 'UTC' }, body: body ? { content: body, contentType: 'text' } : undefined };
  return oauth.graphRequest(accessToken, 'POST', path, payload);
}
