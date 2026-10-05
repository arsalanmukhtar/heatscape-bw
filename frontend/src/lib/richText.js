import { parseColor, toHex } from './color';

/*
  Rich text for report sections (Summary, Appendix): a small HTML subset written by the
  editor (components/report/RichTextEditor.jsx) and read by the pages and the DOCX export.
  Allowed: paragraphs, line breaks, bullet and numbered lists, bold, italic, underline,
  text colour and highlight. Everything else is dropped when the HTML is cleaned.
*/
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BLOCK = new Set(['P', 'UL', 'OL']);
const INLINE = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', BR: 'br' };

/** True when the text is HTML from the editor (plain template text has no tags). */
export const isHtml = (text) => /<\/?(p|ul|ol|li|b|i|u|span|br)\b/i.test(text ?? '');

/** Plain text (blank line = paragraph, "- " lines = bullets) as editor HTML. */
export function textToHtml(text) {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lines = p.split('\n');
      return lines.every((l) => l.trim().startsWith('- '))
        ? `<ul>${lines.map((l) => `<li>${esc(l.trim().slice(2))}</li>`).join('')}</ul>`
        : `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('');
}

/** Colour of a style value as #rrggbb, or null. */
const hexOf = (v) => (v && parseColor(v) && parseColor(v).a > 0 ? toHex(v) : null);

/** Inline formatting of an element: tag-based or from its style (execCommand with CSS). */
function formatOf(el) {
  const st = el.style ?? {};
  const f = {};
  if (INLINE[el.tagName] === 'b' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) f.bold = true;
  if (INLINE[el.tagName] === 'i' || st.fontStyle === 'italic') f.italic = true;
  if (INLINE[el.tagName] === 'u' || (st.textDecorationLine || st.textDecoration || '').includes('underline')) f.underline = true;
  const color = hexOf(st.color) ?? (el.tagName === 'FONT' ? hexOf(el.getAttribute('color')) : null);
  if (color) f.color = color;
  const bg = hexOf(st.backgroundColor);
  if (bg) f.highlight = bg;
  return f;
}

/** Clean inline HTML for children of a node (formatting kept, everything else dropped). */
function inlineHtml(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) out += esc(n.nodeValue);
    else if (n.nodeType === 1) {
      if (n.tagName === 'BR') {
        out += '<br>';
        continue;
      }
      const inner = BLOCK.has(n.tagName) || n.tagName === 'DIV' || n.tagName === 'LI' ? `${inlineHtml(n)}<br>` : inlineHtml(n);
      const f = formatOf(n);
      const styles = [f.color && `color:${f.color}`, f.highlight && `background-color:${f.highlight}`].filter(Boolean).join(';');
      let html = styles ? `<span style="${styles}">${inner}</span>` : inner;
      if (f.underline) html = `<u>${html}</u>`;
      if (f.italic) html = `<i>${html}</i>`;
      if (f.bold) html = `<b>${html}</b>`;
      out += html;
    }
  }
  return out.replace(/(<br>)+$/, '');
}

/** Cleaned editor HTML: top-level paragraphs and lists only, inline formatting kept. */
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const out = [];
  let loose = ''; // inline content outside a block becomes its own paragraph
  const flush = () => {
    if (loose.replace(/<br>/g, '').trim()) out.push(`<p>${loose}</p>`);
    loose = '';
  };
  for (const n of root.childNodes) {
    if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
      flush();
      const items = [...n.children].filter((li) => li.tagName === 'LI').map((li) => `<li>${inlineHtml(li)}</li>`);
      if (items.length) out.push(`<${n.tagName.toLowerCase()}>${items.join('')}</${n.tagName.toLowerCase()}>`);
    } else if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV')) {
      flush();
      const inner = inlineHtml(n);
      if (inner.replace(/<br>/g, '').trim()) out.push(`<p>${inner}</p>`);
    } else {
      loose += n.nodeType === 3 ? esc(n.nodeValue) : n.nodeType === 1 && n.tagName === 'BR' ? '<br>' : n.nodeType === 1 ? inlineHtml({ childNodes: [n] }) : '';
    }
  }
  flush();
  return out.join('');
}

/** Section text (template plain text or editor HTML) as clean HTML. */
export const richHtml = (text) => sanitizeHtml(isHtml(text) ? text : textToHtml(text));

/** Top-level blocks of clean HTML (each paginates as one block). */
export function htmlBlocks(html) {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  return [...root.children].map((el) => el.outerHTML);
}

/**
 * Clean HTML as DOCX-ready blocks: { kind: 'p' | 'ul' | 'ol', items: [runs] } where runs
 * are { text, bold, italic, underline, color, highlight, br }.
 */
export function htmlRuns(html) {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  const runs = (node, fmt = {}) =>
    [...node.childNodes].flatMap((n) => {
      if (n.nodeType === 3) return n.nodeValue ? [{ text: n.nodeValue, ...fmt }] : [];
      if (n.nodeType !== 1) return [];
      if (n.tagName === 'BR') return [{ br: true }];
      return runs(n, { ...fmt, ...formatOf(n) });
    });
  return [...root.children].map((el) =>
    el.tagName === 'P' ? { kind: 'p', items: [runs(el)] } : { kind: el.tagName.toLowerCase(), items: [...el.children].map((li) => runs(li)) },
  );
}
