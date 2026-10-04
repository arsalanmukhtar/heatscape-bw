import { t } from '../i18n';
import { useTheme } from '../state/theme';
import { PanelHeader } from './SidePanel';

export function FiltersPanel() {
  return <EmptyPanel title={t.placeholder.filters} body={t.placeholder.filtersBody} />;
}

export function ReportsPanel() {
  return <EmptyPanel title={t.placeholder.reports} body={t.placeholder.reportsBody} />;
}

function EmptyPanel({ title, body }) {
  return (
    <>
      <PanelHeader title={title} />
      <p className="px-4 py-4 text-sm text-muted">{body}</p>
    </>
  );
}

export function SettingsPanel() {
  const { mode, setMode } = useTheme();
  const modes = [
    { id: 'dark', label: t.placeholder.dark },
    { id: 'light', label: t.placeholder.light },
    { id: 'system', label: t.placeholder.system },
  ];

  return (
    <>
      <PanelHeader title={t.placeholder.settings} />
      <div className="px-3 py-4">
        <h3 className="label-caps mb-2 px-1">{t.placeholder.theme}</h3>
        <div role="radiogroup" aria-label={t.placeholder.theme} className="grid grid-cols-3 border border-border">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`h-8 text-sm ${mode === m.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-text'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <h3 className="label-caps mb-2 mt-6 px-1">{t.placeholder.shortcuts}</h3>
        <dl className="flex flex-col gap-1.5 px-1 text-sm">
          {t.placeholder.shortcutList.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <dt>
                <kbd className="grid size-6 place-items-center border border-border-strong bg-field font-[var(--font-mono)] text-xs text-text">{key}</kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
