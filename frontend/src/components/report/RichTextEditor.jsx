import { useEffect, useRef, useState } from 'react';
import { LuBaseline, LuBold, LuHighlighter, LuItalic, LuList, LuListOrdered, LuRemoveFormatting, LuUnderline } from 'react-icons/lu';
import { t } from '../../i18n';
import { toHex } from '../../lib/color';
import { cssVar } from '../../lib/css';
import { sanitizeHtml } from '../../lib/richText';
import { ColorPicker } from '../ColorPicker';

const r = t.report.editor;
// Starting colours (the picker offers the rest): a deep heat red for text, pale yellow highlight.
const startColors = () => ({ text: toHex(cssVar('--heat-7')), highlight: toHex(cssVar('--heat-1')) });

/*
  Rich text editor for report sections: bold, italic, underline, text colour, highlight,
  bullet and numbered lists, clear formatting. Writes clean HTML (lib/richText.js) on every
  input. Toolbar buttons keep the text selection (mousedown is prevented); the colour
  pickers remember the selection and restore it before applying.
*/
export function RichTextEditor({ value, onChange, label }) {
  const ref = useRef(null);
  const saved = useRef(null);
  const [active, setActive] = useState({});
  const [picker, setPicker] = useState(null); // { kind: 'text' | 'highlight', anchor }
  const [colors, setColors] = useState(startColors);

  // Outside changes (template text, language) replace the content unless the user is typing.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  // Toolbar state follows the caret.
  useEffect(() => {
    const update = () => {
      if (!ref.current?.contains(document.getSelection()?.anchorNode)) return;
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  const emit = () => {
    const html = sanitizeHtml(ref.current.innerHTML);
    if (html !== value) onChange(html);
  };
  const saveSelection = () => {
    const sel = document.getSelection();
    if (sel?.rangeCount && ref.current.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (!saved.current) return;
    ref.current.focus();
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.current);
  };
  const exec = (cmd, arg) => {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, arg);
    emit();
  };
  const applyColor = (kind, color) => {
    const hex = toHex(color);
    setColors({ ...colors, [kind]: hex });
    restoreSelection();
    exec(kind === 'text' ? 'foreColor' : 'hiliteColor', hex);
    saveSelection();
  };

  const tools = [
    { id: 'bold', Icon: LuBold, label: r.bold, run: () => exec('bold') },
    { id: 'italic', Icon: LuItalic, label: r.italic, run: () => exec('italic') },
    { id: 'underline', Icon: LuUnderline, label: r.underline, run: () => exec('underline') },
    'sep',
    { id: 'text', Icon: LuBaseline, label: r.textColor, color: colors.text },
    { id: 'highlight', Icon: LuHighlighter, label: r.highlight, color: colors.highlight },
    'sep',
    { id: 'ul', Icon: LuList, label: r.bullets, run: () => exec('insertUnorderedList') },
    { id: 'ol', Icon: LuListOrdered, label: r.numbered, run: () => exec('insertOrderedList') },
    'sep',
    { id: 'clear', Icon: LuRemoveFormatting, label: r.clear, run: () => exec('removeFormat') },
  ];

  return (
    <div className="flex flex-col border border-border bg-field focus-within:border-accent-line">
      <div role="toolbar" aria-label={label} className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border px-1">
        {tools.map((tool, i) =>
          tool === 'sep' ? (
            <span key={i} className="mx-1 h-4 w-px bg-border" aria-hidden />
          ) : (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={tool.color ? undefined : !!active[tool.id]}
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              onClick={(e) => (tool.color ? setPicker(picker?.kind === tool.id ? null : { kind: tool.id, anchor: e.currentTarget }) : tool.run())}
              className={`relative grid size-6 place-items-center ${active[tool.id] || picker?.kind === tool.id ? 'bg-accent-soft text-accent' : 'text-muted hover:text-accent'}`}
            >
              <tool.Icon size={13} />
              {tool.color && <span className="absolute inset-x-1 bottom-0.5 h-[0.1875rem]" style={{ background: tool.color }} aria-hidden />}
            </button>
          ),
        )}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className="report-rich min-h-[21.25rem] resize-y overflow-auto px-2.5 py-2 text-xs leading-relaxed text-text outline-none"
      />
      {picker && (
        <ColorPicker
          value={colors[picker.kind]}
          onChange={(c) => applyColor(picker.kind, c)}
          onClose={() => setPicker(null)}
          anchor={picker.anchor}
          label={picker.kind === 'text' ? r.textColor : r.highlight}
        />
      )}
    </div>
  );
}
