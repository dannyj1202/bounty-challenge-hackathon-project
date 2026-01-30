/**
 * Microsoft Graph - OneNote: create page.
 * Uses OAuth when USE_MS_GRAPH=true; otherwise mock.
 */

import * as oauth from './graph.oauth.js';
import * as mock from './graph.mock.js';

const useGraph = process.env.USE_MS_GRAPH === 'true';

export async function createOneNotePage({ userId, title, content, accessToken }) {
  if (!useGraph || !accessToken) return mock.createOneNotePage({ userId, title, content });
  // TODO: Get notebook/section id from user preferences or default; Graph requires parent section.
  const sectionsRes = await oauth.graphRequest(accessToken, 'GET', '/me/onenote/notebooks');
  const notebooks = sectionsRes?.value || [];
  const firstNotebook = notebooks[0];
  if (!firstNotebook) return mock.createOneNotePage({ userId, title, content });
  const sections = await oauth.graphRequest(accessToken, 'GET', `/me/onenote/notebooks/${firstNotebook.id}/sections`);
  const section = (sections?.value || [])[0];
  if (!section) return mock.createOneNotePage({ userId, title, content });
  const html = `<html><head><title>${title}</title></head><body><p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></body></html>`;
  const path = `/me/onenote/sections/${section.id}/pages`;
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/xhtml+xml',
    },
    body: html,
  });
  if (!res.ok) throw new Error(`OneNote error: ${await res.text()}`);
  return res.json();
}
