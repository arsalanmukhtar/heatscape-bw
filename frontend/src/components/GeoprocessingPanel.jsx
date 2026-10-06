import { useState } from 'react';
import { LuActivity, LuLayers, LuSettings, LuThermometer, LuTriangleAlert, LuWind } from 'react-icons/lu';
import { GP_TOOLS } from '../data/mock';
import { t } from '../i18n';
import { useJobs } from '../state/jobs';
import { useLayout } from '../state/layout';
import { useSearch } from '../lib/search';
import { SearchBar, SearchEmpty } from './SearchBar';
import { PanelHeader } from './SidePanel';

const toolSearch = (x) => [x.name, x.category];
const ICONS = { zonal: LuActivity, hvi: LuTriangleAlert, lst: LuThermometer, sealing: LuLayers, coldair: LuWind };

export function GeoprocessingPanel() {
  const [query, setQuery] = useState('');
  const { toolId, openTool } = useJobs();
  const showRightView = useLayout((s) => s.showRightView);
  const toolOpen = useLayout((s) => s.rightOpen && s.rightView === 'tool');

  const tools = useSearch(GP_TOOLS, toolSearch, query);

  // A click opens the tool's form in the right panel (ToolPanel); runs start from there.
  const open = (tool) => {
    openTool(tool.id);
    showRightView('tool');
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
        <SearchBar value={query} onChange={setQuery} placeholder={t.geoprocessing.search} size="md" className="w-full" />
      </div>
      {tools.length === 0 && <SearchEmpty>{t.geoprocessing.empty}</SearchEmpty>}
      <ul className={tools.length ? 'min-h-0 flex-1 overflow-y-auto' : 'hidden'}>
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? LuActivity;
          const active = toolOpen && tool.id === toolId;
          return (
            <li key={tool.id}>
              <button
                type="button"
                onClick={() => open(tool)}
                aria-current={active ? 'true' : undefined}
                title={t.geoprocessing.open(tool.name)}
                className={`flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left ${active ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-hover'}`}
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
