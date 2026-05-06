import type Database from 'better-sqlite3';

type Migration = { id: number; name: string; sql: string };

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE users (
        id                   TEXT PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        email                TEXT UNIQUE NOT NULL,
        first_name           TEXT NOT NULL DEFAULT '',
        last_name            TEXT NOT NULL DEFAULT '',
        password_hash        TEXT NOT NULL,
        role                 TEXT NOT NULL CHECK (role IN ('admin','member')),
        enabled              INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL,
        last_login_at        INTEGER
      );
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_email    ON users(email);

      CREATE TABLE groups (
        id          TEXT PRIMARY KEY,
        name        TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE user_groups (
        user_id  TEXT NOT NULL,
        group_id TEXT NOT NULL,
        PRIMARY KEY (user_id, group_id),
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE TABLE oidc_clients (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        client_secret     TEXT NOT NULL,
        redirect_uris     TEXT NOT NULL,
        post_logout_uris  TEXT NOT NULL,
        allowed_scopes    TEXT NOT NULL,
        created_at        INTEGER NOT NULL
      );

      CREATE TABLE sessions (
        id               TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL,
        created_at       INTEGER NOT NULL,
        expires_at       INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        ip               TEXT,
        user_agent       TEXT,
        pending_pw_change INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);

      CREATE TABLE login_attempts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        username     TEXT NOT NULL,
        ip           TEXT NOT NULL,
        success      INTEGER NOT NULL,
        attempted_at INTEGER NOT NULL
      );
      CREATE INDEX idx_login_attempts_window
        ON login_attempts(username, ip, attempted_at);

      CREATE TABLE audit_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id TEXT,
        action        TEXT NOT NULL,
        target        TEXT,
        metadata      TEXT,
        ip            TEXT,
        created_at    INTEGER NOT NULL
      );
      CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

      CREATE TABLE branding (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        app_name        TEXT NOT NULL DEFAULT 'Simple SSO',
        tagline         TEXT NOT NULL DEFAULT 'Accès interne',
        primary_color   TEXT NOT NULL DEFAULT '#0f172a',
        accent_color    TEXT NOT NULL DEFAULT '#2563eb',
        logo_data_url   TEXT
      );
      INSERT INTO branding (id) VALUES (1);

      CREATE TABLE oidc_payloads (
        id         TEXT NOT NULL,
        type       INTEGER NOT NULL,
        payload    TEXT NOT NULL,
        grant_id   TEXT,
        user_code  TEXT,
        uid        TEXT,
        expires_at INTEGER,
        PRIMARY KEY (id, type)
      );
      CREATE INDEX idx_oidc_payloads_grant ON oidc_payloads(grant_id);
      CREATE INDEX idx_oidc_payloads_user_code ON oidc_payloads(user_code);
      CREATE INDEX idx_oidc_payloads_uid ON oidc_payloads(uid);
      CREATE INDEX idx_oidc_payloads_expires ON oidc_payloads(expires_at);

      CREATE TABLE jwks (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        keys_json  TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'rebrand_default',
    sql: `
      UPDATE branding SET app_name = 'Simple SSO' WHERE app_name = 'auth';
      UPDATE branding SET tagline  = 'Accès interne' WHERE tagline = 'Connexion';
    `,
  },
  {
    id: 3,
    name: 'branding_extra',
    sql: `
      ALTER TABLE branding ADD COLUMN background_data_url TEXT;
      ALTER TABLE branding ADD COLUMN background_opacity INTEGER NOT NULL DEFAULT 100;
      ALTER TABLE branding ADD COLUMN default_theme TEXT NOT NULL DEFAULT 'dark';
      ALTER TABLE branding ADD COLUMN radius TEXT NOT NULL DEFAULT 'sm';
      ALTER TABLE branding ADD COLUMN footer_text TEXT NOT NULL DEFAULT '';
      ALTER TABLE branding ADD COLUMN login_button_label TEXT NOT NULL DEFAULT 'Se connecter';
    `,
  },
  {
    id: 4,
    name: 'app_settings',
    sql: `
      CREATE TABLE app_settings (
        id                       INTEGER PRIMARY KEY CHECK (id = 1),
        lockout_max_attempts     INTEGER NOT NULL DEFAULT 5,
        lockout_window_minutes   INTEGER NOT NULL DEFAULT 15,
        password_min_length      INTEGER NOT NULL DEFAULT 12,
        password_min_score       INTEGER NOT NULL DEFAULT 3,
        session_ttl_minutes      INTEGER NOT NULL DEFAULT 480,
        session_idle_minutes     INTEGER NOT NULL DEFAULT 60,
        login_mode               TEXT NOT NULL DEFAULT 'both',
        default_role             TEXT NOT NULL DEFAULT 'member'
      );
      INSERT INTO app_settings (id) VALUES (1);
    `,
  },
  {
    id: 5,
    name: 'email_optional',
    sql: `
      CREATE TABLE users_new (
        id                   TEXT PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        email                TEXT UNIQUE,
        first_name           TEXT NOT NULL DEFAULT '',
        last_name            TEXT NOT NULL DEFAULT '',
        password_hash        TEXT NOT NULL,
        role                 TEXT NOT NULL CHECK (role IN ('admin','member')),
        enabled              INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL,
        last_login_at        INTEGER
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_email    ON users(email);
    `,
  },
  {
    id: 6,
    name: 'setup_flag',
    sql: `
      ALTER TABLE app_settings ADD COLUMN setup_completed INTEGER NOT NULL DEFAULT 0;
      UPDATE app_settings SET setup_completed = 1
        WHERE (SELECT COUNT(*) FROM users) > 0;
    `,
  },
  {
    id: 7,
    name: 'client_branding',
    sql: `
      CREATE TABLE client_branding (
        client_id            TEXT PRIMARY KEY,
        app_name             TEXT,
        tagline              TEXT,
        primary_color        TEXT,
        accent_color         TEXT,
        logo_data_url        TEXT,
        background_data_url  TEXT,
        background_opacity   INTEGER,
        login_button_label   TEXT,
        footer_text          TEXT,
        FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE
      );
    `,
  },
  {
    id: 8,
    name: 'client_access',
    sql: `
      CREATE TABLE client_access (
        client_id      TEXT NOT NULL,
        principal_type TEXT NOT NULL CHECK (principal_type IN ('user','group')),
        principal_id   TEXT NOT NULL,
        PRIMARY KEY (client_id, principal_type, principal_id),
        FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_client_access_client ON client_access(client_id);
      ALTER TABLE oidc_clients ADD COLUMN home_url TEXT;
    `,
  },
  {
    id: 9,
    name: 'email_required',
    // Backfill any user with NULL email to a placeholder so OIDC clients
    // requiring an email claim (Outline) keep working, then make the column
    // NOT NULL. Admins are expected to update placeholder emails afterwards.
    sql: `
      UPDATE users
         SET email = username || '@local.invalid'
       WHERE email IS NULL OR email = '';

      CREATE TABLE users_new (
        id                   TEXT PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        email                TEXT UNIQUE NOT NULL,
        first_name           TEXT NOT NULL DEFAULT '',
        last_name            TEXT NOT NULL DEFAULT '',
        password_hash        TEXT NOT NULL,
        role                 TEXT NOT NULL CHECK (role IN ('admin','member')),
        enabled              INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL,
        last_login_at        INTEGER
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_email    ON users(email);
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all()
      .map((r: any) => r.id as number)
  );

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.id, m.name, Date.now());
    })();
    console.log(`[db] migration ${m.id} applied: ${m.name}`);
  }
}
