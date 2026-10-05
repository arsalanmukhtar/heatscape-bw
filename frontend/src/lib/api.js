/*
  The one module for API calls: relative /api paths (gateway → middleware → backend).
  Errors carry the backend's message (FastAPI `detail` or the middleware error shape).
*/
async function apiPost(path, body) {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? data.error?.message ?? `HTTP ${res.status}`);
  return data;
}

/** Machine translation EN ↔ DE (self-hosted LibreTranslate); html keeps formatting. */
export async function translateText(text, source, target, html = true) {
  const { text: out } = await apiPost('/translate', { text, source, target, format: html ? 'html' : 'text' });
  return out;
}
