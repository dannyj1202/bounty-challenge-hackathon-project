/**
 * Mock Microsoft Graph - returns canned data for demo without OAuth.
 */

export async function getCalendarEvents({ userId, start, end }) {
  return [
    { id: 'mock-e1', subject: 'Mock: Team standup', start: { dateTime: start }, end: { dateTime: end }, isAllDay: false },
  ];
}

export async function createCalendarEvent({ userId, subject, start, end, body }) {
  return { id: 'mock-new-' + Date.now(), subject, start: { dateTime: start }, end: { dateTime: end } };
}

export async function createOneNotePage({ userId, title, content }) {
  return { id: 'mock-page-' + Date.now(), title, contentUrl: 'https://mock.onenote.com/page' };
}

export async function getTeamsDeepLink({ userId, channelId }) {
  return { deepLink: 'https://teams.microsoft.com/l/channel/19%3amock@thread.tacv2', channelId: channelId || 'mock' };
}

export async function postTeamsMessage({ userId, channelId, message }) {
  return { id: 'mock-msg-' + Date.now(), message };
}

export async function listFiles({ userId, folderId }) {
  return { value: [{ id: 'mock-file-1', name: 'Mock file', webUrl: 'https://mock.sharepoint.com/file' }] };
}
