/*
  The one module for API calls: relative /api paths (gateway → middleware → backend).
  Errors carry the backend's message (FastAPI `detail` or the middleware error shape),
  plus the HTTP status and the error code.
*/
async function api(method, path, body) {
  const init = body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', cache: 'no-store' });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail ?? data.error?.message ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.error?.code;
    err.retryAfter = data.error?.retryAfter;
    throw err;
  }
  return data;
}
const apiPost = (path, body) => api('POST', path, body);

/** Machine translation EN ↔ DE (self-hosted LibreTranslate); html keeps formatting. */
export async function translateText(text, source, target, html = true) {
  const { text: out } = await apiPost('/translate', { text, source, target, format: html ? 'html' : 'text' });
  return out;
}

// Open-data layers (GeoJSON) and the portal's DWD heat warning card (backend, live data).
export const getLayer = (name) => api('GET', `/layers/${encodeURIComponent(name)}`);
export const getPortalWarning = () => api('GET', '/portal/warning');

// Sign-in session (middleware, httpOnly cookie). getMe resolves to null when signed out.
export const signIn = (email, password, remember) => apiPost('/auth/login', { email, password, remember });
export const signOut = () => api('POST', '/auth/logout');
export const getMe = () =>
  api('GET', '/auth/me').catch((e) => {
    if (e.status === 401) return null;
    throw e;
  });
export const listSessions = () => api('GET', '/auth/sessions').then((d) => d.sessions);
export const endSession = (id) => api('DELETE', `/auth/sessions/${encodeURIComponent(id)}`);
