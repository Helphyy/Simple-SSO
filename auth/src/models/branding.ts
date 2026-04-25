import { db } from '../db/index.js';

export type ThemeMode = 'dark' | 'light' | 'system';
export type RadiusKey = 'none' | 'sm' | 'md' | 'lg';

export interface Branding {
  app_name: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  logo_data_url: string | null;
  background_data_url: string | null;
  background_opacity: number;
  default_theme: ThemeMode;
  radius: RadiusKey;
  footer_text: string;
  login_button_label: string;
}

export interface ClientBranding {
  app_name: string | null;
  tagline: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_data_url: string | null;
  background_data_url: string | null;
  background_opacity: number | null;
  login_button_label: string | null;
  footer_text: string | null;
}

const COLUMNS = [
  'app_name', 'tagline', 'primary_color', 'accent_color', 'logo_data_url',
  'background_data_url', 'background_opacity', 'default_theme', 'radius',
  'footer_text', 'login_button_label',
] as const;

const CLIENT_COLUMNS = [
  'app_name', 'tagline', 'primary_color', 'accent_color', 'logo_data_url',
  'background_data_url', 'background_opacity', 'login_button_label', 'footer_text',
] as const;

export const Brand = {
  /**
   * Returns the global branding, optionally merged with a client's overrides.
   * For a given clientId, any non-null override field replaces the global value.
   */
  get(clientId?: string | null): Branding {
    const global = db.prepare(`
      SELECT ${COLUMNS.join(', ')} FROM branding WHERE id = 1
    `).get() as Branding;
    if (!clientId) return global;
    const override = db.prepare(`
      SELECT ${CLIENT_COLUMNS.join(', ')} FROM client_branding WHERE client_id = ?
    `).get(clientId) as ClientBranding | undefined;
    if (!override) return global;
    const merged: any = { ...global };
    for (const k of CLIENT_COLUMNS) {
      const v = (override as any)[k];
      if (v !== null && v !== undefined) merged[k] = v;
    }
    return merged as Branding;
  },

  update(patch: Partial<Branding>): void {
    const fields: string[] = [];
    const values: any[] = [];
    for (const k of COLUMNS) {
      if (patch[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(patch[k]);
      }
    }
    if (!fields.length) return;
    db.prepare(`UPDATE branding SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  },

  getClient(clientId: string): ClientBranding {
    const row = db.prepare(`
      SELECT ${CLIENT_COLUMNS.join(', ')} FROM client_branding WHERE client_id = ?
    `).get(clientId) as ClientBranding | undefined;
    if (row) return row;
    const empty: any = {};
    for (const k of CLIENT_COLUMNS) empty[k] = null;
    return empty as ClientBranding;
  },

  updateClient(clientId: string, patch: Partial<ClientBranding>): void {
    const fields: string[] = [];
    const values: any[] = [];
    for (const k of CLIENT_COLUMNS) {
      if (patch[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(patch[k]);
      }
    }
    if (!fields.length) return;
    db.transaction(() => {
      const existing = db.prepare('SELECT 1 FROM client_branding WHERE client_id = ?').get(clientId);
      if (!existing) {
        db.prepare('INSERT INTO client_branding (client_id) VALUES (?)').run(clientId);
      }
      values.push(clientId);
      db.prepare(`UPDATE client_branding SET ${fields.join(', ')} WHERE client_id = ?`).run(...values);
    })();
  },
};

export const RADIUS_MAP: Record<RadiusKey, { base: string; card: string }> = {
  none: { base: '0px', card: '0px' },
  sm:   { base: '4px', card: '6px' },
  md:   { base: '8px', card: '10px' },
  lg:   { base: '14px', card: '16px' },
};
