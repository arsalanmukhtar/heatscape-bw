import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getMe, signIn, signOut } from '../lib/api';

/*
  Signed-in user, read from the middleware session (/api/auth/me); never stored in the
  browser. status: idle | loading | in | out | error (sign-in service unreachable).
  Only the language of the sign-in and account pages is remembered (hs-auth).
*/
export const useAuth = create()(
  persist(
    (set, get) => ({
      status: 'idle',
      user: null,
      lang: navigator.language?.startsWith('de') ? 'de' : 'en',
      setLang: (lang) => set({ lang }),
      load: async () => {
        if (get().status === 'loading') return;
        set({ status: 'loading' });
        try {
          const me = await getMe();
          set(me ? { status: 'in', user: me.user } : { status: 'out', user: null });
        } catch {
          set({ status: 'error', user: null });
        }
      },
      signIn: async (email, password, remember) => {
        const { user } = await signIn(email, password, remember);
        set({ status: 'in', user });
        return user;
      },
      signOut: async () => {
        await signOut().catch(() => {});
        set({ status: 'out', user: null });
      },
    }),
    {
      name: 'hs-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lang }) => ({ lang }),
    },
  ),
);

/** Load the session once per page (components call it on mount). */
export function useSession() {
  const s = useAuth();
  useEffect(() => {
    if (useAuth.getState().status === 'idle') useAuth.getState().load();
  }, []);
  return s;
}

export const isAdmin = (user) => !!user?.roles?.includes('admin');

/** A same-origin path to return to after sign-in (never an absolute or protocol URL). */
export const safeNext = (next) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/');
