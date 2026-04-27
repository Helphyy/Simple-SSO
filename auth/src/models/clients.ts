import { db } from '../db/index.js';
import { newToken } from '../lib/ids.js';

/**
 * NB : le client_secret est stocké en clair. Contrairement aux mdp utilisateur,
 * le serveur OIDC a BESOIN du secret en clair pour comparer à la requête
 * entrante (symétrique). Le "affiché une seule fois" côté UI est une
 * convention UX (pour que l'admin le copie sans revenir tout le temps dans
 * l'admin), pas une protection crypto — l'accès fichier DB = accès total de
 * toute façon (mdp hashes, clés de signature RSA, etc.).
 */
export interface OidcClient {
  id: string;
  name: string;
  client_secret: string;
  redirect_uris: string;       // JSON
  post_logout_uris: string;    // JSON
  allowed_scopes: string;      // JSON
  home_url: string | null;
  created_at: number;
}

export interface OidcClientPublic {
  id: string;
  name: string;
  redirect_uris: string[];
  post_logout_uris: string[];
  allowed_scopes: string[];
  home_url: string | null;
  created_at: number;
}

function toPublic(c: OidcClient): OidcClientPublic {
  return {
    id: c.id,
    name: c.name,
    redirect_uris: JSON.parse(c.redirect_uris),
    post_logout_uris: JSON.parse(c.post_logout_uris),
    allowed_scopes: JSON.parse(c.allowed_scopes),
    home_url: c.home_url ?? null,
    created_at: c.created_at,
  };
}

function deriveOriginFromRedirect(redirectUris: string[]): string | null {
  for (const u of redirectUris) {
    try { return new URL(u).origin; } catch { /* ignore */ }
  }
  return null;
}

export const Clients = {
  findById(id: string): OidcClient | undefined {
    return db.prepare('SELECT * FROM oidc_clients WHERE id = ?').get(id) as OidcClient | undefined;
  },

  listAll(): OidcClientPublic[] {
    return (db.prepare('SELECT * FROM oidc_clients ORDER BY created_at DESC').all() as OidcClient[])
      .map(toPublic);
  },

  async create(input: {
    id: string;
    name: string;
    redirect_uris: string[];
    post_logout_uris?: string[];
    allowed_scopes?: string[];
    home_url?: string | null;
  }): Promise<{ client: OidcClientPublic; secret: string }> {
    const secret = newToken(32);
    const scopes = input.allowed_scopes ?? ['openid', 'profile', 'email', 'groups'];
    const logoutUris = input.post_logout_uris ?? [];
    const homeUrl = input.home_url ?? deriveOriginFromRedirect(input.redirect_uris);
    db.prepare(`
      INSERT INTO oidc_clients (id, name, client_secret, redirect_uris, post_logout_uris, allowed_scopes, home_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      secret,
      JSON.stringify(input.redirect_uris),
      JSON.stringify(logoutUris),
      JSON.stringify(scopes),
      homeUrl,
      Date.now()
    );
    return { client: toPublic(Clients.findById(input.id)!), secret };
  },

  setHomeUrl(id: string, url: string | null): void {
    db.prepare('UPDATE oidc_clients SET home_url = ? WHERE id = ?').run(url, id);
  },

  update(id: string, patch: {
    name?: string;
    redirect_uris?: string[];
    post_logout_uris?: string[];
  }): void {
    const cur = Clients.findById(id);
    if (!cur) return;
    db.prepare(`
      UPDATE oidc_clients
      SET name = ?, redirect_uris = ?, post_logout_uris = ?
      WHERE id = ?
    `).run(
      patch.name ?? cur.name,
      patch.redirect_uris !== undefined ? JSON.stringify(patch.redirect_uris) : cur.redirect_uris,
      patch.post_logout_uris !== undefined ? JSON.stringify(patch.post_logout_uris) : cur.post_logout_uris,
      id
    );
  },

  rotateSecret(id: string): string | null {
    const cur = Clients.findById(id);
    if (!cur) return null;
    const secret = newToken(32);
    db.prepare('UPDATE oidc_clients SET client_secret = ? WHERE id = ?').run(secret, id);
    return secret;
  },

  delete(id: string): void {
    db.prepare('DELETE FROM oidc_clients WHERE id = ?').run(id);
  },
};
