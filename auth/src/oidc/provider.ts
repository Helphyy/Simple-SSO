import OidcProvider, { type Configuration } from 'oidc-provider';
import { config } from '../config.js';
import { SqliteAdapter, userClaims } from './adapter.js';
import { loadOrGenerateJwks } from './keys.js';

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
      postLogoutSuccessSource: async (ctx: any) => {
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
