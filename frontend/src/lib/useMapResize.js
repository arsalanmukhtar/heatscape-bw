import { useEffect } from 'react';

/**
 * Keeps a map canvas matched to its container while panels and the dock animate.
 * Resizing clears the WebGL canvas and Mapbox only repaints on its next frame, which shows
 * as a flicker. So resize inside the ResizeObserver callback (after layout, before paint)
 * and render synchronously. Mapbox GL v3 has no public sync redraw; _render is internal,
 * so fall back to triggerRepaint if it ever disappears.
 */
export function useMapResize(containerRef, mapRef) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapRef) return;
    const map = mapRef.getMap();
    const resize = () => {
      // A maximised dock collapses the map to 0 px; skip until it has room again.
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      map.resize();
      if (typeof map._render === 'function' && map.isStyleLoaded()) map._render(performance.now());
      else map.triggerRepaint();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, mapRef]);
}
