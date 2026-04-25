import { db } from '../db/index.js';
import { Settings } from './settings.js';

export const LoginAttempts = {
  record(username: string, ip: string, success: boolean): void {
    db.prepare(`
      INSERT INTO login_attempts (username, ip, success, attempted_at)
      VALUES (?, ?, ?, ?)
    `).run(username.toLowerCase(), ip, success ? 1 : 0, Date.now());
  },

  /**
   * True si (username, ip) dépasse max_attempts échecs sur window_minutes.
   * On compte les échecs depuis le dernier succès.
   * Si max_attempts = 0, le lock est désactivé (jamais bloqué).
   */
  isLocked(username: string, ip: string): boolean {
    const s = Settings.get();
    if (s.lockout_max_attempts <= 0) return false;

    const windowMs = s.lockout_window_minutes * 60 * 1000;
    const since = Date.now() - windowMs;

    const lastSuccess = db.prepare(`
      SELECT attempted_at FROM login_attempts
       WHERE username = ? AND ip = ? AND success = 1
         AND attempted_at >= ?
       ORDER BY attempted_at DESC LIMIT 1
    `).get(username.toLowerCase(), ip, since) as any;

    const effectiveSince = lastSuccess?.attempted_at ?? since;

    const fails = (db.prepare(`
      SELECT COUNT(*) AS c FROM login_attempts
       WHERE username = ? AND ip = ? AND success = 0
         AND attempted_at > ?
    `).get(username.toLowerCase(), ip, effectiveSince) as any).c;

    return fails >= s.lockout_max_attempts;
  },

  /**
   * Nombre d'échecs récents pour un username (toutes IPs) — utilisé pour
   * afficher un badge "bloqué" sur la liste users admin.
   */
  recentFailCount(username: string): number {
    const s = Settings.get();
    if (s.lockout_max_attempts <= 0) return 0;
    const since = Date.now() - s.lockout_window_minutes * 60 * 1000;
    return (db.prepare(`
      SELECT COUNT(*) AS c FROM login_attempts
       WHERE username = ? AND success = 0 AND attempted_at > ?
    `).get(username.toLowerCase(), since) as any).c;
  },

  /**
   * Déverrouille : enregistre un "succès synthétique" qui invalide les
   * échecs précédents aux yeux de `isLocked` (puisque celui-ci compte
   * depuis le dernier succès). Cela évite de supprimer l'historique audit.
   * On purge aussi les échecs récents du username.
   */
  reset(username: string): void {
    db.prepare(`
      DELETE FROM login_attempts WHERE username = ? AND success = 0
    `).run(username.toLowerCase());
  },

  gc(): void {
    const s = Settings.get();
    const windowMs = Math.max(s.lockout_window_minutes, 60) * 60 * 1000;
    db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?')
      .run(Date.now() - windowMs * 4);
  },
};
