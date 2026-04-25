import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * CSRF synchronizer token pattern, lié à la session.
 * Token = HMAC(sessionId, SESSION_SECRET). Stateless, pas besoin de DB.
 * Tant que la session change, le token change.
 */
export function csrfFor(sessionId: string): string {
  return createHmac('sha256', config.SESSION_SECRET)
    .update(`csrf:${sessionId}`)
    .digest('hex');
}

export function csrfValid(sessionId: string, provided: string): boolean {
  if (!provided || typeof provided !== 'string') return false;
  const expected = csrfFor(sessionId);
  try {
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
