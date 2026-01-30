/**
 * Microsoft Graph service - provider switch: mock vs real Graph.
 * Default: mock.
 * Real Graph requires USE_MS_GRAPH=true and OAuth configured.
 */

const useGraph = process.env.USE_MS_GRAPH === 'true';

let mod;
let provider = useGraph ? 'graph' : 'mock';

if (useGraph) {
    try {
        mod = await import('./graph.real.js');
        provider = 'graph';
    } catch (e) {
        console.warn('[msgraph] Failed to load real Graph provider. Falling back to mock.', e.message);
        mod = await import('./graph.mock.js');
        provider = 'mock';
    }
    } else {
    mod = await import('./graph.mock.js');
    provider = 'mock';
}

console.log(`[msgraph] provider=${provider}`);

// Keep the same exports that the rest of your app expects
export const getCalendarEvents = mod.getCalendarEvents;
export const createCalendarEvent = mod.createCalendarEvent;
export const createOneNotePage = mod.createOneNotePage;
export const getTeamsDeepLink = mod.getTeamsDeepLink;
export const postTeamsMessage = mod.postTeamsMessage;
export const listFiles = mod.listFiles;

export const getAuthorizeUrl = mod.getAuthorizeUrl;
export const exchangeCodeForTokens = mod.exchangeCodeForTokens;
export const graphRequest = mod.graphRequest;
