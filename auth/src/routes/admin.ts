import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { Users } from '../models/users.js';
import { Groups } from '../models/groups.js';
import { Clients } from '../models/clients.js';
import { Brand } from '../models/branding.js';
import { Settings } from '../models/settings.js';
import { LoginAttempts } from '../models/login_attempts.js';
import { Audit } from '../models/audit.js';
import { Sessions } from '../models/sessions.js';
import { hashPassword, validatePassword } from '../lib/password.js';
import { render$ } from '../lib/html.js';
import {
  adminDashboardPage, usersListPage, userNewPage, userEditPage,
  groupsListPage, clientsListPage, clientNewPage, clientSecretPage,
  clientBrandingPage, clientAccessPage, brandingPage, auditPage, settingsPage,
} from '../views/admin.js';
import { Access } from '../models/access.js';
import { parseImageUpload, uploadErrorMessage } from '../lib/upload.js';

const LOGO_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const;
const BG_MIMES   = ['image/png', 'image/jpeg', 'image/webp'] as const;
import { csrfValid } from '../lib/csrf.js';
import { getClientIp } from '../middleware/security.js';
import { requireAuth, requireAdmin } from '../middleware/session.js';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', requireAuth, requireAdmin);

// ── helper : body parse + CSRF check ──
async function parseBodyCsrf(c: any): Promise<Record<string, any> | null> {
  const body = await c.req.parseBody({ all: true });
  const session = c.get('session') as any;
  if (!session) return null;
  const csrf = typeof body.csrf === 'string' ? body.csrf : '';
  if (!csrfValid(session.id, csrf)) return null;
  return body;
}

function html(c: any, body: { value: string }, status = 200): Response {
  c.header('Content-Type', 'text/html; charset=utf-8');
  c.status(status);
  return c.body(body.value);
}

function navUser(c: any): { username: string; role: 'admin' | 'member' } {
  const u = c.get('user');
  return { username: u.username, role: u.role };
}

// ── Dashboard ─────────────────────────────────────────────────────
adminRoutes.get('/', (c) => {
  return html(c, adminDashboardPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    stats: {
      users: Users.listAll().length,
      groups: Groups.listAll().length,
      clients: Clients.listAll().length,
    },
  }));
});

// ── Users ─────────────────────────────────────────────────────────
adminRoutes.get('/users', (c) => {
  const s = Settings.get();
  const users = Users.listAll().map((u) => ({
    ...u,
    groups: Groups.groupNamesOf(u.id),
    locked: s.lockout_max_attempts > 0 &&
            LoginAttempts.recentFailCount(u.username) >= s.lockout_max_attempts,
  }));
  return html(c, usersListPage({ user: navUser(c), csrfToken: c.get('csrfToken') as string, users }));
});

adminRoutes.get('/users/new', (c) => {
  return html(c, userNewPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    groups: Groups.listAll(),
  }));
});

const UserNewInput = z.object({
  username: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'Format identifiant invalide.'),
  email: z.string().email().or(z.literal('')).optional().default(''),
  first_name: z.string().max(100).optional().default(''),
  last_name: z.string().max(100).optional().default(''),
  role: z.enum(['admin', 'member']),
  password: z.string().min(12),
  must_change_password: z.string().optional(),
  groups: z.union([z.string(), z.array(z.string())]).optional(),
});

adminRoutes.post('/users', async (c) => {
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const parsed = UserNewInput.safeParse(body);
  if (!parsed.success) {
    return html(c, userNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups: Groups.listAll(),
      error: parsed.error.errors[0]?.message ?? 'Formulaire invalide.',
      formData: body as any,
    }), 400);
  }
  const input = parsed.data;

  if (Users.findByUsername(input.username)) {
    return html(c, userNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups: Groups.listAll(),
      error: `L'identifiant "${input.username}" existe déjà.`,
      formData: input as any,
    }), 400);
  }
  if (input.email && Users.findByEmail(input.email)) {
    return html(c, userNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups: Groups.listAll(),
      error: `L'email "${input.email}" est déjà utilisé.`,
      formData: input as any,
    }), 400);
  }

  const policy = validatePassword(input.password, [input.username, input.email, input.first_name, input.last_name].filter(Boolean) as string[]);
  if (policy) {
    const msg = policy.code === 'too_short'
      ? `Mot de passe trop court (${policy.min} min).`
      : 'Mot de passe trop faible. ' + (policy.suggestions[0] ?? '');
    return html(c, userNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups: Groups.listAll(),
      error: msg,
      formData: input as any,
    }), 400);
  }

  const hash = await hashPassword(input.password);
  const created = Users.create({
    username: input.username,
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    password_hash: hash,
    role: input.role,
    must_change_password: input.must_change_password === '1',
  });
  const groupIds = Array.isArray(input.groups) ? input.groups : (input.groups ? [input.groups] : []);
  if (groupIds.length) Groups.setUserGroups(created.id, groupIds);

  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.user.create',
    target: created.id,
    metadata: { username: created.username, role: created.role },
    ip: getClientIp(c),
  });

  return c.redirect(`/admin/users/${created.id}`);
});

adminRoutes.get('/users/:id', (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const flashKey = c.req.query('flash');
  const flash = flashKey === 'password_reset' ? 'Mot de passe réinitialisé.'
              : flashKey === 'unlocked' ? 'Compte déverrouillé.'
              : null;
  const s = Settings.get();
  const locked = s.lockout_max_attempts > 0 &&
                 LoginAttempts.recentFailCount(target.username) >= s.lockout_max_attempts;
  return html(c, userEditPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    target,
    allGroups: Groups.listAll(),
    memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
    locked,
    flash,
  }));
});

const UserUpdateInput = z.object({
  username: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'Format identifiant invalide.'),
  email: z.string().email().or(z.literal('')).optional().default(''),
  first_name: z.string().max(100).optional().default(''),
  last_name: z.string().max(100).optional().default(''),
  role: z.enum(['admin', 'member']),
  enabled: z.string().optional(),
});

adminRoutes.post('/users/:id', async (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const parsed = UserUpdateInput.safeParse(body);
  if (!parsed.success) {
    return html(c, userEditPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      target,
      allGroups: Groups.listAll(),
      memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
      error: parsed.error.errors[0]?.message ?? 'Formulaire invalide.',
    }), 400);
  }
  const input = parsed.data;
  const enabledBefore = !!target.enabled;
  const enabledNow = input.enabled === '1';

  // Empêcher de dégrader son propre compte admin / se désactiver soi-même
  const self = c.get('user') as any;
  if (self.id === target.id && (input.role !== 'admin' || !enabledNow)) {
    return html(c, userEditPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      target,
      allGroups: Groups.listAll(),
      memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
      error: "Tu ne peux pas rétrograder ou désactiver ton propre compte admin.",
    }), 400);
  }

  if (input.username !== target.username) {
    const clash = Users.findByUsername(input.username);
    if (clash && clash.id !== target.id) {
      return html(c, userEditPage({
        user: navUser(c),
        csrfToken: c.get('csrfToken') as string,
        target,
        allGroups: Groups.listAll(),
        memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
        error: `L'identifiant "${input.username}" est déjà pris.`,
      }), 400);
    }
  }
  if (input.email && input.email !== target.email) {
    const clash = Users.findByEmail(input.email);
    if (clash && clash.id !== target.id) {
      return html(c, userEditPage({
        user: navUser(c),
        csrfToken: c.get('csrfToken') as string,
        target,
        allGroups: Groups.listAll(),
        memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
        error: `L'email "${input.email}" est déjà utilisé.`,
      }), 400);
    }
  }

  Users.update(target.id, {
    username: input.username,
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    role: input.role,
    enabled: enabledNow,
  });

  if (enabledBefore !== enabledNow) {
    Audit.log({
      actorUserId: self.id,
      action: enabledNow ? 'admin.user.enable' : 'admin.user.disable',
      target: target.id,
      ip: getClientIp(c),
    });
    if (!enabledNow) Sessions.destroyAllForUser(target.id);
  }
  Audit.log({
    actorUserId: self.id,
    action: 'admin.user.update',
    target: target.id,
    metadata: { role: input.role },
    ip: getClientIp(c),
  });
  return c.redirect(`/admin/users/${target.id}`);
});

adminRoutes.post('/users/:id/password', async (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const pw = typeof body.password === 'string' ? body.password : '';
  const mustChange = body.must_change_password === '1';
  const policy = validatePassword(pw, [target.username, target.email, target.first_name, target.last_name].filter(Boolean) as string[]);
  if (policy) {
    const msg = policy.code === 'too_short'
      ? `Mot de passe trop court (${policy.min} min).`
      : 'Mot de passe trop faible.';
    return html(c, userEditPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      target,
      allGroups: Groups.listAll(),
      memberGroupIds: new Set(Groups.groupsOf(target.id).map((g) => g.id)),
      error: msg,
    }), 400);
  }
  const hash = await hashPassword(pw);
  Users.setPassword(target.id, hash, mustChange);
  Sessions.destroyAllForUser(target.id);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.user.password_reset',
    target: target.id,
    metadata: { must_change: mustChange },
    ip: getClientIp(c),
  });
  return c.redirect(`/admin/users/${target.id}?flash=password_reset`);
});

adminRoutes.post('/users/:id/groups', async (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);
  const groupIds = Array.isArray(body.groups) ? body.groups : (body.groups ? [body.groups] : []);
  Groups.setUserGroups(target.id, groupIds as string[]);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.group.member_add',
    target: target.id,
    metadata: { groups: groupIds },
    ip: getClientIp(c),
  });
  return c.redirect(`/admin/users/${target.id}`);
});

adminRoutes.post('/users/:id/unlock', async (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);
  LoginAttempts.reset(target.username);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.user.unlock',
    target: target.id,
    metadata: { username: target.username },
    ip: getClientIp(c),
  });
  return c.redirect(`/admin/users/${target.id}?flash=unlocked`);
});

adminRoutes.post('/users/:id/delete', async (c) => {
  const target = Users.findById(c.req.param('id'));
  if (!target) return c.notFound();
  const self = c.get('user') as any;
  if (self.id === target.id) return c.text('Impossible de se supprimer soi-même.', 400);
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  Users.delete(target.id);
  Audit.log({
    actorUserId: self.id,
    action: 'admin.user.delete',
    target: target.id,
    metadata: { username: target.username },
    ip: getClientIp(c),
  });
  return c.redirect('/admin/users');
});

// ── Groups ────────────────────────────────────────────────────────
adminRoutes.get('/groups', (c) => {
  const groups = Groups.listAll().map((g) => ({ ...g, members: Groups.membersOf(g.id).length }));
  return html(c, groupsListPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    groups,
  }));
});

const GroupNewInput = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'Nom de groupe invalide.'),
  description: z.string().max(500).optional().default(''),
});

adminRoutes.post('/groups', async (c) => {
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);
  const parsed = GroupNewInput.safeParse(body);
  if (!parsed.success) {
    const groups = Groups.listAll().map((g) => ({ ...g, members: Groups.membersOf(g.id).length }));
    return html(c, groupsListPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups,
      error: parsed.error.errors[0]?.message ?? 'Invalide.',
    }), 400);
  }
  if (Groups.findByName(parsed.data.name)) {
    const groups = Groups.listAll().map((g) => ({ ...g, members: Groups.membersOf(g.id).length }));
    return html(c, groupsListPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      groups,
      error: `Le groupe "${parsed.data.name}" existe déjà.`,
    }), 400);
  }
  const g = Groups.create(parsed.data);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.group.create',
    target: g.id,
    metadata: { name: g.name },
    ip: getClientIp(c),
  });
  return c.redirect('/admin/groups?flash=created');
});

adminRoutes.post('/groups/:id/delete', async (c) => {
  const g = Groups.findById(c.req.param('id'));
  if (!g) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);
  Groups.delete(g.id);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.group.delete',
    target: g.id,
    metadata: { name: g.name },
    ip: getClientIp(c),
  });
  return c.redirect('/admin/groups');
});

// ── Clients OIDC ──────────────────────────────────────────────────
adminRoutes.get('/clients', (c) => {
  return html(c, clientsListPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    clients: Clients.listAll(),
  }));
});

adminRoutes.get('/clients/new', (c) => {
  return html(c, clientNewPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
  }));
});

const ClientNewInput = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'Client ID invalide.'),
  name: z.string().min(1).max(200),
  redirect_uris: z.string().min(1),
  post_logout_uris: z.string().optional().default(''),
});

adminRoutes.post('/clients', async (c) => {
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const parsed = ClientNewInput.safeParse(body);
  if (!parsed.success) {
    return html(c, clientNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      error: parsed.error.errors[0]?.message ?? 'Invalide.',
      formData: body as any,
    }), 400);
  }

  if (Clients.findById(parsed.data.id)) {
    return html(c, clientNewPage({
      user: navUser(c),
      csrfToken: c.get('csrfToken') as string,
      error: `Le client ID "${parsed.data.id}" existe déjà.`,
      formData: body as any,
    }), 400);
  }

  const redirectUris = parsed.data.redirect_uris.split('\n').map((s) => s.trim()).filter(Boolean);
  const logoutUris = parsed.data.post_logout_uris.split('\n').map((s) => s.trim()).filter(Boolean);

  // Validation URLs
  for (const u of [...redirectUris, ...logoutUris]) {
    try { new URL(u); } catch {
      return html(c, clientNewPage({
        user: navUser(c),
        csrfToken: c.get('csrfToken') as string,
        error: `URL invalide : ${u}`,
        formData: body as any,
      }), 400);
    }
  }

  const { client, secret } = await Clients.create({
    id: parsed.data.id,
    name: parsed.data.name,
    redirect_uris: redirectUris,
    post_logout_uris: logoutUris,
  });
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.client.create',
    target: client.id,
    metadata: { name: client.name },
    ip: getClientIp(c),
  });

  // Page dédiée avec bouton "Retour aux applications"
  return html(c, clientSecretPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    id: client.id,
    secret,
  }));
});

adminRoutes.get('/clients/:id/access', (c) => {
  const client = Clients.findById(c.req.param('id'));
  if (!client) return c.notFound();
  const flash = c.req.query('flash') === 'saved' ? 'Accès enregistrés.' : null;
  const principals = Access.list(client.id);
  return html(c, clientAccessPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    client: { id: client.id, name: client.name, redirect_uris: JSON.parse(client.redirect_uris), post_logout_uris: JSON.parse(client.post_logout_uris), allowed_scopes: JSON.parse(client.allowed_scopes), home_url: client.home_url ?? null, created_at: client.created_at },
    allUsers: Users.listAll(),
    allGroups: Groups.listAll(),
    selectedUsers: new Set(principals.filter((p) => p.type === 'user').map((p) => p.id)),
    selectedGroups: new Set(principals.filter((p) => p.type === 'group').map((p) => p.id)),
    flash,
  }));
});

adminRoutes.post('/clients/:id/access', async (c) => {
  const client = Clients.findById(c.req.param('id'));
  if (!client) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const homeUrl = typeof body.home_url === 'string' && body.home_url.trim() ? body.home_url.trim().slice(0, 500) : null;
  if (homeUrl) {
    try { new URL(homeUrl); } catch { return c.text('URL invalide', 400); }
  }
  Clients.setHomeUrl(client.id, homeUrl);

  const rawUserIds = Array.isArray(body.users) ? body.users : (body.users ? [body.users] : []);
  const rawGroupIds = Array.isArray(body.groups) ? body.groups : (body.groups ? [body.groups] : []);

  // Valider que chaque principal_id existe avant insertion (anti-orphelin)
  const principals: Array<{ type: 'user' | 'group'; id: string }> = [];
  const skipped: { users: string[]; groups: string[] } = { users: [], groups: [] };
  for (const id of rawUserIds.map((x: any) => String(x))) {
    if (Users.findById(id)) principals.push({ type: 'user', id });
    else skipped.users.push(id);
  }
  for (const id of rawGroupIds.map((x: any) => String(x))) {
    if (Groups.findById(id)) principals.push({ type: 'group', id });
    else skipped.groups.push(id);
  }

  Access.set(client.id, principals);

  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.client.access_update',
    target: client.id,
    metadata: {
      acl_count: principals.length,
      home_url: homeUrl,
      ...(skipped.users.length || skipped.groups.length ? { skipped } : {}),
    },
    ip: getClientIp(c),
  });
  return c.redirect(`/admin/clients/${client.id}/access?flash=saved`);
});

// Per-client branding (apparence par application)
adminRoutes.get('/clients/:id/branding', (c) => {
  const client = Clients.findById(c.req.param('id'));
  if (!client) return c.notFound();
  const flashRaw = c.req.query('flash') ?? '';
  const flash = flashRaw === 'saved' ? 'Apparence enregistrée.' : null;
  const error = flashRaw.startsWith('error:') ? decodeURIComponent(flashRaw.slice('error:'.length)) : null;
  return html(c, clientBrandingPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    client: { id: client.id, name: client.name, redirect_uris: [], post_logout_uris: [], allowed_scopes: [], home_url: client.home_url ?? null, created_at: client.created_at },
    branding: Brand.getClient(client.id),
    flash,
    error,
  }));
});

adminRoutes.post('/clients/:id/branding', async (c) => {
  const client = Clients.findById(c.req.param('id'));
  if (!client) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const str = (v: any, max: number) => typeof v === 'string' && v.trim() ? v.slice(0, max) : null;
  const color = (v: any) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null;

  const patch: any = {
    app_name:           str(body.app_name, 100),
    tagline:            str(body.tagline, 200),
    primary_color:      color(body.primary_color),
    accent_color:       color(body.accent_color),
    login_button_label: str(body.login_button_label, 60),
    footer_text:        str(body.footer_text, 300),
  };
  if (typeof body.background_opacity === 'string' && body.background_opacity !== '') {
    const n = Math.max(0, Math.min(100, parseInt(body.background_opacity, 10) || 0));
    patch.background_opacity = n;
  } else {
    patch.background_opacity = null;
  }

  const uploadErrors: string[] = [];
  if (body.remove_logo === '1') {
    patch.logo_data_url = null;
  } else {
    const r = await parseImageUpload(body.logo, { allowedMimes: LOGO_MIMES });
    if (r.status === 'ok') patch.logo_data_url = r.dataUrl;
    else { const e = uploadErrorMessage(r, 'Logo'); if (e) uploadErrors.push(e); }
  }
  if (body.remove_background === '1') {
    patch.background_data_url = null;
  } else {
    const r = await parseImageUpload(body.background, { allowedMimes: BG_MIMES });
    if (r.status === 'ok') patch.background_data_url = r.dataUrl;
    else { const e = uploadErrorMessage(r, 'Image de fond'); if (e) uploadErrors.push(e); }
  }

  Brand.updateClient(client.id, patch);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.branding.update',
    target: client.id,
    ip: getClientIp(c),
  });
  const flashKey = uploadErrors.length ? `error:${encodeURIComponent(uploadErrors.join(' / '))}` : 'saved';
  return c.redirect(`/admin/clients/${client.id}/branding?flash=${flashKey}`);
});

adminRoutes.post('/clients/:id/delete', async (c) => {
  const id = c.req.param('id');
  const client = Clients.findById(id);
  if (!client) return c.notFound();
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);
  Clients.delete(id);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.client.delete',
    target: id,
    ip: getClientIp(c),
  });
  return c.redirect('/admin/clients');
});

// ── Branding ──────────────────────────────────────────────────────
adminRoutes.get('/branding', (c) => {
  const flashRaw = c.req.query('flash') ?? '';
  const flash = flashRaw === 'saved' ? 'Apparence enregistrée.' : null;
  const error = flashRaw.startsWith('error:') ? decodeURIComponent(flashRaw.slice('error:'.length)) : null;
  return html(c, brandingPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    branding: Brand.get(),
    flash,
    error,
  }));
});

adminRoutes.post('/branding', async (c) => {
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const patch: any = {
    app_name: typeof body.app_name === 'string' ? body.app_name.slice(0, 100) : undefined,
    tagline: typeof body.tagline === 'string' ? body.tagline.slice(0, 200) : undefined,
    primary_color: typeof body.primary_color === 'string' && /^#[0-9a-f]{6}$/i.test(body.primary_color) ? body.primary_color : undefined,
    accent_color: typeof body.accent_color === 'string' && /^#[0-9a-f]{6}$/i.test(body.accent_color) ? body.accent_color : undefined,
    footer_text: typeof body.footer_text === 'string' ? body.footer_text.slice(0, 300) : undefined,
    login_button_label: typeof body.login_button_label === 'string' && body.login_button_label.trim()
      ? body.login_button_label.slice(0, 60) : undefined,
  };

  if (typeof body.default_theme === 'string' && ['dark','light','system'].includes(body.default_theme)) {
    patch.default_theme = body.default_theme;
  }
  if (typeof body.radius === 'string' && ['none','sm','md','lg'].includes(body.radius)) {
    patch.radius = body.radius;
  }
  if (typeof body.background_opacity === 'string') {
    const n = Math.max(0, Math.min(100, parseInt(body.background_opacity, 10) || 0));
    patch.background_opacity = n;
  }

  const uploadErrors: string[] = [];
  if (body.remove_logo === '1') {
    patch.logo_data_url = null;
  } else {
    const r = await parseImageUpload(body.logo, { allowedMimes: LOGO_MIMES });
    if (r.status === 'ok') patch.logo_data_url = r.dataUrl;
    else { const e = uploadErrorMessage(r, 'Logo'); if (e) uploadErrors.push(e); }
  }
  if (body.remove_background === '1') {
    patch.background_data_url = null;
  } else {
    const r = await parseImageUpload(body.background, { allowedMimes: BG_MIMES });
    if (r.status === 'ok') patch.background_data_url = r.dataUrl;
    else { const e = uploadErrorMessage(r, 'Image de fond'); if (e) uploadErrors.push(e); }
  }

  Brand.update(patch);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.branding.update',
    ip: getClientIp(c),
  });
  const flashKey = uploadErrors.length ? `error:${encodeURIComponent(uploadErrors.join(' / '))}` : 'saved';
  return c.redirect(`/admin/branding?flash=${flashKey}`);
});

// ── Settings ──────────────────────────────────────────────────────
adminRoutes.get('/settings', (c) => {
  const flash = c.req.query('flash') === 'saved' ? 'Paramètres enregistrés.' : null;
  return html(c, settingsPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    settings: Settings.get(),
    flash,
  }));
});

adminRoutes.post('/settings', async (c) => {
  const body = await parseBodyCsrf(c);
  if (!body) return c.text('CSRF invalid', 403);

  const intIn = (v: any, min: number, max: number, def: number) => {
    const n = parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  };
  const current = Settings.get();
  const patch: any = {
    lockout_max_attempts:   intIn(body.lockout_max_attempts,   0, 100,   current.lockout_max_attempts),
    lockout_window_minutes: intIn(body.lockout_window_minutes, 1, 1440,  current.lockout_window_minutes),
    password_min_length:    intIn(body.password_min_length,    8, 128,   current.password_min_length),
    password_min_score:     intIn(body.password_min_score,     0, 4,     current.password_min_score),
    session_ttl_minutes:    intIn(body.session_ttl_minutes,    5, 525600, current.session_ttl_minutes),
    session_idle_minutes:   intIn(body.session_idle_minutes,   5, 525600, current.session_idle_minutes),
  };
  if (typeof body.login_mode === 'string' && ['username','email','both'].includes(body.login_mode)) {
    patch.login_mode = body.login_mode;
  }
  if (typeof body.default_role === 'string' && ['admin','member'].includes(body.default_role)) {
    patch.default_role = body.default_role;
  }
  Settings.update(patch);
  Audit.log({
    actorUserId: (c.get('user') as any).id,
    action: 'admin.settings.update',
    ip: getClientIp(c),
  });
  return c.redirect('/admin/settings?flash=saved');
});

// ── Audit ─────────────────────────────────────────────────────────
adminRoutes.get('/audit', (c) => {
  return html(c, auditPage({
    user: navUser(c),
    csrfToken: c.get('csrfToken') as string,
    entries: Audit.list(200),
  }));
});
