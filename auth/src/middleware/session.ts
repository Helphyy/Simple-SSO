import type { Context, MiddlewareHandler, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, unsign } from '../lib/signed_cookie.js';
import { csrfFor, csrfValid } from '../lib/csrf.js';
import { Sessions } from '../models/sessions.js';
import { Users } from '../models/users.js';
import { config } from '../config.js';

export const SESSION_COOKIE = 'sid';

/**
 * Charge la session depuis le cookie signé. Attache `session`, `user` et
 * `csrfToken` à `c.var`. Ne rejette pas les requêtes — c'est à l'appelant
 * via requireAuth/requireAdmin.
 */
export const loadSession: MiddlewareHandler = async (c, next) => {
  c.set('session', null);
  c.set('user', null);
  c.set('csrfToken', null);

  const raw = getCookie(c, SESSION_COOKIE);
  if (raw) {
    const sid = unsign(raw);
    if (sid) {
      const s = Sessions.touch(sid);
      if (s) {
        const u = Users.findById(s.user_id);
        if (u && u.enabled) {
          c.set('session', s);
          c.set('user', u);
          c.set('csrfToken', csrfFor(s.id));
        } else {
          // user désactivé → invalider la session côté serveur aussi
          Sessions.destroy(sid);
          deleteCookie(c, SESSION_COOKIE, { path: '/' });
        }
      } else {
        deleteCookie(c, SESSION_COOKIE, { path: '/' });
      }
    } else {
      // cookie forgé ou secret changé → on le purge
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
    }
  }

  await next();
};

export function issueSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sign(sessionId), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours max
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export const requireAuth: MiddlewareHandler = async (c, next: Next) => {
  const user = c.get('user');
  const session = c.get('session');
  if (!user || !session) {
    const nextUrl = new URL(c.req.url).pathname + new URL(c.req.url).search;
    return c.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }
  // Si changement de mdp requis, forcer la route dédiée.
  const path = new URL(c.req.url).pathname;
  if (session.pending_pw_change && path !== '/change-password' && path !== '/logout') {
    return c.redirect('/change-password');
  }
  await next();
};

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/login');
  }
  if (user.role !== 'admin') {
    return c.redirect('/');
  }
  await next();
};

/**
 * Vérifie le CSRF token pour les requêtes mutantes. À appliquer aux routes
 * POST non-OIDC (OIDC a sa propre protection via PKCE + state).
 */
export const requireCsrf: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  const session = c.get('session');
  if (!session) {
    return c.text('CSRF: no session', 403);
  }
  const body = await c.req.parseBody();
  const token = typeof body.csrf === 'string' ? body.csrf : '';
  if (!csrfValid(session.id, token)) {
    return c.text('CSRF: invalid token', 403);
  }
  // Re-stocker le body parsed pour que la route n'ait pas à re-parser
  c.set('parsedBody' as any, body);
  await next();
};
