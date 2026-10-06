import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/index.css';
import { trackInputModality } from './lib/inputModality';

trackInputModality();

// Routes, each its own bundle: /portal is the public Heat Portal, /admin the admin and
// operations console (admin role, enforced by the gateway), /signin… and /account the
// sign-in and account pages, everything else the workspace.
const App = lazy(() => import('./App'));
const PortalApp = lazy(() => import('./components/portal/PortalApp'));
const AdminApp = lazy(() => import('./components/admin/AdminApp'));
const AuthApp = lazy(() => import('./components/auth/AuthApp'));
const route = (prefix) => new RegExp(`^/${prefix}(/|$)`).test(location.pathname);
const Root = route('portal') ? PortalApp : route('admin') ? AdminApp : route('signin') || route('account') ? AuthApp : App;
// Which app runs, for app-specific responsive rules (index.css: the portal never scales below 16px).
document.documentElement.dataset.app = route('portal') ? 'portal' : route('admin') ? 'admin' : route('signin') || route('account') ? 'auth' : 'workspace';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
