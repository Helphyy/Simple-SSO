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

> **Dev networking note.** In dev, `localhost` works everywhere (browser, Outline, Vikunja):
> - **Outline** uses split OIDC URIs (`OIDC_AUTH_URI` for the browser, `OIDC_TOKEN_URI` for the internal Docker DNS).
> - **Vikunja** runs with `network_mode: host`: the container's `localhost` is the machine's, so the OIDC issuer `http://localhost:4000` resolves identically for the Vikunja server and for the browser. It listens directly on port `3002`.
>
> In prod, none of this matters: your public domain (`https://sso.example.com`) resolves identically from anywhere.

**1. Fill in the secrets in `.env`**

```bash
openssl rand -hex 32   # SECRET_KEY, UTILS_SECRET, AUTH_SESSION_SECRET, PLANKA_SECRET_KEY
openssl rand -hex 16   # OUTLINE_DB_PASSWORD
```

`NODE_ENV=production` works even for local HTTP dev: the compose file patches Outline's hardcoded `secure` cookie flag at container start (see the comment above the `outline` service), so no HTTPS is required locally.

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

## Bundled integration: Vikunja

The stack also ships **Vikunja** (open source project management: List, **Kanban**, **Gantt** and Table views on the same tasks) as a second OIDC client on port `3002`. It stores everything in SQLite (`vikunja-db` volume) plus a `vikunja-files` volume for attachments; no extra Postgres needed. Local login is disabled: SSO only.

Add to `.env`:

```env
VIKUNJA_PUBLIC_URL=http://localhost:3002
VIKUNJA_JWT_SECRET=<openssl rand -hex 32>
VIKUNJA_OIDC_CLIENT_ID=vikunja
VIKUNJA_OIDC_CLIENT_SECRET=<filled after registering the client below>
```

Register the client in the SSO admin (**Applications, + New**):

| Field         | Value                                          |
|---------------|------------------------------------------------|
| Client ID     | `vikunja`                                      |
| Home URL      | `http://localhost:3002`                        |
| Redirect URIs | `http://localhost:3002/auth/openid/simplesso`  |
| Post Logout   | `http://localhost:3002`                        |

Then **Configure access** on the client to add the users/groups allowed to sign in (see step 6 above). Without an access entry the app stays open to all authenticated users; as soon as one entry exists, only listed principals get in.

Copy the generated secret into `VIKUNJA_OIDC_CLIENT_SECRET`, then:

```bash
docker compose up -d --force-recreate vikunja
```

Open **http://localhost:3002** and click the "Simple SSO" button on the login screen. The first login creates your Vikunja account automatically from the OIDC claims.

> Vikunja fetches the OIDC discovery document at startup. If you change the client secret or the SSO was not up yet, recreate the container (`docker compose up -d --force-recreate vikunja`).
>
> Going public: update `VIKUNJA_PUBLIC_URL` to your public URL (e.g. `https://tasks.example.com`) and update the Redirect URI in the admin accordingly.

---

## Integrating another application

Any standard OIDC client works. Give it:

- **Issuer / Discovery**: `${AUTH_PUBLIC_URL}/.well-known/openid-configuration`
- **Client ID / Secret**: shown when you create the client in the admin
- **Scopes**: `openid profile email`

Then add the matching `Redirect URI` in the client's record.

---

## Deploying on a VM behind your own nginx (self-signed TLS)

Scenario: the stack runs on a VM, you access it through hostnames (here `*.local.langskip.net`) resolved via `/etc/hosts`, and a natively installed nginx (`apt install nginx`) on the VM terminates TLS with a self-signed certificate and routes by hostname to the containers. No public exposure.

**1. `/etc/hosts`, in two places**

On your workstation, point the names to the VM's IP:

```
192.168.x.x  sso.local.langskip.net kb.local.langskip.net projet.local.langskip.net
```

On the VM itself, point them to loopback (required: Vikunja runs with host networking and fetches the OIDC discovery from `sso.local.langskip.net`, which must resolve from the VM too):

```
127.0.0.1  sso.local.langskip.net kb.local.langskip.net projet.local.langskip.net
```

**2. Local CA + certificate (on the VM)**

One throwaway CA plus one certificate with the three names as SANs:

```bash
mkdir -p /etc/nginx/certs && cd /etc/nginx/certs

# CA
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout ca.key -out ca.crt -subj "/CN=langskip local CA"

# Server key + CSR + signed cert (SANs = the 3 hostnames)
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr \
  -subj "/CN=sso.local.langskip.net"
cat > san.cnf <<'CNF'
subjectAltName=DNS:sso.local.langskip.net,DNS:kb.local.langskip.net,DNS:projet.local.langskip.net
CNF
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -sha256 -extfile san.cnf -out server.crt
```

Import `ca.crt` in your workstation browser (Settings, Certificates, Authorities) to get rid of the warnings.

**3. `.env`**

```env
AUTH_PUBLIC_URL=https://sso.local.langskip.net
URL=https://kb.local.langskip.net
VIKUNJA_PUBLIC_URL=https://projet.local.langskip.net
FORCE_HTTPS=false   # TLS is terminated by nginx, Outline stays plain HTTP internally
```

**4. Make Vikunja trust the CA**

Vikunja fetches the OIDC discovery from `https://sso.local.langskip.net` server-side and will reject the self-signed chain otherwise. Add to the `vikunja` service in `docker-compose.yml`:

```yaml
    environment:
      SSL_CERT_FILE: /certs/ca.crt   # Go trusts only this CA, enough here
    volumes:
      - /etc/nginx/certs/ca.crt:/certs/ca.crt:ro
```

Outline needs nothing: its server-side OIDC calls go straight to `http://auth:4000` inside the Docker network.

**5. Redirect URIs in the SSO admin**

| Client    | Home URL                             | Redirect URI                                               |
|-----------|--------------------------------------|------------------------------------------------------------|
| `outline` | `https://kb.local.langskip.net`      | `https://kb.local.langskip.net/auth/oidc.callback`          |
| `vikunja` | `https://projet.local.langskip.net`  | `https://projet.local.langskip.net/auth/openid/simplesso`   |

**6. nginx**

One server block per hostname, TLS terminated here, proxying to the container ports. The `Upgrade`/`Connection` headers are required: Outline uses websockets for live collaboration.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name sso.local.langskip.net kb.local.langskip.net projet.local.langskip.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sso.local.langskip.net;
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name kb.local.langskip.net;
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}

server {
    listen 443 ssl;
    server_name projet.local.langskip.net;
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

Then `docker compose up -d --force-recreate outline vikunja` after changing `.env`, and reload nginx. `AUTH_PUBLIC_URL` in `https://` automatically enables `Secure` on the SSO session cookies; Outline keeps its patched non-Secure cookies, which browsers accept over HTTPS without issue.

---

## Going public

On a public domain, replace local URLs **everywhere**:

In `.env`:

```env
AUTH_PUBLIC_URL=https://auth.example.com
URL=https://wiki.example.com           # Outline side
VIKUNJA_PUBLIC_URL=https://tasks.example.com
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
- Kanban + Gantt (Vikunja): http://localhost:3002

## Maintenance

```bash
docker compose logs -f                            # tail logs
docker compose pull && docker compose up -d      # update
docker compose down -v && docker compose up -d   # full reset (wipes everything)
```

> **Vikunja networking note.** `vikunja` uses `network_mode: host` (Linux only) and listens on port `3002` of the machine directly, no `ports:` mapping involved. If that port is busy, change `VIKUNJA_SERVICE_INTERFACE` in the compose file.

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
- `vikunja-db`, `vikunja-files`: only if you use the Vikunja integration

```bash
docker exec getouline-auth-1 sh -c 'cp /app/data/auth.db /app/data/auth.db.bak'
```

## License

This project is licensed under the **GNU General Public License v3.0** (GPLv3). See the [LICENSE](LICENSE) file for the full text.
