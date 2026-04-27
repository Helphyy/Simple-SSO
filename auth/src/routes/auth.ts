import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { Users } from '../models/users.js';
import { db } from '../db/index.js';
import { Sessions } from '../models/sessions.js';
import { LoginAttempts } from '../models/login_attempts.js';
import { Audit } from '../models/audit.js';
import { verifyPassword, hashPassword, validatePassword } from '../lib/password.js';
import { Settings } from '../models/settings.js';
import { constantTime } from '../lib/timing.js';
import { loginPage, changePasswordPage, setupPage } from '../views/login.js';
import { userHubPage, profilePage } from '../views/user.js';
import { Clients } from '../models/clients.js';
import { Access } from '../models/access.js';
import { Brand } from '../models/branding.js';
import { render$ } from '../lib/html.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { setCookie } from 'hono/cookie';
import {
  issueSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
} from '../middleware/session.js';

import { csrfValid } from '../lib/csrf.js';
import { getClientIp } from '../middleware/security.js';
import { unsign } from '../lib/signed_cookie.js';
import { getCookie } from 'hono/cookie';
import { isLang, setLangCookie, t, translateZodMessage } from '../lib/i18n.js';

export const authRoutes = new Hono<AppEnv>();

// Anonymous double-submit CSRF cookie for pre-session forms (/login)
const LOGIN_CSRF_COOKIE = 'lc';

function issueLoginCsrf(c: any): string {
  const token = randomBytes(24).toString('hex');
  setCookie(c, LOGIN_CSRF_COOKIE, token, {
    httpOnly: true,
    secure: (c.req.url as string).startsWith('https://'),
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 30,
  });
  return token;
}

function verifyLoginCsrf(cookieToken: string | undefined, formToken: unknown): boolean {
  if (!cookieToken || typeof formToken !== 'string' || !formToken) return false;
  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(formToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}

// ── GET /setup ────────────────────────────────────────────────────
// Available only when setup has never been completed (first run).

function isSetupCompleted(): boolean {
  return Settings.get().setup_completed === 1;
}

authRoutes.get('/setup', (c) => {
  if (isSetupCompleted()) return c.redirect('/login');
  const csrfToken = issueLoginCsrf(c);
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(render$(setupPage({ csrfToken })));
});

const SetupInput = z.object({
  username: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'INVALID_USERNAME_FORMAT'),
  email: z.string().email(),
  password: z.string().min(12),
  confirm: z.string().min(12),
  csrf: z.string().optional(),
});

authRoutes.post('/setup', async (c) => {
  if (isSetupCompleted()) return c.redirect('/login');

  const body = await c.req.parseBody();
  const cookieCsrf = getCookie(c, LOGIN_CSRF_COOKIE);
  const formCsrf = typeof (body as any).csrf === 'string' ? (body as any).csrf : '';

  const fail = (err: string, fd?: any) => {
    const csrfToken = issueLoginCsrf(c);
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.status(400);
    return c.body(render$(setupPage({ error: err, csrfToken, username: fd?.username, email: fd?.email })));
  };

  if (!verifyLoginCsrf(cookieCsrf, formCsrf)) return fail(t('Session expired, please try again.', 'Session expirée, réessaie.'));

  const parsed = SetupInput.safeParse(body);
  if (!parsed.success) return fail(translateZodMessage(parsed.error.errors[0]?.message ?? '') || t('Invalid form.', 'Formulaire invalide.'), body);

  const input = parsed.data;
  if (input.password !== input.confirm) return fail(t('The two passwords do not match.', 'Les deux mots de passe ne correspondent pas.'), input);

  const policy = validatePassword(input.password, [input.username, input.email].filter(Boolean) as string[]);
  if (policy) {
    const msg = policy.code === 'too_short'
      ? `${t('Password too short', 'Mot de passe trop court')} (${policy.min} min).`
      : t('Password too weak.', 'Mot de passe trop faible.');
    return fail(msg, input);
  }

  const hash = await hashPassword(input.password);
  let created;
  try {
    created = db.transaction(() => {
      if (isSetupCompleted()) throw new Error('already_setup');
      const u = Users.create({
        username: input.username,
        email: input.email || null,
        first_name: 'Admin',
        last_name: '',
        password_hash: hash,
        role: 'admin',
        must_change_password: false,
      });
      Settings.update({ setup_completed: 1 });
      return u;
    })();
  } catch (e: any) {
    if (e?.message === 'already_setup') return c.redirect('/login');
    throw e;
  }
  Audit.log({ actorUserId: created.id, action: 'admin.user.create', target: created.id, metadata: { bootstrap: true }, ip: getClientIp(c) });

  // Auto-login
  const session = Sessions.create(created.id, {
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
    pendingPwChange: false,
  });
  Users.markLogin(created.id);
  issueSessionCookie(c, session.id);
  return c.redirect('/admin');
});

// ── GET /login ────────────────────────────────────────────────────
authRoutes.get('/login', (c) => {
  if (!isSetupCompleted()) return c.redirect('/setup');
  const user = c.get('user');
  const next = c.req.query('next') ?? '/admin';
  if (user) return c.redirect((next.startsWith('/') && !next.startsWith('//')) ? next : '/admin');
  const flashKey = c.req.query('flash');
  const flash = flashKey === 'password_changed' ? t('Password changed. You can sign in again.', 'Mot de passe modifié. Vous pouvez vous reconnecter.') : null;
  const csrfToken = issueLoginCsrf(c);
  const clientId = c.req.query('client') ?? null;
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(render$(loginPage({ next, flash, csrfToken, clientId })));
});

// ── POST /login ───────────────────────────────────────────────────
const LoginInput = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(1000),
  next: z.string().max(500).optional(),
  csrf: z.string().optional(),
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const parsed = LoginInput.safeParse(body);
  const ip = getClientIp(c);

  const renderFail = (username: string, error: string) => {
    const csrfToken = issueLoginCsrf(c);
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.status(401);
    return c.body(render$(loginPage({ username, error, csrfToken })));
  };

  const cookieCsrf = getCookie(c, LOGIN_CSRF_COOKIE);
  const formCsrf = typeof (body as any).csrf === 'string' ? (body as any).csrf : '';
  if (!verifyLoginCsrf(cookieCsrf, formCsrf)) {
    return renderFail('', t('Session expired, please try again.', 'Session expirée, réessaie.'));
  }

  if (!parsed.success) {
    return renderFail('', t('Invalid credentials.', 'Identifiants invalides.'));
  }
  const { username, password, next } = parsed.data;

  const settings = Settings.get();
  if (LoginAttempts.isLocked(username, ip)) {
    return renderFail(username, `${t('Too many attempts. Try again in', 'Trop de tentatives. Réessaie dans')} ${settings.lockout_window_minutes} ${t('minutes.', 'minutes.')}`);
  }

  // Constant-time: 500 ms minimum to neutralize timing attacks
  const ok = await constantTime(
    (async () => {
      const mode = settings.login_mode;
      const user =
        mode === 'username' ? Users.findByUsername(username) :
        mode === 'email'    ? Users.findByEmail(username) :
                              (Users.findByUsername(username) ?? Users.findByEmail(username));
      if (!user) {
        // Dummy verify so argon2 hash-dependent time stays constant
        // (hash of a dummy password, discarded)
        await verifyPassword(
          '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          password
        );
        return null;
      }
      if (!user.enabled) return null;
      const valid = await verifyPassword(user.password_hash, password);
      return valid ? user : null;
    })(),
    500
  );

  if (!ok) {
    LoginAttempts.record(username, ip, false);
    Audit.log({
      actorUserId: null,
      action: 'user.login.failure',
      target: username,
      ip,
    });
    return renderFail(username, t('Invalid credentials.', 'Identifiants invalides.'));
  }

  // Success: session ID rotation (do not reuse any previous one)
  const session = Sessions.create(ok.id, {
    ip,
    userAgent: c.req.header('user-agent') ?? null,
    pendingPwChange: !!ok.must_change_password,
  });
  Users.markLogin(ok.id);
  LoginAttempts.record(username, ip, true);
  Audit.log({
    actorUserId: ok.id,
    action: 'user.login.success',
    ip,
  });
  issueSessionCookie(c, session.id);

  // Redirect: change-password or destination
  const dest = ok.must_change_password
    ? '/change-password'
    : (next && (next.startsWith('/') && !next.startsWith('//')) ? next : '/admin');
  return c.redirect(dest);
});

// ── User hub + profile ────────────────────────────────────────────
authRoutes.get('/hub', (c) => {
  const user = c.get('user');
  const session = c.get('session');
  const csrf = c.get('csrfToken');
  if (!user || !session || !csrf) return c.redirect('/login');
  const allowed = Access.clientsForUser(user.id);
  const apps = Clients.listAll()
    .filter((cl) => allowed.includes(cl.id))
    .map((cl) => {
      const cb = Brand.getClient(cl.id);
      return {
        ...cl,
        logo: cb.logo_data_url,
        displayName: cb.app_name ?? cl.name,
      };
    });
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(render$(userHubPage({ user, csrfToken: csrf, apps })));
});

authRoutes.get('/account', (c) => {
  const user = c.get('user');
  const csrf = c.get('csrfToken');
  if (!user || !csrf) return c.redirect('/login');
  const flashKey = c.req.query('flash');
  const flash = flashKey === 'saved' ? t('Profile saved.', 'Profil enregistré.')
              : flashKey === 'password' ? t('Password changed.', 'Mot de passe modifié.')
              : null;
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(render$(profilePage({ user, csrfToken: csrf, flash })));
});

const ProfileInput = z.object({
  first_name: z.string().max(100).optional().default(''),
  last_name: z.string().max(100).optional().default(''),
  email: z.string().email(),
  csrf: z.string(),
});

authRoutes.post('/account', async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  const csrf = c.get('csrfToken');
  if (!user || !session || !csrf) return c.redirect('/login');
  const body = await c.req.parseBody();
  if (!csrfValid(session.id, typeof body.csrf === 'string' ? body.csrf : '')) return c.text('CSRF invalid', 403);
  const parsed = ProfileInput.safeParse(body);
  if (!parsed.success) {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.status(400);
    return c.body(render$(profilePage({ user, csrfToken: csrf, error: translateZodMessage(parsed.error.errors[0]?.message ?? '') || t('Invalid.', 'Invalide.') })));
  }
  if (parsed.data.email && parsed.data.email !== user.email) {
    const clash = Users.findByEmail(parsed.data.email);
    if (clash && clash.id !== user.id) {
      c.header('Content-Type', 'text/html; charset=utf-8');
      c.status(400);
      return c.body(render$(profilePage({ user, csrfToken: csrf, error: t('Email already used.', 'Email déjà utilisé.') })));
    }
  }
  Users.update(user.id, {
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email || null,
  });
  Audit.log({ actorUserId: user.id, action: 'user.profile.updated', ip: getClientIp(c) });
  return c.redirect('/account?flash=saved');
});

const ProfilePwInput = z.object({
  current: z.string().min(1),
  next: z.string().min(12),
  confirm: z.string().min(12),
  csrf: z.string(),
});

authRoutes.post('/account/password', async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  const csrf = c.get('csrfToken');
  if (!user || !session || !csrf) return c.redirect('/login');
  const body = await c.req.parseBody();
  if (!csrfValid(session.id, typeof body.csrf === 'string' ? body.csrf : '')) return c.text('CSRF invalid', 403);
  const parsed = ProfilePwInput.safeParse(body);
  const renderErr = (msg: string) => {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.status(400);
    return c.body(render$(profilePage({ user, csrfToken: csrf, error: msg })));
  };
  if (!parsed.success) return renderErr(t('Invalid form.', 'Formulaire invalide.'));
  if (parsed.data.next !== parsed.data.confirm) return renderErr(t('The two passwords do not match.', 'Les deux mots de passe ne correspondent pas.'));
  const valid = await verifyPassword(user.password_hash, parsed.data.current);
  if (!valid) return renderErr(t('Current password is incorrect.', 'Mot de passe actuel incorrect.'));
  const policy = validatePassword(parsed.data.next, [user.username, user.email, user.first_name, user.last_name].filter(Boolean) as string[]);
  if (policy) {
    return renderErr(policy.code === 'too_short' ? `${t('Password too short', 'Mot de passe trop court')} (${policy.min} min).` : t('Password too weak.', 'Mot de passe trop faible.'));
  }
  const hash = await hashPassword(parsed.data.next);
  Users.setPassword(user.id, hash, false);
  Audit.log({ actorUserId: user.id, action: 'user.password.changed', ip: getClientIp(c) });
  return c.redirect('/account?flash=password');
});

// ── POST /language ────────────────────────────────────────────────
// Public (no CSRF on this benign UX preference; cookie-based, SameSite=Lax).
authRoutes.post('/language', async (c) => {
  const body = await c.req.parseBody();
  const lang = typeof body.lang === 'string' ? body.lang : '';
  if (isLang(lang)) setLangCookie(c, lang);

  const safeLocalPath = (p: string): string | null => {
    if (!p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return null;
    return p;
  };

  let back: string | null = null;
  if (typeof body.next === 'string') back = safeLocalPath(body.next);
  if (!back) {
    const ref = c.req.header('referer');
    const origin = new URL(c.req.url).origin;
    if (ref && ref.startsWith(origin + '/')) {
      try {
        const u = new URL(ref);
        back = safeLocalPath(u.pathname + u.search);
      } catch { /* ignore */ }
    }
  }
  return c.redirect(back ?? '/');
});

// ── POST /logout ──────────────────────────────────────────────────
authRoutes.post('/logout', async (c) => {
  const session = c.get('session');
  if (session) {
    const body = await c.req.parseBody();
    const token = typeof body.csrf === 'string' ? body.csrf : '';
    if (!csrfValid(session.id, token)) {
      return c.text('CSRF: invalid token', 403);
    }
  }
  const raw = getCookie(c, SESSION_COOKIE);
  if (raw) {
    const sid = unsign(raw);
    if (sid) {
      const s = Sessions.get(sid);
      if (s) {
        Audit.log({ actorUserId: s.user_id, action: 'user.logout', ip: getClientIp(c) });
        Sessions.destroy(sid);
      }
    }
  }
  clearSessionCookie(c);
  return c.redirect('/login');
});

// ── GET /change-password ──────────────────────────────────────────
authRoutes.get('/change-password', (c) => {
  const user = c.get('user');
  const session = c.get('session');
  const csrf = c.get('csrfToken');
  if (!user || !session || !csrf) return c.redirect('/login');
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(render$(changePasswordPage({ csrfToken: csrf, username: user.username })));
});

// ── POST /change-password ─────────────────────────────────────────
const ChangePwInput = z.object({
  current: z.string().min(1),
  next: z.string().min(12),
  confirm: z.string().min(1),
  csrf: z.string(),
});

authRoutes.post('/change-password', async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  const csrf = c.get('csrfToken');
  if (!user || !session || !csrf) return c.redirect('/login');

  const body = await c.req.parseBody();
  const parsed = ChangePwInput.safeParse(body);

  const renderFail = (error: string) => {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.status(400);
    return c.body(render$(changePasswordPage({
      csrfToken: csrf,
      username: user.username,
      error,
    })));
  };

  if (!parsed.success) return renderFail(t('Invalid form.', 'Formulaire invalide.'));
  if (!csrfValid(session.id, parsed.data.csrf)) return renderFail(t('Invalid CSRF token.', 'Jeton CSRF invalide.'));

  const { current, next: nextPw, confirm } = parsed.data;
  if (nextPw !== confirm) return renderFail(t('The two passwords do not match.', 'Les deux mots de passe ne correspondent pas.'));
  if (nextPw === current) return renderFail(t('The new password must be different.', 'Le nouveau mot de passe doit être différent.'));

  const valid = await verifyPassword(user.password_hash, current);
  if (!valid) return renderFail(t('Current password is incorrect.', 'Mot de passe actuel incorrect.'));

  const policyErr = validatePassword(nextPw, [user.username, user.email, user.first_name, user.last_name].filter(Boolean) as string[]);
  if (policyErr) {
    if (policyErr.code === 'too_short') return renderFail(`${t('Password too short', 'Mot de passe trop court')} (${policyErr.min} ${t('characters minimum', 'caractères minimum')}).`);
    // Skip zxcvbn suggestion (English-only) — keep a single localized hint.
    return renderFail(t('Password too weak: choose something more complex.', 'Mot de passe trop faible : choisis quelque chose de plus complexe.'));
  }

  const hash = await hashPassword(nextPw);
  Users.setPassword(user.id, hash, false);
  Sessions.clearPwChange(session.id);
  // Invalidate all OTHER sessions for the user (not the one we are using)
  // MVP simplification: invalidate everything then regenerate this one.
  Sessions.destroyAllForUser(user.id);
  const fresh = Sessions.create(user.id, {
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
    pendingPwChange: false,
  });
  issueSessionCookie(c, fresh.id);

  Audit.log({
    actorUserId: user.id,
    action: 'user.password.changed',
    ip: getClientIp(c),
  });

  if (user.role === 'admin') return c.redirect('/admin');
  // Non-admin: no home on the IdP. Close the session and send back to login.
  Sessions.destroyAllForUser(user.id);
  clearSessionCookie(c);
  return c.redirect('/login?flash=password_changed');
});
