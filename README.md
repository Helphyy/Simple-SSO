# Simple SSO

**The simplest SSO possible.** A self-hosted OIDC IdP that fits in a single `docker compose up`. No three-day Keycloak setup, no Postgres to provision just for auth, no 400-line YAML. A clean admin UI to manage users, client applications, branding and audit logs. That's it.

Deliberately minimalist stack: SQLite for the IdP, zero external dependencies, built for small teams and internal deployments that want SSO without the complexity.

Simple SSO was originally built to plug SSO into **Outline**, which is why the wiki ships in this repo as the reference integration: it doubles as the use case that drove the development and as an end-to-end test of the OIDC flow. You can drop it or replace it with any OIDC-compatible app.

## What Simple SSO provides

- Standard OIDC endpoints: `/auth`, `/token`, `/me`, `/session/end`, `.well-known/openid-configuration`
- Admin UI (port `4000`): users, OIDC clients, branding, settings, audit
- Local SQLite storage (`auth-data`), no Postgres required for the IdP
- Secure sessions (`Secure` cookies auto-enabled over HTTPS)

## What's in the box

| Service   | Role                                             | Port   |
|-----------|--------------------------------------------------|--------|
| `auth`    | Simple SSO, the OIDC IdP + admin UI              | `4000` |
| `outline` | Wiki (reference OIDC integration)                | `3000` |
| `vikunja` | Project management: List, Kanban, Gantt, Table   | `3002` |
| `postgres`, `redis` | Outline dependencies                   | internal |

Vikunja runs SQLite too (`vikunja-db` volume, `vikunja-files` for attachments) and has local login disabled: SSO only.

---

## Getting started

Two deployment modes, same numbered path:

- **Mode A, local dev**: everything on `localhost`, plain HTTP, zero extra setup.
- **Mode B, VM behind your own nginx**: the stack runs on a VM, you reach it through hostnames resolved via `/etc/hosts` (example here: `sso.local.langskip.net`, `kb.local.langskip.net`, `projet.local.langskip.net`), nginx installed natively (`apt install nginx`) terminates self-signed TLS. Steps marked **bis** apply only to mode B.

> **Why it just works on localhost (mode A).** Outline uses split OIDC URIs (`OIDC_AUTH_URI` for the browser, `OIDC_TOKEN_URI` over internal Docker DNS), and Vikunja runs with `network_mode: host` so the container's `localhost` is the machine's: the issuer `http://localhost:4000` resolves identically for its server and for your browser.

### 1. Configure `.env`

Copy `.env.example` to `.env`, generate the secrets:

```bash
openssl rand -hex 32   # SECRET_KEY, UTILS_SECRET, AUTH_SESSION_SECRET, VIKUNJA_JWT_SECRET
openssl rand -hex 16   # OUTLINE_DB_PASSWORD
```

Then set the three public URLs:

| Variable            | Mode A (local dev)      | Mode B (VM + nginx)                  |
|---------------------|-------------------------|--------------------------------------|
| `AUTH_PUBLIC_URL`   | `http://localhost:4000` | `https://sso.local.langskip.net`     |
| `URL` (Outline)     | `http://localhost:3000` | `https://kb.local.langskip.net`      |
| `VIKUNJA_PUBLIC_URL`| `http://localhost:3002` | `https://projet.local.langskip.net`  |

Keep `FORCE_HTTPS=false` in both modes (in mode B, TLS is terminated by nginx and Outline stays plain HTTP behind it). `NODE_ENV=production` works even over plain HTTP: the compose file patches Outline's hardcoded `secure` cookie flag at container start.

The two OIDC client secrets (`OIDC_CLIENT_SECRET`, `VIKUNJA_OIDC_CLIENT_SECRET`) stay empty for now, they are generated at step 4.

### 1 bis. (mode B) `/etc/hosts`, in two places

On your workstation, point the names to the VM's IP:

```
192.168.x.x  sso.local.langskip.net kb.local.langskip.net projet.local.langskip.net
```

On the VM itself, point them to loopback. This one is required: Vikunja runs with host networking and fetches the OIDC discovery from `sso.local.langskip.net`, which must resolve from the VM too.

```
127.0.0.1  sso.local.langskip.net kb.local.langskip.net projet.local.langskip.net
```

### 2. Start the stack

```bash
docker compose up -d --build
```

### 2 bis. (mode B) Self-signed TLS + nginx

**a. Local CA + one certificate with the three names as SANs (on the VM):**

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

**b. nginx virtual hosts.** TLS terminated here, one server block per hostname, proxying to the container ports. The `Upgrade`/`Connection` headers are required: Outline uses websockets for live collaboration.

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

**c. Make Vikunja trust the CA.** Vikunja fetches the OIDC discovery from `https://sso.local.langskip.net` server-side and rejects the self-signed chain otherwise. In `docker-compose.yml`, service `vikunja`, uncomment the two prepared lines:

```yaml
    volumes:
      - /etc/nginx/certs/ca.crt:/certs/ca.crt:ro
    environment:
      SSL_CERT_FILE: /certs/ca.crt
```

Outline needs nothing: its server-side OIDC calls go straight to `http://auth:4000` inside the Docker network. Then:

```bash
nginx -t && systemctl reload nginx
docker compose up -d --force-recreate vikunja
```

### 3. Create the admin account

Open the SSO (`http://localhost:4000` or `https://sso.local.langskip.net`), the setup screen prompts you for a username and a strong password. You're auto-logged in.

### 4. Register the client applications

In the admin: **Applications, + New**, once per app. The **Home URL** is what the user dashboard card links to; left empty, the card renders greyed-out and non-clickable.

**Outline:**

| Field         | Mode A                                       | Mode B                                              |
|---------------|----------------------------------------------|-----------------------------------------------------|
| Client ID     | `outline`                                    | `outline`                                           |
| Home URL      | `http://localhost:3000`                      | `https://kb.local.langskip.net`                     |
| Redirect URIs | `http://localhost:3000/auth/oidc.callback`   | `https://kb.local.langskip.net/auth/oidc.callback`  |
| Post Logout   | `http://localhost:3000`                      | `https://kb.local.langskip.net`                     |

**Vikunja:**

| Field         | Mode A                                          | Mode B                                                       |
|---------------|-------------------------------------------------|--------------------------------------------------------------|
| Client ID     | `vikunja`                                       | `vikunja`                                                    |
| Home URL      | `http://localhost:3002`                         | `https://projet.local.langskip.net`                          |
| Redirect URIs | `http://localhost:3002/auth/openid/simplesso`   | `https://projet.local.langskip.net/auth/openid/simplesso`    |
| Post Logout   | `http://localhost:3002`                         | `https://projet.local.langskip.net`                          |

Each **Client Secret** is shown only once: copy them into `.env` (`OIDC_CLIENT_SECRET` for Outline, `VIKUNJA_OIDC_CLIENT_SECRET` for Vikunja), then:

```bash
docker compose up -d --force-recreate outline vikunja
```

> Vikunja fetches the OIDC discovery document at startup: any time the secret or the SSO URL changes, recreate the container as above. If the SSO button is missing on its login page, check `docker compose logs vikunja | grep -i openid`.

### 5. Create users

In the admin: **Users, + New**. They then sign in to the client apps via the SSO button.

### 6. Grant access to the applications

By default, each new OIDC client is **open** (everyone authenticated can sign in). As soon as you add the first allowed principal (user or group), it switches to **restricted**: only listed users/groups can access.

In the admin: **Applications, click the app, Configure access**. The selected users see the app card on their dashboard; users without access get an `access_denied` error mid-OIDC flow.

> Admins are not implicitly allowed. If you restrict an app to a specific group, add yourself too (or your group) or you'll be locked out.

### 7. Test end-to-end

- Outline: `http://localhost:3000` or `https://kb.local.langskip.net`, click "Continue with Simple SSO".
- Vikunja: `http://localhost:3002` or `https://projet.local.langskip.net`, click the "Simple SSO" button. The first login creates the Vikunja account automatically from the OIDC claims.

---

## Integrating another application

Any standard OIDC client works. Give it:

- **Issuer / Discovery**: `${AUTH_PUBLIC_URL}/.well-known/openid-configuration`
- **Client ID / Secret**: shown when you create the client in the admin
- **Scopes**: `openid profile email`

Then add the matching `Redirect URI` in the client's record.

---

## Going public

On a public domain, same logic as mode B with a real DNS and a real certificate (Let's Encrypt via your reverse proxy). In `.env`:

```env
AUTH_PUBLIC_URL=https://auth.example.com
URL=https://wiki.example.com           # Outline side
VIKUNJA_PUBLIC_URL=https://tasks.example.com
NODE_ENV=production
ENVIRONMENT=production
FORCE_HTTPS=true
```

Update the Redirect URIs and Post Logout in the admin with the public URLs. `AUTH_PUBLIC_URL` over `https://` automatically enables `Secure` on session cookies. With a publicly trusted certificate, the Vikunja CA-trust step (2 bis c) is unnecessary.

---

## URLs

- SSO admin: `http://localhost:4000` (or your `AUTH_PUBLIC_URL`)
  - Branding: `/admin/branding`
  - Settings: `/admin/settings`
  - Audit: `/admin/audit`
- Wiki (Outline): `http://localhost:3000`
- Kanban + Gantt (Vikunja): `http://localhost:3002`

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

Then go back to the SSO URL to recreate the admin.

## Backup

Volumes to back up:

- `auth-data`: Simple SSO SQLite database (users, clients, audit, settings)
- `postgres-data`, `outline-data`: only if you use the Outline integration
- `vikunja-db`, `vikunja-files`: only if you use the Vikunja integration

```bash
docker compose exec auth sh -c 'cp /app/data/auth.db /app/data/auth.db.bak'
```

## License

This project is licensed under the **GNU General Public License v3.0** (GPLv3). See the [LICENSE](LICENSE) file for the full text.
