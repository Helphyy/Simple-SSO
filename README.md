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

**1. Fill in the secrets in `.env`**

```bash
openssl rand -hex 32   # SECRET_KEY, UTILS_SECRET, AUTH_SESSION_SECRET
openssl rand -hex 16   # OUTLINE_DB_PASSWORD
```

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
| Redirect URIs | `http://localhost:3000/auth/oidc.callback` |
| Post Logout   | `http://localhost:3000`                    |

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

End-to-end test: **http://localhost:3000** (Outline), click "Continue with Simple SSO".

---

## Bundled integration: kan.bn

The stack also ships **kan.bn** (open source Trello alternative) as a second OIDC client, exposed on port `3002`. It runs on its own Postgres 15 (kan requires 15, Outline 17) with a dedicated `kan-postgres-data` volume.

Add these to `.env`:

```env
KAN_PUBLIC_URL=http://localhost:3002
KAN_DB_PASSWORD=<openssl rand -hex 16>
KAN_BETTER_AUTH_SECRET=<openssl rand -hex 32>
KAN_OIDC_CLIENT_ID=kan
KAN_OIDC_CLIENT_SECRET=<filled after registering the client below>
```

Register the client in the SSO admin (**Applications, + New**):

| Field         | Value                                                  |
|---------------|--------------------------------------------------------|
| Client ID     | `kan`                                                  |
| Redirect URIs | `http://localhost:3002/api/auth/oauth2/callback/oidc`  |
| Post Logout   | `http://localhost:3002`                                |

Copy the generated secret into `KAN_OIDC_CLIENT_SECRET`, then:

```bash
docker compose up -d --force-recreate kan
```

Open **http://localhost:3002** and use "Sign in with OIDC".

> Going public: update `KAN_PUBLIC_URL` to your public URL (e.g. `https://kan.example.com`) and update the Redirect URI in the admin accordingly.

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
URL=https://wiki.example.com         # Outline side
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
- Kanban (kan.bn): http://localhost:3002

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
- `kan-postgres-data`: only if you use the kan.bn integration

```bash
docker exec getouline-auth-1 sh -c 'cp /app/data/auth.db /app/data/auth.db.bak'
```

## License

This project is licensed under the **GNU General Public License v3.0** (GPLv3). See the [LICENSE](LICENSE) file for the full text.
