import { useState } from 'react';
import { LuActivity, LuLayers, LuSettings, LuThermometer, LuTriangleAlert, LuWind } from 'react-icons/lu';
import { GP_TOOLS } from '../data/mock';
import { t } from '../i18n';
import { useJobs } from '../state/jobs';
import { useLayout } from '../state/layout';
import { SearchField } from './SearchField';
import { PanelHeader } from './SidePanel';

const ICONS = { zonal: LuActivity, hvi: LuTriangleAlert, lst: LuThermometer, sealing: LuLayers, coldair: LuWind };

export function GeoprocessingPanel() {
  const [query, setQuery] = useState('');
  const submit = useJobs((s) => s.submit);
  const setDockTab = useLayout((s) => s.setDockTab);

  const q = query.trim().toLowerCase();
  const tools = q ? GP_TOOLS.filter((x) => `${x.name} ${x.category}`.toLowerCase().includes(q)) : GP_TOOLS;

  // MOCK: a click queues the tool with default inputs until the tool form exists.
  const run = (tool) => {
    submit(tool);
    setDockTab('jobs');
  };

  return (
    <>
      <PanelHeader
        title={t.geoprocessing.title}
        actions={
          <button
            type="button"
            disabled
            aria-label={t.geoprocessing.settings}
            title={`${t.geoprocessing.settings} · ${t.copilot.comingNext}`}
            className="grid size-7 place-items-center text-muted disabled:opacity-40"
          >
            <LuSettings size={14} />
          </button>
        }
      />
      <div className="shrink-0 border-b border-border px-3 py-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t.geoprocessing.search}
          onClear={() => setQuery('')}
          clearLabel={t.filter.clear}
          iconSize={13}
          className="h-8 border-border bg-field"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {tools.length === 0 && <li className="px-4 py-3 text-xs text-muted">{t.geoprocessing.empty}</li>}
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? LuActivity;
          return (
            <li key={tool.id}>
              <button
                type="button"
                onClick={() => run(tool)}
                title={t.geoprocessing.run(tool.name)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-border bg-surface-raised text-text">
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text">{tool.name}</span>
                  <span className="block truncate text-2xs text-muted">{tool.category}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
