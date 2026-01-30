/**
 * Microsoft Graph - Teams: deep link + post message.
 * Uses OAuth when USE_MS_GRAPH=true; otherwise mock.
 */

import * as oauth from './graph.oauth.js';
import * as mock from './graph.mock.js';

const useGraph = process.env.USE_MS_GRAPH === 'true';

export async function getTeamsDeepLink({ userId, channelId, accessToken }) {
  if (!useGraph || !accessToken) return mock.getTeamsDeepLink({ userId, channelId });
  // TODO: Resolve team/channel from user context; return teams deep link.
  const teams = await oauth.graphRequest(accessToken, 'GET', '/me/joinedTeams');
  const team = (teams?.value || [])[0];
  if (!team) return mock.getTeamsDeepLink({ userId, channelId });
  const channels = await oauth.graphRequest(accessToken, 'GET', `/teams/${team.id}/channels`);
  const channel = (channels?.value || [])[0] || { id: channelId };
  const link = `https://teams.microsoft.com/l/channel/${channel.id}`;
  return { deepLink: link, channelId: channel.id };
}

export async function postTeamsMessage({ userId, channelId, message, accessToken }) {
  if (!useGraph || !accessToken) return mock.postTeamsMessage({ userId, channelId, message });
  // TODO: Post to channel via Graph (requires team id + channel id and chat message API).
  return mock.postTeamsMessage({ userId, channelId, message });
}
