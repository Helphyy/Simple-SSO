import { db } from '../db/index.js';

export type LoginMode = 'username' | 'email' | 'both';
export type DefaultRole = 'admin' | 'member';

export interface AppSettings {
  lockout_max_attempts: number;     // 0 = never lock
  lockout_window_minutes: number;
  password_min_length: number;
  password_min_score: number;       // zxcvbn 0..4
  session_ttl_minutes: number;
  session_idle_minutes: number;
  login_mode: LoginMode;
  default_role: DefaultRole;
  setup_completed: number;          // 0/1
}

const COLUMNS = [
  'lockout_max_attempts', 'lockout_window_minutes',
  'password_min_length', 'password_min_score',
  'session_ttl_minutes', 'session_idle_minutes',
  'login_mode', 'default_role',
  'setup_completed',
] as const;

let cache: AppSettings | null = null;

export const Settings = {
  get(): AppSettings {
    if (cache) return cache;
    cache = db.prepare(`
      SELECT ${COLUMNS.join(', ')} FROM app_settings WHERE id = 1
    `).get() as AppSettings;
    return cache;
  },

  update(patch: Partial<AppSettings>): void {
    const fields: string[] = [];
    const values: any[] = [];
    for (const k of COLUMNS) {
      if (patch[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(patch[k]);
      }
    }
    if (!fields.length) return;
    db.prepare(`UPDATE app_settings SET ${fields.join(', ')} WHERE id = 1`).run(...values);
    cache = null;
  },

  invalidate(): void { cache = null; },
};
