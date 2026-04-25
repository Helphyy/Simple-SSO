import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { db } from '../db/index.js';

export interface Jwk {
  kty: string;
  use?: string;
  alg?: string;
  kid: string;
  n?: string;
  e?: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

/**
 * Charge les JWKs depuis la DB. Si absents, en génère (RSA 2048) et les persiste.
 * Les clés restent stables entre restarts tant qu'on ne supprime pas la ligne.
 */
export function loadOrGenerateJwks(): { keys: Jwk[] } {
  const row = db.prepare(`SELECT keys_json FROM jwks WHERE id = 1`).get() as any;
  if (row) {
    return JSON.parse(row.keys_json);
  }

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = privateKey.export({ format: 'jwk' }) as unknown as Jwk;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = `k-${Date.now()}`;

  const keys = { keys: [jwk] };
  db.prepare(`INSERT INTO jwks (id, keys_json, created_at) VALUES (1, ?, ?)`)
    .run(JSON.stringify(keys), Date.now());

  console.log('[oidc] JWKs RSA 2048 générés et persistés');
  return keys;
}
