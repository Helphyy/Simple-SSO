import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * Signe une valeur avec HMAC-SHA256. Format : `<value>.<hmacHex>`.
 * Le secret côté serveur fait que la valeur ne peut pas être forgée.
 */
export function sign(value: string): string {
  const mac = createHmac('sha256', config.SESSION_SECRET).update(value).digest('hex');
  return `${value}.${mac}`;
}

/**
 * Vérifie une valeur signée. Retourne la valeur brute si ok, null sinon.
 * Comparaison constant-time pour éviter toute fuite par timing.
 */
export function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const providedMac = signed.slice(idx + 1);
  const expectedMac = createHmac('sha256', config.SESSION_SECRET).update(value).digest('hex');
  try {
    const a = Buffer.from(providedMac, 'hex');
    const b = Buffer.from(expectedMac, 'hex');
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? value : null;
  } catch {
    return null;
  }
}
