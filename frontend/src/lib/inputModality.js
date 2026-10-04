/**
 * Marks <html data-input="pointer|keyboard"> from the last input, so the focus ring
 * shows for keyboard navigation only and never sticks to a clicked element.
 */
export function trackInputModality() {
  const root = document.documentElement;
  const set = (mode) => {
    if (root.dataset.input !== mode) root.dataset.input = mode;
  };
  set('pointer');
  window.addEventListener('pointerdown', () => set('pointer'), true);
  window.addEventListener('keydown', (e) => !e.metaKey && !e.altKey && !e.ctrlKey && set('keyboard'), true);
}
