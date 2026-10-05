import { useState } from 'react';
import { t } from '../i18n';
import { matchesSearch } from '../lib/search';
import { comboKeys, SHORTCUT_GROUPS, SHORTCUTS } from '../lib/shortcuts';
import { useLayout } from '../state/layout';
import { useScenarios } from '../state/scenarios';
import { useWorkspace } from '../state/workspace';
import { Section } from './controls';
import { SearchBar, SearchEmpty } from './SearchBar';
import { PanelHeader } from './SidePanel';

export function FiltersPanel() {
  return <EmptyPanel title={t.placeholder.filters} body={t.placeholder.filtersBody} />;
}

function EmptyPanel({ title, body }) {
  return (
    <>
      <PanelHeader title={title} />
      <p className="px-4 py-4 text-sm text-muted">{body}</p>
    </>
  );
}

/*
  Settings: every keyboard shortcut, grouped by where it acts (lib/shortcuts.js) and
  searchable by name, group or key. Clicking a row runs it; toggles show when they are on.
  The theme switch lives in the top nav (and on T).
*/
export function SettingsPanel() {
  const [query, setQuery] = useState('');
  // Subscribe to the stores the On marks read, so they stay current.
  useLayout();
  useWorkspace();
  useScenarios((st) => st.compare);
  const sc = t.shortcuts;
  const groups = SHORTCUT_GROUPS.map((g) => ({
    id: g,
    items: SHORTCUTS.filter((x) => x.group === g && matchesSearch(query, [x.label, sc.groups[g], comboKeys(x.combo).join(' '), x.combo])),
  })).filter((g) => g.items.length);

  return (
    <>
      <PanelHeader title={t.placeholder.settings} />
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="label-caps mb-1">{sc.title}</p>
        <p className="mb-2.5 text-xs leading-relaxed text-muted">{sc.hint}</p>
        <SearchBar value={query} onChange={setQuery} placeholder={sc.search} size="md" className="w-full" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {groups.length === 0 && <SearchEmpty>{sc.noMatch}</SearchEmpty>}
        {groups.map((g) => (
          <Section key={g.id} title={`${sc.groups[g.id]} · ${g.items.length}`}>
            <ul className="-mx-2 flex flex-col">
              {g.items.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={x.run} className="flex h-8 w-full items-center gap-2 px-2 text-left hover:bg-hover">
                    <span className="min-w-0 flex-1 truncate text-xs text-text">{x.label}</span>
                    {x.on?.() && (
                      <span className="level-chip" style={{ '--chip': 'var(--success)', width: 'auto' }}>
                        {sc.on}
                      </span>
                    )}
                    <span className="flex shrink-0 items-center gap-1">
                      {comboKeys(x.combo).map((k) => (
                        <kbd key={k} className="grid h-6 min-w-6 place-items-center border border-border-strong bg-field px-1.5 font-mono text-2xs text-text">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </>
  );
}
