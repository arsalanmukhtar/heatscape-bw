// Backend-for-frontend: the single API entry for the browser. Proxies /api/* to the
// backend today; auth sessions, streaming (SSE) and rate limiting will live here.
import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';

const PORT = Number(process.env.PORT ?? 3000);
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:8000';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

app.get('/health', async () => ({ status: 'ok', service: 'middleware' }));

await app.register(proxy, { upstream: BACKEND_URL, prefix: '/api', rewritePrefix: '/api' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ host: '0.0.0.0', port: PORT });
