import { toBlob } from 'html-to-image';
import { create } from 'zustand';
import { pickSaveFile, writeSaveFile } from './saveFile';

export const MAP_CONTAINER_ID = 'map-container';

/* Mark map UI that must not appear in a snapshot (nav controls, geocoder, focus overlay,
   drag handles) with data-snapshot="exclude"; everything else in the map container is kept. */
export const SNAPSHOT_EXCLUDE = { 'data-snapshot': 'exclude' };

/** capturing: true while a snapshot is taken (the attribution strip shows expanded). */
export const useSnapshot = create((set) => ({ capturing: false, setCapturing: (capturing) => set({ capturing }) }));

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

/**
 * Saves the map container as a PNG: basemap and data layers (map canvases need
 * preserveDrawingBuffer), markers, scale, attribution and other DOM overlays.
 */
export async function captureMap() {
  const node = document.getElementById(MAP_CONTAINER_ID);
  if (!node || useSnapshot.getState().capturing) return;
  const name = `heatscape-map-${stamp()}.png`;
  const file = await pickSaveFile(name);
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
    await writeSaveFile(file, blob, name);
  } finally {
    useSnapshot.getState().setCapturing(false);
  }
}

const VIEW_MAX_W = 1600;

/**
 * The current map view for a report: the WebGL canvas (basemap and data layers; DOM
 * markers are left out) as a JPEG of at most VIEW_MAX_W px, plus the camera so the report
 * can draw its own scale bar and north arrow. Returns null if the map has not drawn yet.
 */
export function captureMapView(map) {
  const canvas = map?.getCanvas();
  if (!canvas?.width || !canvas.clientWidth) return null;
  const k = Math.min(1, VIEW_MAX_W / canvas.width);
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * k);
  out.height = Math.round(canvas.height * k);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
  const { lng, lat } = map.getCenter();
  return {
    image: out.toDataURL('image/jpeg', 0.85),
    width: out.width,
    height: out.height,
    cssWidth: canvas.clientWidth, // map width on screen, for the scale at print size
    center: [lng, lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    at: new Date().toISOString(),
  };
}
