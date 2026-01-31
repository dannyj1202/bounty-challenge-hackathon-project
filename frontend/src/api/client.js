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
export const plan = {
  generate: (userId) => api('POST', '/plan/generate', { userId }),
};
export const copilot = {
  chat: (body) => api('POST', '/copilot/chat', body),
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
