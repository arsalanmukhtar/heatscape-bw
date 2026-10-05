// Backend-for-frontend: the single API entry for the browser. Owns the sign-in session
// (src/auth.js) and proxies the rest of /api/* to the backend with the user identity as
// headers set here; streaming (SSE) and rate limiting will live here too.
import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import { authRoutes, sessionOf } from './auth.js';
import { USERS } from './users.js';

const PORT = Number(process.env.PORT ?? 3000);
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:8000';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

app.get('/health', async () => ({ status: 'ok', service: 'middleware' }));

authRoutes(app);

await app.register(proxy, {
  upstream: BACKEND_URL,
  prefix: '/api',
  rewritePrefix: '/api',
  replyOptions: {
    // Identity headers come only from the session, never from the browser; the session
    // cookie stays here.
    rewriteRequestHeaders: (req, headers) => {
      const { cookie, 'x-user-id': _id, 'x-user-email': _email, 'x-user-roles': _roles, ...rest } = headers;
      const s = sessionOf(req);
      return s ? { ...rest, 'x-user-id': s.user.id, 'x-user-email': s.user.email, 'x-user-roles': s.user.roles.join(',') } : rest;
    },
  },
});

for (const u of USERS.filter((x) => !x.password)) app.log.warn({ email: u.email }, 'no password set in .env: this user cannot sign in');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ host: '0.0.0.0', port: PORT });
