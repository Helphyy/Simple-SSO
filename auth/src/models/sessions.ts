import { db } from '../db/index.js';
import { newToken } from '../lib/ids.js';
import { Settings } from './settings.js';

const ttlMs = () => Settings.get().session_ttl_minutes * 60 * 1000;
const idleMs = () => Settings.get().session_idle_minutes * 60 * 1000;

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  last_activity_at: number;
  ip: string | null;
  user_agent: string | null;
  pending_pw_change: number;
}

export const Sessions = {
  create(userId: string, opts: {
    ip?: string | null;
    userAgent?: string | null;
    pendingPwChange?: boolean;
  } = {}): Session {
    const id = newToken();
    const now = Date.now();
    db.prepare(`
      INSERT INTO sessions (id, user_id, created_at, expires_at, last_activity_at, ip, user_agent, pending_pw_change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, now, now + ttlMs(), now,
      opts.ip ?? null, opts.userAgent ?? null,
      opts.pendingPwChange ? 1 : 0
    );
    return Sessions.get(id)!;
  },

  get(id: string): Session | undefined {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  },

  /**
   * Charge une session active. Invalide si :
   *  - inexistante
   *  - expirée (absolu ou inactivité)
   * Rafraîchit `last_activity_at` si valide.
   */
  touch(id: string): Session | null {
    const s = Sessions.get(id);
    if (!s) return null;
    const now = Date.now();
    if (now > s.expires_at || (now - s.last_activity_at) > idleMs()) {
      Sessions.destroy(id);
      return null;
    }
    db.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?').run(now, id);
    return { ...s, last_activity_at: now };
  },

  clearPwChange(id: string): void {
    db.prepare('UPDATE sessions SET pending_pw_change = 0 WHERE id = ?').run(id);
  },

  destroy(id: string): void {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  },

  destroyAllForUser(userId: string): void {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },

  gc(): void {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  },
};
