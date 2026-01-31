const BACKEND_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';
const API_BASE = `${BACKEND_ORIGIN}/api`;

function getToken() {
  try {
    const auth = localStorage.getItem('smart-study-auth');
    return auth ? JSON.parse(auth).token : null;
  } catch {
    return null;
  }
}

export async function api(method, path, body = null) {
  const opts = { method, headers: {} };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText || `HTTP ${res.status}`);
  return data;
}

export const auth = {
  mockLogin: (email, role) => api('POST', '/auth/mock-login', { email, role }),
  /** First-time sign-in: no userId (backend uses state=signup). */
  getMicrosoftLoginUrlFirstTime: () => `${BACKEND_ORIGIN}/api/auth/microsoft/login`,
  /** Link existing user: pass userId from useAuth().userId. */
  getMicrosoftLoginUrl: (userId) =>
    userId
      ? `${BACKEND_ORIGIN}/api/auth/microsoft/login?userId=${encodeURIComponent(String(userId))}`
      : `${BACKEND_ORIGIN}/api/auth/microsoft/login`,
  /** Status: { connected, username, expiresAt }. */
  getMicrosoftStatus: (userId) => api('GET', `/auth/microsoft/status?userId=${encodeURIComponent(userId)}`),
};
export const user = {
  getPreferences: (userId) => api('GET', `/user/preferences?userId=${encodeURIComponent(userId)}`),
  putPreferences: (body) => api('PUT', '/user/preferences', body),
};
export const assignments = {
  list: (userId) => api('GET', `/assignments?userId=${encodeURIComponent(userId)}`),
  create: (body) => api('POST', '/assignments', body),
  update: (id, body) => api('PUT', `/assignments/${id}`, body),
  delete: (id) => api('DELETE', `/assignments/${id}`),
  complete: (id, body) => api('POST', `/assignments/${id}/complete`, body),
};
export const tasks = {
  list: (userId) => api('GET', `/tasks?userId=${encodeURIComponent(userId)}`),
  create: (body) => api('POST', '/tasks', body),
  delete: (id) => api('DELETE', `/tasks/${id}`),
  complete: (id) => api('PATCH', `/tasks/${id}/complete`),
};
export const events = {
  list: (userId, start, end) => {
    let path = `/events?userId=${encodeURIComponent(userId)}`;
    if (start) path += `&start=${encodeURIComponent(start)}`;
    if (end) path += `&end=${encodeURIComponent(end)}`;
    return api('GET', path);
  },
  create: (body) => api('POST', '/events', body),
  delete: (id) => api('DELETE', `/events/${id}`),
};
/** Calendar: sync from Outlook (pull events into app). When Microsoft is connected, events you add here also sync to Outlook. */
export const calendar = {
  sync: (userId, start, end) => api('POST', '/calendar/sync', { userId, start, end }),
  /** Create assignment deadlines as all-day events in Outlook. */
  syncAssignmentDeadlines: (userId) => api('POST', '/calendar/sync-assignment-deadlines', { userId }),
};
export const plan = {
  /** spread: 'light' | 'balanced' | 'intensive' (blocks per week: 2, 4, 6) */
  generate: (userId, spread) => api('POST', '/plan/generate', { userId, spread }),
};
export const copilot = {
  chat: (body) => api('POST', '/copilot/chat', body),
  /**
   * Stream: POST /copilot/chat/stream, yields { type: 'chunk', text } | { type: 'suggestions', suggestions } | { type: 'done' } | { type: 'error', message }.
   */
  async *chatStream(body) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/copilot/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      yield { type: 'error', message: data?.error || res.statusText };
      yield { type: 'done' };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const obj = JSON.parse(line.slice(6));
              yield obj;
              if (obj.type === 'done') return;
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { type: 'done' };
  },
  suggestionsList: (userId, status = 'pending') =>
    api('GET', `/copilot/suggestions?userId=${encodeURIComponent(userId)}&status=${status}`),
  acceptSuggestion: (id, userId) => api('POST', `/copilot/suggestions/${id}/accept`, { userId }),
  rejectSuggestion: (id, userId) => api('POST', `/copilot/suggestions/${id}/reject`, { userId }),
};
export const quiz = {
  generate: (body) => api('POST', '/quiz/generate', body),
  submit: (body) => api('POST', '/quiz/submit', body),
};
export const notes = {
  summarize: (text) => api('POST', '/notes/summarize', { text }),
  translate: (text, language) => api('POST', '/notes/translate', { text, language }),
  flashcards: (text) => api('POST', '/notes/flashcards', { text }),
  questions: (text) => api('POST', '/notes/questions', { text }),
  transcribe: (audioBase64, contentType) => api('POST', '/notes/transcribe', { audioBase64, contentType }),
  saveOnenote: (userId, title, content) => api('POST', '/notes/save-onenote', { userId, title, content }),
};
export const teams = {
  post: (userId, message) => api('POST', '/teams/post', { userId, message }),
  deepLink: (userId) => api('GET', `/teams/deep-link?userId=${encodeURIComponent(userId)}`),
};
export const notifications = {
  checkin: (userId) => api('POST', '/notifications/checkin', { userId }),
  list: (userId) => api('GET', `/notifications?userId=${encodeURIComponent(userId)}`),
};
export const insights = {
  student: (userId) => api('GET', `/insights/student?userId=${encodeURIComponent(userId)}`),
  university: () => api('GET', '/insights/university'),
};
export const dev = {
  seed: () => api('POST', '/dev/seed'),
};

/** Document ingestion: upload file → DI extract → stored as note. Returns { ok, noteId, title, chars }. */
export const docs = {
  ingest: async (userId, file, title = '') => {
    const form = new FormData();
    form.append('userId', userId);
    form.append('file', file);
    if (title) form.append('title', title);
    return api('POST', '/docs/ingest', form);
  },
};

/** Documents: upload (chunk+embed+index), text, search. */
export const documents = {
  upload: async (userId, files, title = '') => {
    const form = new FormData();
    form.append('userId', userId);
    if (Array.isArray(files)) {
      files.forEach((f) => form.append('files', f));
    } else {
      form.append('file', files);
    }
    if (title) form.append('title', title);
    return api('POST', '/documents/upload', form);
  },
  text: (userId, text, title = '') =>
    api('POST', '/documents/text', { userId, text, title: title || 'Pasted text' }),
  search: (q, top = 5) =>
    api('GET', `/documents/search?q=${encodeURIComponent(q)}&top=${top}`),
};
