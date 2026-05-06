import OidcProvider, { type Configuration } from 'oidc-provider';
import { config } from '../config.js';
import { SqliteAdapter, userClaims } from './adapter.js';
import { loadOrGenerateJwks } from './keys.js';
import { Sessions } from '../models/sessions.js';
import { unsign } from '../lib/signed_cookie.js';
import { SESSION_COOKIE } from '../middleware/session.js';
import { Clients } from '../models/clients.js';

const jwks = loadOrGenerateJwks();

const configuration: Configuration = {
  adapter: SqliteAdapter as any,
  jwks,
  clients: [],
  scopes: ['openid', 'profile', 'email', 'groups', 'offline_access'],
  claims: {
    openid: ['sub'],
    profile: ['preferred_username', 'given_name', 'family_name', 'name'],
    email: ['email', 'email_verified'],
    groups: ['groups'],
  },
  pkce: {
    // PKCE obligatoire pour les clients publics (sans secret).
    // Clients confidentiels (ex: Outline avec client_secret) : PKCE optionnel
    // mais supporté. Outline n'envoie pas PKCE par défaut, donc required=false
    // pour ne pas bloquer. Le secret client fait office de protection.
    required: (_ctx, client) => !client.clientSecret,
    methods: ['S256'],
  },
  responseTypes: ['code'],
  features: {
    devInteractions: { enabled: false },
    resourceIndicators: { enabled: false },
    revocation: { enabled: true },
    introspection: { enabled: true },
    clientCredentials: { enabled: false },
    rpInitiatedLogout: {
      logoutSource: async (ctx: any, form: string) => {
        ctx.type = 'html';
        ctx.body = `<!doctype html><html><body onload="document.forms[0].submit()">${form}</body></html>`;
      },
      // Called when the RP triggered logout without a (valid)
      // post_logout_redirect_uri reaching the redirect step.
      // We previously fell back to '/' which sent the user to the SSO
      // login page, even though they expected to land on the client app
      // they just logged out of. Try every source we can to identify the
      // originating client, then redirect to its home_url (or first
      // registered post_logout_uri). Belt-and-suspenders: also
      // forcefully kill the Hono session here in case the
      // end_session.* event hook didn't fire (e.g., on early errors).
      postLogoutSuccessSource: async (ctx: any) => {
        killHonoSession(ctx);
        try {
          // 1. ctx.oidc.client (set when id_token_hint or client_id matched)
          let clientId: string | undefined = ctx.oidc?.client?.clientId;

          // 2. Explicit client_id query param (Outline sends it)
          if (!clientId) {
            const q = ctx.oidc?.params?.client_id ?? ctx.query?.client_id;
            if (typeof q === 'string' && q) clientId = q;
          }

          // 3. Match post_logout_redirect_uri against any registered client
          if (!clientId) {
            const plru: string | undefined =
              ctx.oidc?.params?.post_logout_redirect_uri ?? ctx.query?.post_logout_redirect_uri;
            if (plru) {
              for (const c of Clients.listAll()) {
                if (c.post_logout_uris.includes(plru)) { ctx.redirect(plru); return; }
              }
            }
          }

          if (clientId) {
            const c = Clients.findById(clientId);
            if (c) {
              if (c.home_url) { ctx.redirect(c.home_url); return; }
              const plu: string[] = JSON.parse(c.post_logout_uris || '[]');
              if (plu[0]) { ctx.redirect(plu[0]); return; }
            }
          }

          // 4. Single-client deployment: just send them to that client's home.
          const all = Clients.listAll();
          if (all.length === 1) {
            const only = all[0]!;
            if (only.home_url) { ctx.redirect(only.home_url); return; }
            if (only.post_logout_uris[0]) { ctx.redirect(only.post_logout_uris[0]); return; }
          }
        } catch (e) {
          console.error('[oidc postLogoutSuccessSource]', e);
        }
        ctx.redirect('/');
      },
    },
  },
  ttl: {
    AccessToken: 3600,
    IdToken: 3600,
    RefreshToken: 14 * 86400,
    AuthorizationCode: 60,
    Grant: 14 * 86400,
    Session: 14 * 86400,
    Interaction: 600,
  },
  cookies: {
    keys: [config.SESSION_SECRET],
    long: { secure: config.cookieSecure, sameSite: 'lax' },
    short: { secure: config.cookieSecure, sameSite: 'lax' },
  },
  findAccount: async (_ctx, id) => ({
    accountId: id,
    async claims(_use, scope) {
      const scopes = scope.split(' ');
      return userClaims(id, scopes) as any;
    },
  }),
  interactions: {
    url(_ctx, interaction) {
      return `/interaction/${interaction.uid}`;
    },
  },
  clientBasedCORS: () => true,
  renderError: async (ctx: any, out: any, error: any) => {
    console.error('[oidc error]', error);
    ctx.type = 'html';
    ctx.body = `<!doctype html><html><body><h1>Erreur OIDC</h1><pre>${JSON.stringify(out, null, 2)}</pre></body></html>`;
  },
};

// oidc-provider route à la racine. Les endpoints publiés seront :
//   /auth /token /me /jwks /session/end /.well-known/openid-configuration
// (pas de préfixe /oidc — oidc-provider n'en gère pas nativement).
export const provider = new OidcProvider(config.PUBLIC_URL, configuration);
provider.proxy = true;

// ── Sync our Hono session with OIDC end_session ────────────────────
// When a relying party (e.g. Outline) triggers the RP-initiated logout
// flow, oidc-provider clears its own session but ours stays alive,
// which lets a subsequent /auth flow silently re-authenticate the user.
// On end_session.success, destroy the matching Hono session and clear
// the cookie so the user is fully logged out everywhere.
function killHonoSession(ctx: any) {
  try {
    const cookieHeader: string = ctx.request?.headers?.cookie ?? '';
    const m = cookieHeader.split(';').map((p: string) => p.trim()).find((p: string) => p.startsWith(SESSION_COOKIE + '='));
    if (m) {
      const raw = decodeURIComponent(m.slice(SESSION_COOKIE.length + 1));
      const sid = unsign(raw);
      if (sid) Sessions.destroy(sid);
    }
    const isSecure = config.cookieSecure;
    const expire = `Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    const existing = ctx.response?.get?.('Set-Cookie');
    const additions = [
      `${SESSION_COOKIE}=; ${expire}`,
      `_session=; ${expire}`,
      `_session.legacy=; ${expire}`,
      `_session.sig=; ${expire}`,
      `_session.legacy.sig=; ${expire}`,
    ];
    const merged = existing
      ? (Array.isArray(existing) ? existing.concat(additions) : [existing as string].concat(additions))
      : additions;
    ctx.response?.set?.('Set-Cookie', merged);
  } catch (e) {
    console.error('[oidc end_session sync]', e);
  }
}
provider.on('end_session.success', killHonoSession);
provider.on('end_session.error', killHonoSession);
