import * as calendar from './calendar.graph.js';
import * as onenote from './onenote.graph.js';
import * as teams from './teams.graph.js';
import * as files from './files.graph.js';
import * as oauth from './graph.oauth.js';

export const getCalendarEvents = calendar.getCalendarEvents;
export const createCalendarEvent = calendar.createCalendarEvent;
export const createOneNotePage = onenote.createOneNotePage;
export const getTeamsDeepLink = teams.getTeamsDeepLink;
export const postTeamsMessage = teams.postTeamsMessage;
export const listFiles = files.listFiles;

export const getAuthorizeUrl = oauth.getAuthorizeUrl;
export const exchangeCodeForTokens = oauth.exchangeCodeForTokens;
export const graphRequest = oauth.graphRequest;
