import { db } from '../db/index.js';
import { Clients } from '../models/clients.js';
import { Users } from '../models/users.js';
import { Groups } from '../models/groups.js';
import type { Adapter, AdapterPayload } from 'oidc-provider';

function typeId(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const upsertStmt = db.prepare(`
  INSERT OR REPLACE INTO oidc_payloads (id, type, payload, grant_id, user_code, uid, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Adapter oidc-provider → SQLite. Deux cas spéciaux :
 *  - 'Client'  : lu depuis notre table `oidc_clients` (on retourne la config
 *                mise en forme pour oidc-provider).
 *  - autre     : persisté en JSON dans `oidc_payloads`.
 */
export class SqliteAdapter implements Adapter {
  private type: number;
  private typeName: string;

  constructor(name: string) {
    this.typeName = name;
    this.type = typeId(name);
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    if (this.typeName === 'Client') return; // on gère au find()
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
    upsertStmt.run(
      id,
      this.type,
      JSON.stringify(payload),
      (payload as any).grantId ?? null,
      (payload as any).userCode ?? null,
      (payload as any).uid ?? null,
      expiresAt
    );
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    if (this.typeName === 'Client') {
      const c = Clients.findById(id);
      if (!c) return undefined;
      return {
        client_id: c.id,
        client_name: c.name,
        client_secret: c.client_secret,
        redirect_uris: JSON.parse(c.redirect_uris),
        post_logout_redirect_uris: JSON.parse(c.post_logout_uris),
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        scope: (JSON.parse(c.allowed_scopes) as string[]).join(' '),
      } as any;
    }
    const row = db.prepare(
      `SELECT payload, expires_at FROM oidc_payloads WHERE id = ? AND type = ?`
    ).get(id, this.type) as any;
    if (!row) return undefined;
    if (row.expires_at && row.expires_at < Date.now()) {
      db.prepare(`DELETE FROM oidc_payloads WHERE id = ? AND type = ?`).run(id, this.type);
      return undefined;
    }
    return JSON.parse(row.payload) as AdapterPayload;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const row = db.prepare(
      `SELECT payload FROM oidc_payloads WHERE user_code = ? AND type = ?`
    ).get(userCode, this.type) as any;
    return row ? JSON.parse(row.payload) : undefined;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = db.prepare(
      `SELECT payload FROM oidc_payloads WHERE uid = ? AND type = ?`
    ).get(uid, this.type) as any;
    return row ? JSON.parse(row.payload) : undefined;
  }

  async consume(id: string): Promise<void> {
    const row = db.prepare(
      `SELECT payload FROM oidc_payloads WHERE id = ? AND type = ?`
    ).get(id, this.type) as any;
    if (!row) return;
    const payload = JSON.parse(row.payload);
    payload.consumed = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE oidc_payloads SET payload = ? WHERE id = ? AND type = ?`)
      .run(JSON.stringify(payload), id, this.type);
  }

  async destroy(id: string): Promise<void> {
    db.prepare(`DELETE FROM oidc_payloads WHERE id = ? AND type = ?`).run(id, this.type);
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    db.prepare(`DELETE FROM oidc_payloads WHERE grant_id = ?`).run(grantId);
  }
}

export function userClaims(userId: string, scopes: string[]) {
  const u = Users.findById(userId);
  if (!u) return {};
  const result: Record<string, unknown> = { sub: u.id };
  if (scopes.includes('profile')) {
    result.preferred_username = u.username;
    result.given_name = u.first_name;
    result.family_name = u.last_name;
    result.name = `${u.first_name} ${u.last_name}`.trim() || u.username;
  }
  if (scopes.includes('email') && u.email) {
    result.email = u.email;
    result.email_verified = true;
  }
  if (scopes.includes('groups')) {
    result.groups = Groups.groupNamesOf(u.id);
  }
  return result;
}
