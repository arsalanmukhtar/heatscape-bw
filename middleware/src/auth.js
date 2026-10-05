// Sign-in sessions (interim, until the Keycloak OIDC session replaces the password check):
// an opaque id in an httpOnly cookie, the session itself in memory here, so nothing about
// the user is readable or forgeable in the browser. Sessions end when the middleware restarts.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { publicUser, USERS } from './users.js';

export const COOKIE = 'hs_session';
const HOUR = 3600 * 1000;
const TTL = { session: 12 * HOUR, remember: 30 * 24 * HOUR };
const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60 * 1000;

const sessions = new Map(); // cookie value → { id, userId, createdAt, lastSeen, expiresAt, userAgent, ip, remember }
const failures = new Map(); // ip|email → [timestamps]

// Drop expired sessions and old failure counts now and then (unref: never keeps the process alive).
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) if (s.expiresAt < now) sessions.delete(key);
  for (const [id, list] of failures) if (!list.some((t) => now - t < FAIL_WINDOW)) failures.delete(id);
}, 10 * 60 * 1000).unref();

const error = (reply, status, code, message, extra) => reply.code(status).send({ error: { code, message, ...extra } });

const digest = (s) => createHash('sha256').update(String(s)).digest();
const samePassword = (given, stored) => stored != null && timingSafeEqual(digest(given), digest(stored));

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(req, reply, value, maxAgeMs) {
  const attrs = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeMs != null) attrs.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  if (req.headers['x-forwarded-proto'] === 'https') attrs.push('Secure');
  reply.header('Set-Cookie', attrs.join('; '));
}

const clientIp = (req) => req.headers['x-real-ip'] ?? req.ip;

/** The live session of a request (refreshes lastSeen), or null. */
export function sessionOf(req) {
  const key = parseCookies(req.headers.cookie)[COOKIE];
  const s = key && sessions.get(key);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(key);
    return null;
  }
  s.lastSeen = Date.now();
  const user = USERS.find((u) => u.id === s.userId);
  return user ? { key, session: s, user } : null;
}

/** Recent failed attempts for this ip + email (older ones are dropped). */
function recentFailures(id) {
  const now = Date.now();
  const list = (failures.get(id) ?? []).filter((t) => now - t < FAIL_WINDOW);
  failures.set(id, list);
  return list;
}

const sessionView = (s, currentKey, key) => ({
  id: s.id,
  createdAt: new Date(s.createdAt).toISOString(),
  lastSeen: new Date(s.lastSeen).toISOString(),
  expiresAt: new Date(s.expiresAt).toISOString(),
  userAgent: s.userAgent,
  ip: s.ip,
  remember: s.remember,
  current: key === currentKey,
});

export function authRoutes(app) {
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password, remember } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return error(reply, 400, 'invalid_request', 'Email and password are required.');
    }
    const id = `${clientIp(req)}|${email.toLowerCase()}`;
    const recent = recentFailures(id);
    if (recent.length >= FAIL_MAX) {
      const retryAfter = Math.ceil((FAIL_WINDOW - (Date.now() - recent[0])) / 1000);
      reply.header('Retry-After', retryAfter);
      return error(reply, 429, 'too_many_attempts', 'Too many failed sign-in attempts.', { retryAfter });
    }
    const user = USERS.find((u) => u.email === email.trim().toLowerCase());
    // Compare even for unknown emails so response time does not reveal which emails exist.
    const ok = samePassword(password, user?.password ?? randomUUID()) && user?.password != null;
    if (!ok) {
      recent.push(Date.now());
      req.log.warn({ email: email.toLowerCase() }, 'sign-in failed');
      return error(reply, 401, 'invalid_credentials', 'Email or password is wrong.');
    }
    failures.delete(id);
    const previous = sessionOf(req); // switching accounts ends the old session
    if (previous) sessions.delete(previous.key);
    const key = randomBytes(32).toString('base64url');
    const now = Date.now();
    const ttl = remember ? TTL.remember : TTL.session;
    sessions.set(key, { id: randomUUID(), userId: user.id, createdAt: now, lastSeen: now, expiresAt: now + ttl, userAgent: req.headers['user-agent'] ?? '', ip: clientIp(req), remember: !!remember });
    setCookie(req, reply, key, remember ? ttl : null);
    req.log.info({ user: user.id }, 'signed in');
    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const s = sessionOf(req);
    if (s) sessions.delete(s.key);
    setCookie(req, reply, '', 0);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (req, reply) => {
    const s = sessionOf(req);
    if (!s) return error(reply, 401, 'unauthenticated', 'Not signed in.');
    return { user: publicUser(s.user), session: { id: s.session.id, expiresAt: new Date(s.session.expiresAt).toISOString() } };
  });

  app.get('/api/auth/sessions', async (req, reply) => {
    const s = sessionOf(req);
    if (!s) return error(reply, 401, 'unauthenticated', 'Not signed in.');
    const mine = [...sessions.entries()].filter(([, x]) => x.userId === s.user.id && x.expiresAt > Date.now());
    return { sessions: mine.map(([key, x]) => sessionView(x, s.key, key)).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)) };
  });

  // Sign out one session of the current user (its public id), or all others with id "others".
  app.delete('/api/auth/sessions/:id', async (req, reply) => {
    const s = sessionOf(req);
    if (!s) return error(reply, 401, 'unauthenticated', 'Not signed in.');
    const { id } = req.params;
    let removed = 0;
    for (const [key, x] of sessions) {
      if (x.userId !== s.user.id) continue;
      if (id === 'others' ? key !== s.key : x.id === id) {
        sessions.delete(key);
        removed += 1;
      }
    }
    if (!removed && id !== 'others') return error(reply, 404, 'not_found', 'No such session.');
    return reply.code(204).send();
  });

  // Gateway auth_request: 204 when the session has the role, 401 signed out, 403 lacking it.
  // Not under /api, so the gateway never routes browser requests here.
  app.get('/auth/check/:role', async (req, reply) => {
    const s = sessionOf(req);
    if (!s) return reply.code(401).send();
    return reply.code(s.user.roles.includes(req.params.role) ? 204 : 403).send();
  });
}
