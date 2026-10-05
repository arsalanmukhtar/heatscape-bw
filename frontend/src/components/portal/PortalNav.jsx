import { useEffect, useRef, useState } from 'react';
import { LuArrowLeft, LuFlame, LuMenu, LuMoon, LuSun, LuX } from 'react-icons/lu';
import { portalText } from '../../i18n';
import { useSession } from '../../state/auth';
import { usePortal } from '../../state/portal';
import { useTheme } from '../../state/theme';

const SECTIONS = ['neighbourhood', 'cool', 'about'];
const TARGET = { neighbourhood: 'portal-neighbourhood', cool: 'portal-cool', about: 'portal-about' };

/*
  Portal top nav: brand, the three sections (inline from 1024 px, in a menu below), the
  language switch and the theme toggle. No sign-in; signed-in staff (session cookie) also
  get a link back to the workspace. Every control is at least 44 px.
*/
export function PortalNav({ wide }) {
  const { lang, setLang, section, setSection, panelOpen, togglePanel, setSheet } = usePortal();
  const { resolved, toggle } = useTheme();
  const { user } = useSession();
  const p = portalText[lang];
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    const esc = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  // Open the panel (or sheet) and scroll to the section's card.
  const go = (id) => {
    setSection(id);
    setMenu(false);
    if (wide && !panelOpen) togglePanel();
    if (!wide) setSheet('full');
    requestAnimationFrame(() => document.getElementById(TARGET[id])?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const links = SECTIONS.map((id) => (
    <a
      key={id}
      href={`#${TARGET[id]}`}
      onClick={(e) => {
        e.preventDefault();
        go(id);
      }}
      aria-current={section === id ? 'true' : undefined}
      className={`flex min-h-11 items-center whitespace-nowrap px-3 text-sm ${section === id ? 'bg-accent-soft font-semibold text-accent' : 'text-nav-text hover:bg-nav-hover'}`}
    >
      {p.nav[id]}
    </a>
  ));

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-nav-border bg-nav pr-2 text-nav-text sm:pr-3">
      <a href="/portal" className="flex h-full items-center gap-3 self-stretch" aria-label={`${p.brand} ${p.portal} ${p.region}`}>
        <span className="grid h-full w-14 shrink-0 place-items-center bg-accent text-on-accent" aria-hidden>
          <LuFlame size={22} strokeWidth={2.25} />
        </span>
        <span className="flex flex-col leading-tight" aria-hidden>
          <span className="text-base font-bold text-nav-text">{p.portal}</span>
          <span className="text-xs text-nav-muted">
            {p.region} · {p.brand}
          </span>
        </span>
      </a>

      {wide && <nav aria-label={p.menu} className="ml-6 hidden items-stretch gap-1 lg:flex">{links}</nav>}

      <div className="ml-auto flex items-center gap-1">
        {user && (
          <a href="/" title={p.backToWorkspace} aria-label={p.backToWorkspace} className="mr-1 flex h-11 items-center gap-2 border border-nav-border bg-bg-deep px-3 text-sm text-nav-text hover:border-nav-border-strong">
            <LuArrowLeft size={15} className="shrink-0 text-nav-muted" aria-hidden />
            <span className="hidden md:inline">{p.backToWorkspace}</span>
          </a>
        )}
        <div role="group" aria-label={p.language} className="flex border border-nav-border">
          {['en', 'de'].map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`grid h-11 w-11 place-items-center text-sm font-semibold ${lang === l ? 'bg-accent-soft text-accent' : 'text-nav-muted hover:bg-nav-hover hover:text-nav-text'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={resolved === 'dark' ? p.themeToLight : p.themeToDark}
          title={resolved === 'dark' ? p.themeToLight : p.themeToDark}
          className="grid size-11 place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          {resolved === 'dark' ? <LuSun size={18} /> : <LuMoon size={18} />}
        </button>
        <div ref={menuRef} className={`relative ${wide ? 'lg:hidden' : ''}`}>
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-haspopup="true"
            aria-label={p.menu}
            title={p.menu}
            className="grid size-11 place-items-center text-nav-text hover:bg-nav-hover"
          >
            {menu ? <LuX size={20} /> : <LuMenu size={20} />}
          </button>
          {menu && <nav aria-label={p.menu} className="absolute right-0 top-[calc(100%+6px)] flex w-72 flex-col border border-border-strong bg-surface-strong py-1 shadow-[var(--shadow-glass)]">{links}</nav>}
        </div>
      </div>
    </header>
  );
}
