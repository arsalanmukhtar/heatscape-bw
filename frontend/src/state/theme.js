import { create } from 'zustand';

const STORAGE_KEY = 'hs-theme';
const MODES = ['dark', 'light', 'system'];
const lightQuery = () => window.matchMedia?.('(prefers-color-scheme: light)');

function readMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(stored)) return stored;
  } catch {
    /* storage unavailable: fall back to the default */
  }
  return 'dark';
}

const resolve = (mode) => (mode !== 'system' ? mode : lightQuery()?.matches ? 'light' : 'dark');
const apply = (resolved) => document.documentElement.setAttribute('data-theme', resolved);

const initialMode = readMode();

export const useTheme = create()((set, get) => ({
  mode: initialMode, // dark | light | system
  resolved: resolve(initialMode), // dark | light
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* not persisted, still applied */
    }
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
  },
  toggle: () => get().setMode(get().resolved === 'dark' ? 'light' : 'dark'),
}));

// Follow the OS setting while the mode is "system".
lightQuery()?.addEventListener('change', () => {
  const { mode } = useTheme.getState();
  if (mode !== 'system') return;
  const resolved = resolve(mode);
  apply(resolved);
  useTheme.setState({ resolved });
});
