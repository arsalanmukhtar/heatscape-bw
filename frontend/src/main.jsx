import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/index.css';
import { trackInputModality } from './lib/inputModality';

trackInputModality();

// /portal is the public Heat Portal (citizen view, its own bundle); everything else is the workspace.
const App = lazy(() => import('./App'));
const PortalApp = lazy(() => import('./components/portal/PortalApp'));
const isPortal = /^\/portal(\/|$)/.test(location.pathname);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>{isPortal ? <PortalApp /> : <App />}</Suspense>
  </StrictMode>,
);
