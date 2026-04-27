import { html, raw, type Raw } from '../lib/html.js';
import { layout } from './layout.js';
import type { OidcClientPublic } from '../models/clients.js';
import type { User } from '../models/users.js';
import { getLang, t } from '../lib/i18n.js';

type AppCard = OidcClientPublic & { logo: string | null; displayName: string };

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function faviconFor(homeUrl: string | null): string | null {
  if (!homeUrl) return null;
  try {
    const u = new URL(homeUrl);
    return `${u.origin}/favicon.ico`;
  } catch { return null; }
}

export function userHubPage(opts: {
  user: User;
  csrfToken: string;
  apps: AppCard[];
}): Raw {
  const greeting = opts.user.first_name
    ? `${t('Hello,', 'Bonjour,')} ${opts.user.first_name}.`
    : `${t('Hello,', 'Bonjour,')} ${opts.user.username}.`;

  const body = html`
    <div class="page-header fade-in">
      <div>
        <h1 class="page-title">${greeting}</h1>
        <p class="page-subtitle">${opts.apps.length === 0
          ? t('No applications available.', 'Aucune application disponible.')
          : opts.apps.length === 1
            ? t('1 application available.', '1 application accessible.')
            : `${opts.apps.length} ${t('applications available.', 'applications accessibles.')}`}</p>
      </div>
    </div>

    ${opts.apps.length === 0 ? html`
      <div class="card fade-in fade-in-1">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="11" y="3" width="6" height="6" rx="1.3"/><rect x="3" y="11" width="6" height="6" rx="1.3"/><rect x="11" y="11" width="6" height="6" rx="1.3"/></svg>
          </div>
          <div class="empty-state-title">${t('No applications available', 'Aucune application disponible')}</div>
          <p class="empty-state-body">${t('Ask an administrator to grant you access to an application.', "Demande à un administrateur de t'autoriser à accéder à une application.")}</p>
        </div>
      </div>
    ` : html`
      <div class="app-grid fade-in fade-in-1">
        ${opts.apps.map((a) => html`
          <a href="${a.home_url ?? '#'}" class="app-card${a.home_url ? '' : ' is-disabled'}">
            <div class="app-card-head">
              ${a.logo
                ? html`<img src="${a.logo}" alt="" class="app-card-logo"/>`
                : faviconFor(a.home_url)
                  ? html`<span class="app-card-logo-wrap" data-letter="${initial(a.displayName)}"><img src="${faviconFor(a.home_url)!}" alt="" class="app-card-logo"/></span>`
                  : html`<span class="app-card-logo-fallback">${initial(a.displayName)}</span>`}
              <svg class="app-card-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 11l6-6M6 4h5v5"/>
              </svg>
            </div>
            <div class="app-card-name">${a.displayName}</div>
            <div class="app-card-id">${a.id}</div>
          </a>
        `)}
      </div>
    `}
  `;
  return layout({
    title: t('Home', 'Accueil'),
    body,
    user: { username: opts.user.username, role: opts.user.role },
    csrfToken: opts.csrfToken,
    activeSection: 'home',
  });
}

export function profilePage(opts: {
  user: User;
  csrfToken: string;
  flash?: string | null;
  error?: string | null;
}): Raw {
  const u = opts.user;
  const settingsRow = (name: string, help: string | undefined, control: Raw, isFirst = false) => html`
    <div class="settings-row${isFirst ? ' first' : ''}">
      <div class="settings-row-label">
        <div class="settings-row-name">${name}</div>
        ${help ? html`<div class="settings-row-help">${help}</div>` : ''}
      </div>
      <div class="settings-row-control">${control}</div>
    </div>
  `;
  const body = html`
    <div class="page-header fade-in">
      <div>
        <h1 class="page-title">${t('My profile', 'Mon profil')}</h1>
        <p class="page-subtitle">${t('Personal information and password.', 'Informations personnelles et mot de passe.')}</p>
      </div>
    </div>

    ${opts.flash ? html`<div class="alert alert-success fade-in">${opts.flash}</div>` : ''}
    ${opts.error ? html`<div class="alert alert-danger fade-in">${opts.error}</div>` : ''}

    <div class="stack-4 fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/account">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('Update your name and email.', 'Modifie ton nom et ton email.')}</p>
          </div>
          ${settingsRow(t('Username', 'Identifiant'), t('Editable only by an administrator.', 'Modifiable uniquement par un administrateur.'), html`<input type="text" value="${u.username}" disabled/>`, true)}
          ${settingsRow(t('First name', 'Prénom'), undefined, html`<input name="first_name" type="text" value="${u.first_name}"/>`)}
          ${settingsRow(t('Last name', 'Nom'), undefined, html`<input name="last_name" type="text" value="${u.last_name}"/>`)}
          ${settingsRow('Email', t('Required.', 'Requis.'), html`<input name="email" type="email" required value="${u.email ?? ''}"/>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/account/password">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Password', 'Mot de passe')}</h2>
            <p class="sub">${t('Choose a password of at least 12 characters.', "Choisis un mot de passe d'au moins 12 caractères.")}</p>
          </div>
          ${settingsRow(t('Current password', 'Mot de passe actuel'), undefined, html`<input name="current" type="password" autocomplete="current-password" required/>`, true)}
          ${settingsRow(t('New password', 'Nouveau mot de passe'), t('Min 12 characters.', 'Min 12 caractères.'), html`<input name="next" type="password" autocomplete="new-password" required minlength="12"/>`)}
          ${settingsRow(t('Confirmation', 'Confirmation'), undefined, html`<input name="confirm" type="password" autocomplete="new-password" required minlength="12"/>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Change password', 'Changer le mot de passe')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="settings-section-head">
          <h2>${t('Preferences', 'Préférences')}</h2>
          <p class="sub">${t('Display preferences for your account.', "Préférences d'affichage de ton compte.")}</p>
        </div>
        ${settingsRow(t('Language', 'Langue'), undefined, html`
          <form method="POST" action="/language" class="lang-switch">
            <input type="hidden" name="next" value="/account"/>
            <button type="submit" name="lang" value="en" class="lang-btn${getLang() === 'en' ? ' is-active' : ''}">English</button>
            <span class="lang-sep" aria-hidden="true">·</span>
            <button type="submit" name="lang" value="fr" class="lang-btn${getLang() === 'fr' ? ' is-active' : ''}">Français</button>
          </form>
        `, true)}
      </div>
    </div>
  `;
  return layout({
    title: t('Profile', 'Profil'),
    body,
    user: { username: u.username, role: u.role },
    csrfToken: opts.csrfToken,
    activeSection: 'profile',
  });
}

// Also export _ = raw stub used by profile (avoid lint warning unused)
const _unused = raw('');
void _unused;
