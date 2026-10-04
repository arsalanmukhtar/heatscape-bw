import { useEffect, useRef } from 'react';
import {
  LuCheck,
  LuDownload,
  LuFilePlus,
  LuFileText,
  LuHistory,
  LuMap,
  LuMousePointer2,
  LuPanelRightClose,
  LuPaperclip,
  LuSendHorizontal,
  LuSettings,
  LuZap,
} from 'react-icons/lu';
import { COPILOT, REGION, USER } from '../data/mock';
import { t } from '../i18n';
import { downloadCsv } from '../lib/csv';
import { useSort } from '../lib/useSort';
import { useCopilot } from '../state/copilot';
import { useLayout } from '../state/layout';
import { useWorkspace } from '../state/workspace';
import { Checkbox } from './Checkbox';
import { ConfidencePips } from './ConfidencePips';
import { ExpandButton, ExpandSlot } from './Expandable';
import { SortTh } from './SortTh';
import { PanelHeader } from './SidePanel';

const iconBtn = 'grid size-7 place-items-center text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:hover:bg-transparent';
const outlineBtn =
  'flex h-8 items-center gap-1.5 border border-border-strong px-3 text-xs text-text hover:bg-hover disabled:opacity-50 disabled:hover:bg-transparent';

export function CopilotPanel() {
  const toggleRight = useLayout((s) => s.toggleRight);
  const { messages, status, reset } = useCopilot();
  const scrollRef = useRef(null);

  // Keep the newest message and progress in view.
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  return (
    <>
      <PanelHeader
        title={t.copilot.title}
        meta={
          <span className="block truncate border border-border px-1.5 py-0.5 text-2xs text-muted">
            {REGION.name} · {COPILOT.sceneDate}
          </span>
        }
        actions={
          <>
            <button type="button" onClick={reset} aria-label={t.copilot.newChat} title={t.copilot.newChat} className={iconBtn}>
              <LuFilePlus size={14} />
            </button>
            <button type="button" disabled aria-label={t.copilot.history} title={`${t.copilot.history} · ${t.copilot.comingNext}`} className={iconBtn}>
              <LuHistory size={14} />
            </button>
            <button type="button" disabled aria-label={t.copilot.settings} title={`${t.copilot.settings} · ${t.copilot.comingNext}`} className={iconBtn}>
              <LuSettings size={14} />
            </button>
            <button type="button" onClick={toggleRight} aria-label={t.copilot.collapse} title={t.copilot.collapse} className={iconBtn}>
              <LuPanelRightClose size={15} />
            </button>
          </>
        }
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="flex flex-col gap-5">
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} text={m.text} />
            ) : (
              <AssistantMessage key={m.id}>{m.kind === 'plan' ? <PlanThread /> : <Note />}</AssistantMessage>
            ),
          )}
        </div>
      </div>

      <Composer />
    </>
  );
}

function UserMessage({ text }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center border border-border-strong bg-surface-raised text-2xs font-semibold text-text" aria-label={t.copilot.you}>
        {USER.initials}
      </span>
      <p className="pt-0.5 text-sm text-text">{text}</p>
    </div>
  );
}

function AssistantMessage({ children }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center bg-accent text-on-accent" aria-label={t.copilot.assistant}>
        <LuZap size={13} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function Note() {
  return <p className="border border-border bg-field px-3 py-2 text-xs text-muted">{t.copilot.notConnected}</p>;
}

function PlanThread() {
  const status = useCopilot((s) => s.status);
  return (
    <>
      <PlanCard />
      {status !== 'planned' && <ToolSteps />}
      {status === 'done' && <ResultCard />}
    </>
  );
}

function PlanCard() {
  const { status, runPlan } = useCopilot();
  return (
    <section className="border border-border-strong bg-surface-raised p-4">
      <h3 className="text-2xs font-semibold uppercase tracking-[var(--tracking-caps)] text-accent">{t.copilot.plan}</h3>
      <ol className="mt-3 flex flex-col gap-2 text-xs text-text">
        {COPILOT.plan.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="w-3 shrink-0 tabular-nums text-muted">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <span className="font-mono text-2xs text-muted">{COPILOT.estimate}</span>
        <button
          type="button"
          onClick={runPlan}
          disabled={status !== 'planned'}
          className="ml-auto h-8 bg-accent px-3 text-xs font-medium text-on-accent hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
        >
          {status === 'running' ? t.copilot.running : status === 'done' ? t.copilot.done : t.copilot.runPlan}
        </button>
        <button type="button" disabled title={t.copilot.comingNext} className={outlineBtn}>
          {t.copilot.edit}
        </button>
      </div>
    </section>
  );
}

function ToolSteps() {
  const step = useCopilot((s) => s.step);
  return (
    <ol className="flex flex-col">
      {COPILOT.tools.map((tool, i) => {
        const state = i < step ? 'done' : i === step ? 'running' : 'pending';
        return (
          <li key={tool.name} className="grid grid-cols-[14px_1fr] gap-3 py-2">
            <StepMark state={state} />
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className={`font-mono text-xs ${state === 'pending' ? 'text-muted' : 'text-text'}`}>{tool.name}</span>
                {state === 'running' && <span className="text-2xs text-accent">{t.copilot.running}</span>}
              </p>
              <p className="mt-0.5 text-2xs text-muted">{tool.detail}</p>
              {state === 'running' && (
                <div className="mt-2 h-px overflow-hidden bg-border" role="progressbar" aria-label={tool.name}>
                  <div className="progress-sweep h-full w-1/4 bg-accent" />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepMark({ state }) {
  const label = t.copilot[state === 'done' ? 'done' : state === 'running' ? 'running' : 'pending'];
  if (state === 'done')
    return (
      <span className="mt-0.5 grid size-3.5 place-items-center border border-border-strong text-text" aria-label={label}>
        <LuCheck size={10} strokeWidth={3} />
      </span>
    );
  if (state === 'running')
    return (
      <span className="mt-0.5 grid size-3.5 place-items-center border border-accent" aria-label={label}>
        <span className="size-1.5 bg-accent" />
      </span>
    );
  return <span className="mt-0.5 size-3.5 border border-border" aria-label={label} />;
}

function ResultCard() {
  const exportCsv = () =>
    downloadCsv(
      'copilot-result.csv',
      [t.copilot.columns.district, t.copilot.columns.share65, t.copilot.columns.confidence],
      COPILOT.rows.map((r) => [r.district, r.share65, r.confidence]),
    );

  return (
    <section className="border border-border-strong bg-surface-raised p-4">
      <p className="text-sm leading-relaxed text-text">
        {COPILOT.answer.map((part, i) =>
          typeof part === 'string' ? (
            part
          ) : part.b ? (
            <strong key={i} className="font-semibold">
              {part.b}
            </strong>
          ) : (
            <span key={i} className="text-accent">
              {part.em}
            </span>
          ),
        )}
      </p>

      <div className="mt-4 flex justify-end">
        <ExpandButton id="copilot-result" className="-mr-1.5" />
      </div>
      <ExpandSlot id="copilot-result" title={t.copilot.title}>
        {() => <ResultTable />}
      </ExpandSlot>


      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled title={t.copilot.comingNext} className={outlineBtn}>
          <LuMap size={13} />
          <span>{t.copilot.addLayer}</span>
        </button>
        <button type="button" disabled title={t.copilot.comingNext} className={outlineBtn}>
          <LuFileText size={13} />
          <span>{t.copilot.addReport}</span>
        </button>
        <button type="button" onClick={exportCsv} className={outlineBtn}>
          <LuDownload size={13} />
          <span>{t.copilot.export}</span>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-2xs">
        <span className="truncate italic text-muted">{COPILOT.sources}</span>
        <button type="button" disabled title={t.copilot.comingNext} className="shrink-0 text-muted underline underline-offset-2 disabled:opacity-60">
          {t.copilot.lineage}
        </button>
      </div>
    </section>
  );
}


const CONF_ORDER = { High: 3, Medium: 2, Low: 1 };
const resultValue = (r, key) => (key === 'confidence' ? CONF_ORDER[r.confidence] : r[key]);

function ResultTable() {
  const { resultSort, setResultSort } = useCopilot();
  const { rows, sort, sortBy } = useSort(COPILOT.rows, resultValue, { state: resultSort, setState: setResultSort });
  const c = t.copilot.columns;
  return (
    <table className="w-full border border-border text-xs">
      <thead className="bg-field">
        <tr className="h-9">
          <SortTh label={c.district} sortKey="district" sort={sort} onSort={sortBy} className="px-3" />
          <SortTh label={c.share65} sortKey="share65" sort={sort} onSort={sortBy} align="right" className="px-3" />
          <SortTh label={c.confidence} sortKey="confidence" sort={sort} onSort={sortBy} align="right" className="px-3" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.district} className="h-9 border-t border-border">
            <td className="px-3 text-text">{r.district}</td>
            <td className="px-3 text-right font-semibold tabular-nums text-text">{r.share65.toFixed(1)}%</td>
            <td className="px-3">
              <span className="flex justify-end">
                <ConfidencePips level={r.confidence} label={t.copilot.confidence[r.confidence]} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Composer() {
  const { draft, setDraft, send, useExtent, useSelection, toggleExtent, toggleSelection } = useCopilot();
  const { tools, toggleTool } = useWorkspace();
  const inputRef = useRef(null);

  const suggest = (text) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  // Picking on the map switches to the select tool and scopes the question to the selection.
  const pickOnMap = () => {
    if (!tools.select) toggleTool('select');
    if (!useSelection) toggleSelection();
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {COPILOT.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => suggest(s)}
            className="h-7 border border-border bg-field px-2.5 text-2xs text-muted hover:bg-hover hover:text-text"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 border border-border-strong bg-field focus-within:border-accent-line">
        <textarea
          ref={inputRef}
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.copilot.placeholder}
          aria-label={t.copilot.placeholder}
          className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-text outline-none placeholder:text-faint"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" disabled aria-label={t.copilot.attach} title={`${t.copilot.attach} · ${t.copilot.comingNext}`} className={iconBtn}>
            <LuPaperclip size={14} />
          </button>
          <button type="button" onClick={pickOnMap} aria-label={t.copilot.pickOnMap} title={t.copilot.pickOnMap} className={iconBtn}>
            <LuMousePointer2 size={14} />
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            aria-label={t.copilot.send}
            title={t.copilot.send}
            className="ml-auto grid size-8 place-items-center bg-accent text-on-accent hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
          >
            <LuSendHorizontal size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">
          <Checkbox checked={useExtent} onChange={toggleExtent} label={t.copilot.useExtent} />
          <span>{t.copilot.useExtent}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">
          <Checkbox checked={useSelection} onChange={toggleSelection} label={t.copilot.useSelection} />
          <span>{t.copilot.useSelection}</span>
        </label>
      </div>
    </div>
  );
}
