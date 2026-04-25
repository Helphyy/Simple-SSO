# Outline + Simple SSO

Wiki **Outline** + IdP OIDC maison, 100% Docker, zéro dépendance externe.

## Démarrage

**1. Remplir les secrets dans `.env`**

```bash
openssl rand -hex 32   # SECRET_KEY, UTILS_SECRET, AUTH_SESSION_SECRET
openssl rand -hex 16   # POSTGRES_ADMIN_PASSWORD, OUTLINE_DB_PASSWORD
```

**2. Lancer**

```bash
docker compose up -d
```

**3. Créer ton compte admin**

Va sur **http://localhost:4000** → écran d'initialisation → choisis un identifiant et un mot de passe fort. Tu es auto-connecté.

**4. Créer le client OIDC**

Dans l'admin : **Applications → + Nouvelle** :

| Champ         | Valeur                                     |
|---------------|--------------------------------------------|
| Client ID     | `outline`                                  |
| Redirect URIs | `http://localhost:3000/auth/oidc.callback` |
| Post Logout   | `http://localhost:3000`                    |

Copie le **Client Secret** (affiché une seule fois) dans `.env` :

```env
OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=<le secret>
```

Puis :

```bash
docker compose up -d --force-recreate outline
```

**5. Créer les users**

Dans l'admin : **Utilisateurs → + Nouveau**. Ils se connectent ensuite sur Outline via "Continue with Simple SSO".

C'est fini. Wiki : **http://localhost:3000**

---

## Exposer en public (vraies URLs)

Si tu déploies sur un domaine public, remplace les URLs locales par tes URLs publiques **partout** :

Dans `.env` :

```env
URL=https://wiki.example.com
FORCE_HTTPS=true
AUTH_PUBLIC_URL=https://auth.example.com
```

Dans le client OIDC (admin UI) :

- Redirect URIs : `https://wiki.example.com/auth/oidc.callback`
- Post Logout : `https://wiki.example.com`

`AUTH_PUBLIC_URL` en `https://` active automatiquement le flag `Secure` sur les cookies.

---

## URLs

- Wiki : http://localhost:3000
- Admin : http://localhost:4000
- Apparence : http://localhost:4000/admin/branding
- Paramètres : http://localhost:4000/admin/settings
- Audit : http://localhost:4000/admin/audit

## Maintenance

```bash
docker compose logs -f              # voir les logs
docker compose pull && docker compose up -d    # mettre à jour
docker compose down -v && docker compose up -d # reset total (efface tout)
```

Admin a oublié son mdp — relancer le setup :

```bash
docker compose exec auth sqlite3 /app/data/auth.db \
  "DELETE FROM users; UPDATE app_settings SET setup_completed = 0;"
docker compose restart auth
```

Puis retourne sur http://localhost:4000 pour recréer l'admin.

## Backup

Les données : volumes `postgres-data`, `outline-data`, `auth-data`.

```bash
docker exec getouline-auth-1 sh -c 'cp /app/data/auth.db /app/data/auth.db.bak'
```
