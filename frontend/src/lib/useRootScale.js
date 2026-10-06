import { useSyncExternalStore } from 'react';

/*
  The UI scale of the current screen class: root font size / 16 (index.css sets the root
  per breakpoint). For the few things drawn in px from JS (charts measured in px), so they
  scale with the rest of the UI. rem(n) turns a px length at the 16px base into rem.
*/
const read = () => (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;

export function useRootScale() {
  return useSyncExternalStore(
    (onChange) => {
      addEventListener('resize', onChange);
      return () => removeEventListener('resize', onChange);
    },
    read,
  );
}

export const rem = (px) => `${px / 16}rem`;
