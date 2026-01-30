/**
 * Microsoft Graph - Files (OneDrive/SharePoint) - optional stub.
 */

import * as mock from './graph.mock.js';

const useGraph = process.env.USE_MS_GRAPH === 'true';

export async function listFiles({ userId, folderId, accessToken }) {
  if (!useGraph || !accessToken) return mock.listFiles({ userId, folderId });
  // TODO: GET /me/drive/root/children or /me/drive/items/{id}/children
  return mock.listFiles({ userId, folderId });
}
