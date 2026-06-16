# Simple SSO

**The simplest SSO possible.** A self-hosted OIDC IdP that fits in a single `docker compose up`. No three-day Keycloak setup, no Postgres to provision just for auth, no 400-line YAML. A clean admin UI to manage users, client applications, branding and audit logs. That's it.

Deliberately minimalist stack: SQLite for the IdP, zero external dependencies, built for small teams and internal deployments that want SSO without the complexity.

Simple SSO was originally built to plug SSO into **Outline**, which is why the wiki ships in this repo as the reference integration: it doubles as the use case that drove the development and as an end-to-end test of the OIDC flow. You can drop it or replace it with any OIDC-compatible app.

## What Simple SSO provides

- Standard OIDC endpoints: `/auth`, `/token`, `/me`, `/session/end`, `.well-known/openid-configuration`
- Admin UI (port `4000`): users, OIDC clients, branding, settings, audit
- Local SQLite storage (`auth-data`), no Postgres required for the IdP
- Secure sessions (`Secure` cookies auto-enabled over HTTPS)

## Getting started

> **Dev networking note.** In dev, `localhost` works everywhere (browser, Outline, Planka), thanks to two pieces of plumbing:
> - **Outline** uses split OIDC URIs (`OIDC_AUTH_URI` for the browser, `OIDC_TOKEN_URI` for the internal Docker DNS).
> - **Planka** runs alongside a tiny `socat` sidecar (`planka-sso-proxy`) that listens on `localhost:4000` *inside Planka's network namespace* and forwards to `auth:4000`. The browser AND Planka use the same `OIDC_ISSUER=http://localhost:4000`.
>
> In prod, none of this matters: your public domain (`https://sso.example.com`) resolves identically from anywhere.

**1. Fill in the secrets in `.env`**

```bash
openssl rand -hex 32   # SECRET_KEY, UTILS_SECRET, AUTH_SESSION_SECRET, PLANKA_SECRET_KEY
openssl rand -hex 16   # OUTLINE_DB_PASSWORD
```

For dev over plain HTTP, keep `NODE_ENV=development` and `ENVIRONMENT=development` (Outline refuses to send its OAuth state cookie over HTTP if `NODE_ENV=production`).

**2. Start it up**

```bash
docker compose up -d
```

**3. Create the admin account**

Open **http://localhost:4000**, the setup screen will prompt you for a username and a strong password. You're auto-logged in.

**4. Register a client application**

In the admin: **Applications, + New**. Example for the bundled Outline integration:

| Field         | Value                                      |
|---------------|--------------------------------------------|
| Client ID     | `outline`                                  |
| Home URL      | `http://localhost:3000`                    |
| Redirect URIs | `http://localhost:3000/auth/oidc.callback` |
| Post Logout   | `http://localhost:3000`                    |

> The **Home URL** is what the user dashboard card links to. If left empty, the card is rendered greyed-out and non-clickable.

Copy the **Client Secret** (shown only once) into `.env`:

```env
OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=<the secret>
```

Then:

```bash
docker compose up -d --force-recreate outline
```

**5. Create users**

In the admin: **Users, + New**. They then sign in to the client app via the SSO button.

**6. Grant access to the application**

By default, each new OIDC client is **open** (everyone authenticated can sign in). As soon as you add the first allowed principal (user or group), it switches to **restricted**: only listed users/groups can access.

In the admin: **Applications, click the app, Configure access**. Pick the users or groups that should be allowed. The selected users will see the app card on their dashboard. Users without access get an `access_denied` error mid-OIDC flow.

> Admins are not implicitly allowed. If you restrict an app to a specific group, add yourself too (or your group) or you'll be locked out.

End-to-end test: **http://localhost:3000** (Outline), click "Continue with Simple SSO".

---

## Bundled integration: Planka

The stack also ships **Planka** (open source Trello alternative, modern UI) as a second OIDC client on port `3002`. It uses its own Postgres 16 (`planka-postgres-data` volume) and a `planka-data` volume for uploads. A `socat` sidecar (`planka-sso-proxy`) makes `localhost:4000` resolve to the SSO from inside Planka.

Add to `.env`:

```env
PLANKA_PUBLIC_URL=http://localhost:3002
PLANKA_SECRET_KEY=<openssl rand -hex 32>
PLANKA_OIDC_CLIENT_ID=planka
PLANKA_OIDC_CLIENT_SECRET=<filled after registering the client below>
```

Register the client in the SSO admin (**Applications, + New**):

| Field         | Value                                       |
|---------------|---------------------------------------------|
| Client ID     | `planka`                                    |
| Home URL      | `http://localhost:3002`                     |
| Redirect URIs | `http://localhost:3002/oidc-callback`       |
| Post Logout   | `http://localhost:3002`                     |

Then **Configure access** on the client to add the users/groups allowed to sign in (see step 6 above). Without an access entry the app stays open to all authenticated users; as soon as one entry exists, only listed principals get in.

Copy the generated secret into `PLANKA_OIDC_CLIENT_SECRET`, then:

```bash
docker compose up -d --force-recreate planka
```

Open **http://LAN_IP:3002** and click the "Single Sign-On" button on the login screen.

> Going public: update `PLANKA_PUBLIC_URL` to your public URL (e.g. `https://kanban.example.com`) and update the Redirect URI in the admin accordingly.

---

## Integrating another application

Any standard OIDC client works. Give it:

- **Issuer / Discovery**: `${AUTH_PUBLIC_URL}/.well-known/openid-configuration`
- **Client ID / Secret**: shown when you create the client in the admin
- **Scopes**: `openid profile email`

Then add the matching `Redirect URI` in the client's record.

---

## Going public

On a public domain, replace local URLs **everywhere**:

In `.env`:

```env
AUTH_PUBLIC_URL=https://auth.example.com
URL=https://wiki.example.com           # Outline side
PLANKA_PUBLIC_URL=https://kanban.example.com
NODE_ENV=production
ENVIRONMENT=production
FORCE_HTTPS=true
```

In the OIDC client (admin UI): update Redirect URIs and Post Logout with the public URLs.

`AUTH_PUBLIC_URL` over `https://` automatically enables `Secure` on session cookies. In production, put a reverse proxy (Caddy/Traefik) in front.

---

## URLs

- SSO admin: http://localhost:4000
  - Branding: `/admin/branding`
  - Settings: `/admin/settings`
  - Audit: `/admin/audit`
- Wiki (Outline): http://localhost:3000
- Kanban (Planka): http://localhost:3002

## Maintenance

```bash
docker compose logs -f                            # tail logs
docker compose pull && docker compose up -d      # update
docker compose down -v && docker compose up -d   # full reset (wipes everything)
```

Admin forgot their password, rerun setup:

```bash
docker compose exec auth sqlite3 /app/data/auth.db \
  "DELETE FROM users; UPDATE app_settings SET setup_completed = 0;"
docker compose restart auth
```

Then go back to http://localhost:4000 to recreate the admin.

## Backup

Volumes to back up:

- `auth-data`: Simple SSO SQLite database (users, clients, audit, settings)
- `postgres-data`, `outline-data`: only if you use the Outline integration
- `planka-postgres-data`, `planka-data`: only if you use the Planka integration

```bash
docker exec getouline-auth-1 sh -c 'cp /app/data/auth.db /app/data/auth.db.bak'
```

## License

This project is licensed under the **GNU General Public License v3.0** (GPLv3). See the [LICENSE](LICENSE) file for the full text.
