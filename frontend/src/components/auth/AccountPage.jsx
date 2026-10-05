import { useEffect, useState } from 'react';
import { LuArrowLeft, LuKeyRound, LuLogOut, LuMonitorSmartphone, LuSlidersHorizontal, LuUserRound } from 'react-icons/lu';
import { useAuth, useSession } from '../../state/auth';
import { useTheme } from '../../state/theme';
import { Chip, PageHead } from '../admin/AdminParts';
import { Segmented } from '../controls';
import { MAP_OVERLAY_ID } from '../Expandable';
import { Brand } from '../TopNav';
import { AccountSessions } from './AccountSessions';
import { AccountTokens } from './AccountTokens';
import { AuthLink, Banner, CornerControls, useAuthText } from './AuthParts';

const SECTIONS = { profile: LuUserRound, preferences: LuSlidersHorizontal, sessions: LuMonitorSmartphone, tokens: LuKeyRound };
const sectionFromHash = () => (location.hash.slice(1) in SECTIONS ? location.hash.slice(1) : 'profile');

/*
  Account settings (/account, signed in only): profile, language and theme, active
  sessions (live from the middleware), API tokens (MOCK). Section in the URL hash.
*/
export function AccountPage() {
  const a = useAuthText();
  const ac = a.account;
  const { status, user, lang, signOut } = useSession();
  const [section, setSection] = useState(sectionFromHash);

  useEffect(() => {
    if (status === 'out') location.replace('/signin?next=/account');
  }, [status]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => {
    history.replaceState({}, '', `#${id}`);
    setSection(id);
  };

  const leave = async () => {
    await signOut();
    location.assign('/signin');
  };

  return (
    <div lang={lang} className="flex h-full flex-col">
      <header className="flex shrink-0 items-center border-b border-nav-border bg-nav pr-3 text-nav-text sm:pr-4" style={{ height: 'var(--nav-h)' }}>
        <Brand />
        <span className="mx-4 hidden h-6 w-px bg-nav-border sm:block lg:mx-6" aria-hidden />
        <span className="hidden text-sm font-semibold text-nav-text sm:inline">{ac.title}</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a href="/" className="hidden h-[30px] items-center gap-2 border border-nav-border bg-bg-deep px-3 text-xs text-nav-text hover:border-nav-border-strong md:flex">
            <LuArrowLeft size={13} className="shrink-0 text-nav-muted" aria-hidden />
            <span>{a.backToWorkspace}</span>
          </a>
          <CornerControls />
          {user && (
            <button type="button" onClick={leave} className="flex h-[30px] items-center gap-2 border border-nav-border px-2.5 text-xs text-nav-text hover:bg-nav-hover">
              <LuLogOut size={13} className="shrink-0 text-nav-muted" aria-hidden />
              <span className="hidden sm:inline">{ac.signOut}</span>
            </button>
          )}
        </div>
      </header>

      {status === 'error' && (
        <div className="p-6">
          <Banner tone="error">{a.errors.unreachable}</Banner>
        </div>
      )}

      {status === 'in' && user && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav aria-label={ac.title} className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border bg-surface p-2 md:w-64 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r">
            {Object.entries(SECTIONS).map(([id, Icon]) => {
              const active = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 shrink-0 items-center gap-3 border px-3 py-2 text-left ${active ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-hover'}`}
                >
                  <Icon size={16} className={`shrink-0 ${active ? 'text-accent' : 'text-muted'}`} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate whitespace-nowrap text-sm text-text">{ac.sections[id]}</span>
                    <span className="hidden truncate text-2xs text-muted md:block">{ac.hints[id]}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <main className="relative min-h-0 min-w-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto bg-bg">
              <PageHead title={ac.sections[section]} hint={ac.hints[section]} />
              <div className="max-w-5xl px-6 pb-6">
                {section === 'profile' && <Profile user={user} />}
                {section === 'preferences' && <Preferences />}
                {section === 'sessions' && <AccountSessions onSignedOut={leave} />}
                {section === 'tokens' && <AccountTokens />}
              </div>
            </div>
            {/* Expanded tables cover the page here (see Expandable). */}
            <div id={MAP_OVERLAY_ID} className="pointer-events-none absolute inset-0 z-30" />
          </main>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-border-soft px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-text">{children}</dd>
    </div>
  );
}

function Profile({ user }) {
  const a = useAuthText();
  const p = a.account.profile;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <dl className="border border-border bg-surface">
        <Row label={p.name}>
          <span>{user.name}</span>
        </Row>
        <Row label={p.email}>
          <span className="min-w-0 truncate">{user.email}</span>
          <Chip color={user.emailVerified ? 'var(--success)' : 'var(--warning)'}>{user.emailVerified ? p.verified : p.unverified}</Chip>
          {!user.emailVerified && (
            <AuthLink to="/signin/verify-email" className="text-xs">
              {p.verifyNow}
            </AuthLink>
          )}
        </Row>
        <Row label={p.org}>
          <span>{user.org}</span>
        </Row>
        <Row label={p.roles}>
          {user.roles.map((r) => (
            <Chip key={r} color={r === 'admin' ? 'var(--series-1)' : 'var(--series-2)'}>
              {a.roles[r] ?? r}
            </Chip>
          ))}
        </Row>
      </dl>
      <Banner tone="info">{p.managed}</Banner>
    </div>
  );
}

function Preferences() {
  const a = useAuthText();
  const p = a.account.preferences;
  const { lang, setLang } = useAuth();
  const { mode, setMode } = useTheme();
  return (
    <dl className="max-w-2xl border border-border bg-surface">
      <Row label={p.language}>
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex w-56">
            <Segmented
              value={lang}
              onChange={setLang}
              label={p.language}
              options={[
                { value: 'en', label: 'English' },
                { value: 'de', label: 'Deutsch' },
              ]}
            />
          </div>
          <p className="text-xs text-muted">{p.languageNote}</p>
        </div>
      </Row>
      <Row label={p.theme}>
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex w-72">
            <Segmented value={mode} onChange={setMode} label={p.theme} options={['dark', 'light', 'system'].map((m) => ({ value: m, label: p.themes[m] }))} />
          </div>
          <p className="text-xs text-muted">{p.themeNote}</p>
        </div>
      </Row>
    </dl>
  );
}
