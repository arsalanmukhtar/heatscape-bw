import { useId, useRef, useState } from 'react';
import { LuCircleAlert, LuCircleCheck, LuEye, LuEyeOff, LuFlame, LuInfo, LuMoon, LuSun } from 'react-icons/lu';
import { authText } from '../../i18n';
import { useAuth } from '../../state/auth';
import { useTheme } from '../../state/theme';
import { HeatVisual } from './HeatVisual';
import { PartnerTicker } from './PartnerTicker';

/** The strings of the current page language. */
export const useAuthText = () => authText[useAuth((s) => s.lang)];

/** Same-tab navigation between the auth pages without a reload (AuthApp listens). */
export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

/** Link to another auth page (plain href for new tabs, in-app navigation on click). */
export function AuthLink({ to, className = '', children }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      className={`text-accent underline-offset-2 hover:underline ${className}`}
    >
      {children}
    </a>
  );
}

/** Language switch (EN/DE) and theme toggle, top right of every auth page. */
export function CornerControls() {
  const a = useAuthText();
  const { lang, setLang } = useAuth();
  const { resolved, toggle } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <div role="group" aria-label={a.language} className="flex border border-border">
        {['en', 'de'].map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={`grid h-8 w-10 place-items-center text-xs font-semibold ${lang === l ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-text'}`}
          >
            <span className="uppercase">{l}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={resolved === 'dark' ? a.themeToLight : a.themeToDark}
        title={resolved === 'dark' ? a.themeToLight : a.themeToDark}
        className="grid size-8 place-items-center text-muted hover:bg-hover hover:text-text"
      >
        {resolved === 'dark' ? <LuSun size={15} /> : <LuMoon size={15} />}
      </button>
    </div>
  );
}

function Wordmark({ large = false, ref }) {
  const a = useAuthText();
  return (
    <span ref={ref} className="flex w-fit items-center gap-3">
      <span className={`grid shrink-0 place-items-center bg-accent text-on-accent ${large ? 'size-14' : 'size-8'}`} aria-hidden>
        <LuFlame size={large ? 28 : 17} strokeWidth={2.25} />
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={`font-bold tracking-[-0.01em] text-text ${large ? 'text-[calc(var(--fs-2xl)*1.25)]' : 'text-base'}`}>{a.brand}</span>
        <span className={`font-bold uppercase tracking-[var(--tracking-caps)] text-accent ${large ? 'text-[calc(var(--fs-sm)*1.25)]' : 'text-xs'}`}>{a.region}</span>
      </span>
    </span>
  );
}

/*
  Split screen from 1024 px: the heat visual with name and value statement over the
  partner / data provider logo row (55 %), the form on a surface panel (45 %). Below: form only, under a slim
  visual header. The visual always uses the dark tokens (data-theme="dark").
*/
export function AuthLayout({ children }) {
  const a = useAuthText();
  const { lang } = useAuth();
  // Titles the heat cells keep dark behind.
  const brand = useRef(null);
  const statement = useRef(null);
  const slimBrand = useRef(null);
  return (
    <div lang={lang} className="flex h-full bg-bg">
      <aside data-theme="dark" className="relative hidden w-[55%] shrink-0 flex-col overflow-hidden border-r border-border lg:flex">
        <HeatVisual className="absolute inset-0" avoid={[brand, statement]} />
        <div className="relative flex min-h-0 flex-1 flex-col justify-between p-10 xl:p-14">
          <Wordmark large ref={brand} />
          <p ref={statement} className="mb-8 w-fit max-w-xl text-[calc(var(--fs-2xl)*1.25)] font-semibold leading-snug text-text xl:text-[calc(1.875rem*1.25)]">
            {a.statement}
          </p>
        </div>
        <PartnerTicker />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface">
        <div data-theme="dark" className="relative h-20 shrink-0 overflow-hidden border-b border-border lg:hidden">
          <HeatVisual className="absolute inset-0" avoid={[slimBrand]} />
          <div className="relative flex h-full items-center px-5">
            <Wordmark ref={slimBrand} />
          </div>
        </div>
        <div className="flex shrink-0 justify-end px-4 pt-4">
          <CornerControls />
        </div>
        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="flex shrink-0 items-center justify-center gap-5 px-5 pb-5 text-xs text-muted">
          {/* Legal pages are not published yet; the links name them for the Keycloak theme. */}
          <a href="#imprint" title={a.legalPlanned} className="hover:text-text">
            {a.imprint}
          </a>
          <a href="#privacy" title={a.legalPlanned} className="hover:text-text">
            {a.privacy}
          </a>
        </footer>
      </div>
    </div>
  );
}

/** Form title with an optional MOCK chip and a lead sentence. */
export function FormHead({ title, text, mock = false }) {
  const a = useAuthText();
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {mock && (
          <span className="level-chip" style={{ '--chip': 'var(--warning)' }}>
            {a.mock}
          </span>
        )}
      </div>
      {text && <p className="mt-1.5 text-justify text-sm text-muted">{text}</p>}
    </div>
  );
}

const TONES = {
  error: { Icon: LuCircleAlert, color: 'var(--danger)', bg: 'var(--danger-soft)', role: 'alert' },
  success: { Icon: LuCircleCheck, color: 'var(--success)', bg: 'var(--success-soft)', role: 'status' },
  info: { Icon: LuInfo, color: 'var(--info)', bg: 'var(--info-soft)', role: 'status' },
  warning: { Icon: LuInfo, color: 'var(--warning)', bg: 'var(--warning-soft)', role: 'status' },
};

/** Message banner: tinted background, a 2 px bar and icon in the status colour, text in --text. */
export function Banner({ tone = 'info', children, className = '' }) {
  const { Icon, color, bg, role } = TONES[tone];
  return (
    <div role={role} className={`flex items-start gap-2.5 border-l-2 px-3 py-2.5 text-sm text-text ${className}`} style={{ borderLeftColor: color, background: bg }}>
      <Icon size={15} className="mt-px shrink-0" style={{ color }} aria-hidden />
      <span className="min-w-0 flex-1 text-justify">{children}</span>
    </div>
  );
}

const inputCls = (invalid) =>
  `h-8 w-full min-w-0 border bg-field px-2.5 text-sm text-text outline-none placeholder:text-faint ${invalid ? 'border-[var(--danger)]' : 'border-border focus:border-accent-line'}`;

/** Label above, input, inline error under it (linked by aria-describedby). */
export function AuthField({ label, error, hint, children }) {
  const id = useId();
  const errId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text">
        {label}
      </label>
      {children({ id, invalid: !!error, describedBy: error ? errId : undefined, className: inputCls(!!error) })}
      {error ? (
        <p id={errId} className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
          <LuCircleAlert size={12} className="shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle inside the field. */
export function PasswordInput({ id, value, onChange, onBlur, invalid, describedBy, className, autoComplete = 'current-password' }) {
  const a = useAuthText();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? a.hidePassword : a.showPassword}
        aria-pressed={shown}
        title={shown ? a.hidePassword : a.showPassword}
        className="absolute inset-y-0 right-0 grid w-8 place-items-center text-muted hover:text-text"
      >
        {shown ? <LuEyeOff size={14} /> : <LuEye size={14} />}
      </button>
    </div>
  );
}

/** Full-width primary button (accent); busy shows a thin progress line, never a spinner. */
export function PrimaryButton({ busy = false, children, ...rest }) {
  return (
    <button
      {...rest}
      aria-busy={busy || undefined}
      className="relative flex h-9 w-full items-center justify-center gap-2 overflow-hidden bg-accent px-4 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-60"
    >
      <span>{children}</span>
      {busy && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-on-accent/25">
          <span className="progress-sweep block h-full w-1/4 bg-on-accent" />
        </span>
      )}
    </button>
  );
}

/** Full-width secondary (outlined) button. */
export function SecondaryButton({ children, icon, ...rest }) {
  return (
    <button {...rest} className="flex h-9 w-full items-center justify-center gap-2 border border-border-strong bg-transparent px-4 text-sm text-text hover:bg-hover disabled:opacity-60">
      {icon}
      <span>{children}</span>
    </button>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
