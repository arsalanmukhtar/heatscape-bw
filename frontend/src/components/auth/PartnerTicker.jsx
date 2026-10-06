import { useEffect, useRef, useState } from 'react';
import { DATA_PROVIDERS, PARTNERS } from '../../data/partners';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useAuthText } from './AuthParts';

const SPEED = 36; // px per second
const COPIES = 3; // enough strip to stay seamless on wide panels
const GROUPS = [
  { id: 'partners', items: PARTNERS },
  { id: 'providers', items: DATA_PROVIDERS },
];

/** One logo in its original colours straight on the row, or a wordmark when there is no
    usable file. */
function Logo({ item, hidden }) {
  return (
    <li className="flex shrink-0 items-center px-3">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={item.name}
        tabIndex={hidden ? -1 : undefined}
        className="flex h-12 items-center px-4"
      >
        {item.src ? (
          <img src={item.src} alt={item.name} draggable={false} className="block h-8 w-auto max-w-[150px] object-contain" />
        ) : (
          <span className="whitespace-nowrap text-sm font-semibold tracking-[-0.01em] text-text">{item.text}</span>
        )}
      </a>
    </li>
  );
}

/*
  Bulletin row at the bottom of the sign-in visual: the partners, then the data providers,
  sliding by in one continuous loop. The heading of the group at the row's centre is
  highlighted; clicking a heading jumps to that group. Pauses on hover and on keyboard
  focus. Reduced motion: no sliding, the row scrolls by hand.
  The strip stays soft ash white in both themes (light tokens), so every logo shows in
  its own website colours; no plates, no theme variants.
*/
export function PartnerTicker() {
  const a = useAuthText();
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [held, setHeld] = useState(false); // hover or focus inside
  const [active, setActive] = useState('partners');
  const viewport = useRef(null);
  const track = useRef(null);
  const copy = useRef(null);
  const providers = useRef(null);
  const offset = useRef(0);
  const stopped = useRef(false);
  stopped.current = held;

  // Which group sits at the centre of the row for a given strip offset.
  const groupAt = (x) => {
    const w = copy.current?.offsetWidth ?? 0;
    if (!w || !viewport.current) return 'partners';
    const p = (x + viewport.current.clientWidth / 2) % w;
    return p < providers.current.offsetLeft ? 'partners' : 'providers';
  };

  useEffect(() => {
    if (reduce) {
      if (track.current) track.current.style.transform = '';
      return;
    }
    let raf;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const w = copy.current?.offsetWidth ?? 0;
      if (w && !stopped.current) {
        offset.current = (offset.current + (SPEED * dt) / 1000) % w;
        track.current.style.transform = `translateX(${-offset.current}px)`;
        setActive(groupAt(offset.current));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const jump = (id) => {
    const start = id === 'partners' ? 0 : providers.current.offsetLeft;
    if (reduce) {
      viewport.current.scrollTo({ left: start, behavior: 'auto' });
    } else {
      offset.current = start;
      track.current.style.transform = `translateX(${-start}px)`;
    }
    setActive(id);
  };

  return (
    <section
      data-theme="light"
      aria-label={`${a.partners} · ${a.providers}`}
      className="relative shrink-0 border-t border-border bg-surface"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
    >
      <div className="relative flex h-10 items-center justify-center border-b border-border-soft px-10">
        <div className="flex items-stretch gap-6 self-stretch">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => jump(g.id)}
              aria-current={active === g.id ? 'true' : undefined}
              className={`flex items-center border-b-2 text-2xs font-semibold uppercase tracking-[var(--tracking-caps)] transition-colors ${
                active === g.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <span>{a[g.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={viewport}
        onScroll={reduce ? (e) => setActive(groupAt(e.currentTarget.scrollLeft)) : undefined}
        className={`${reduce ? 'overflow-x-auto' : 'overflow-hidden'} py-3`}
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 48px, black calc(100% - 48px), transparent)' }}
      >
        <div ref={track} className="flex w-max will-change-transform">
          {Array.from({ length: reduce ? 1 : COPIES }, (_, k) => (
            <div key={k} ref={k === 0 ? copy : undefined} aria-hidden={k > 0 || undefined} className="relative flex">
              {GROUPS.map((g) => (
                <ul key={g.id} ref={k === 0 && g.id === 'providers' ? providers : undefined} aria-label={k === 0 ? a[g.id] : undefined} className="flex items-center border-r border-border-soft px-2">
                  {g.items.map((item) => (
                    <Logo key={item.id} item={item} hidden={k > 0} />
                  ))}
                </ul>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
