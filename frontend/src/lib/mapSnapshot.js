import { toBlob } from 'html-to-image';
import { create } from 'zustand';

export const MAP_CONTAINER_ID = 'map-container';

/* Mark map UI that must not appear in a snapshot (nav controls, geocoder, focus overlay,
   drag handles) with data-snapshot="exclude"; everything else in the map container is kept. */
export const SNAPSHOT_EXCLUDE = { 'data-snapshot': 'exclude' };

/** capturing: true while a snapshot is taken (the attribution strip shows expanded). */
export const useSnapshot = create((set) => ({ capturing: false, setCapturing: (capturing) => set({ capturing }) }));

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

/**
 * Asks for folder and file name (File System Access API, Chromium). Runs first, while the
 * click still counts as a user gesture. Returns null if the user cancels, undefined where
 * the API is missing (a normal download with the default name is used instead).
 */
async function pickFile(name) {
  if (!window.showSaveFilePicker) return undefined;
  try {
    return await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
    });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Saves the map container as a PNG: basemap and data layers (map canvases need
 * preserveDrawingBuffer), markers, scale, attribution and other DOM overlays.
 */
export async function captureMap() {
  const node = document.getElementById(MAP_CONTAINER_ID);
  if (!node || useSnapshot.getState().capturing) return;
  const name = `heatscape-map-${stamp()}.png`;
  const file = await pickFile(name);
  if (file === null) return;
  useSnapshot.getState().setCapturing(true);
  try {
    // Let the attribution strip render expanded before the DOM is cloned.
    await nextFrame();
    await nextFrame();
    const blob = await toBlob(node, {
      pixelRatio: window.devicePixelRatio || 1,
      filter: (el) => !(el instanceof HTMLElement && el.dataset.snapshot === 'exclude'),
    });
    if (file) {
      const out = await file.createWritable();
      await out.write(blob);
      await out.close();
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  } finally {
    useSnapshot.getState().setCapturing(false);
  }
}
