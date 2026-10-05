/*
  Report share link: the report settings and texts in the URL hash (no map image), until
  the reports API issues signed links. DOCX: lib/reportDocx.js (loaded on demand); PDF:
  the browser's print dialog (components/report/ReportWorkspace.jsx).
*/
const SHARE_KEY = 'report';

/** File name from the report title: lower case, words joined by hyphens. */
export const reportFileName = (title, ext) => `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'report'}.${ext}`;

// UTF-8 safe base64url.
const encode = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (str) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));

/** Copies a link that opens this report (settings and texts; the map image is left out). */
export async function shareLink(report) {
  const withoutMap = report.sections.some((s) => s.snapshot);
  const data = {
    template: report.template,
    title: report.title,
    language: report.language,
    author: report.author,
    sections: report.sections.map(({ snapshot, ...s }) => s), // eslint-disable-line no-unused-vars
  };
  const url = `${location.origin}${location.pathname}#${SHARE_KEY}=${encode(data)}`;
  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, withoutMap };
  } catch {
    return { ok: false };
  }
}

/** The shared report in the URL hash, or null; the hash is cleared once read. */
export function takeSharedReport() {
  const m = new RegExp(`^#${SHARE_KEY}=(.+)$`).exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const r = decode(m[1]);
    return Array.isArray(r.sections) ? r : null;
  } catch {
    return null;
  }
}
