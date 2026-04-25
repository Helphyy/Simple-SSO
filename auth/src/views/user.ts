import { html, raw, type Raw } from '../lib/html.js';
import { layout } from './layout.js';
import type { OidcClientPublic } from '../models/clients.js';
import type { User } from '../models/users.js';

type AppCard = OidcClientPublic & { logo: string | null; displayName: string };

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function userHubPage(opts: {
  user: User;
  csrfToken: string;
  apps: AppCard[];
}): Raw {
  const greeting = opts.user.first_name ? `Bonjour, ${opts.user.first_name}.` : `Bonjour, ${opts.user.username}.`;

  const body = html`
    <div class="page-header fade-in">
      <div>
        <h1 class="page-title">${greeting}</h1>
        <p class="page-subtitle">${opts.apps.length === 0
          ? 'Aucune application disponible.'
          : opts.apps.length === 1
            ? '1 application accessible.'
            : `${opts.apps.length} applications accessibles.`}</p>
      </div>
    </div>

    ${opts.apps.length === 0 ? html`
      <div class="card fade-in fade-in-1">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="11" y="3" width="6" height="6" rx="1.3"/><rect x="3" y="11" width="6" height="6" rx="1.3"/><rect x="11" y="11" width="6" height="6" rx="1.3"/></svg>
          </div>
          <div class="empty-state-title">Aucune application disponible</div>
          <p class="empty-state-body">Demande à un administrateur de t'autoriser à accéder à une application.</p>
        </div>
      </div>
    ` : html`
      <div class="app-grid fade-in fade-in-1">
        ${opts.apps.map((a) => html`
          <a href="${a.home_url ?? '#'}" class="app-card${a.home_url ? '' : ' is-disabled'}">
            <div class="app-card-head">
              ${a.logo
                ? html`<img src="${a.logo}" alt="" class="app-card-logo"/>`
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
    title: 'Accueil',
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
        <h1 class="page-title">Mon profil</h1>
        <p class="page-subtitle">Informations personnelles et mot de passe.</p>
      </div>
    </div>

    ${opts.flash ? html`<div class="alert alert-success fade-in">${opts.flash}</div>` : ''}
    ${opts.error ? html`<div class="alert alert-danger fade-in">${opts.error}</div>` : ''}

    <div class="stack-4 fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/account">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>Identité</h2>
            <p class="sub">Modifie ton nom et ton email.</p>
          </div>
          ${settingsRow('Identifiant', 'Modifiable uniquement par un administrateur.', html`<input type="text" value="${u.username}" disabled/>`, true)}
          ${settingsRow('Prénom', undefined, html`<input name="first_name" type="text" value="${u.first_name}"/>`)}
          ${settingsRow('Nom', undefined, html`<input name="last_name" type="text" value="${u.last_name}"/>`)}
          ${settingsRow('Email', 'Optionnel.', html`<input name="email" type="email" value="${u.email ?? ''}"/>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">Enregistrer</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/account/password">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>Mot de passe</h2>
            <p class="sub">Choisis un mot de passe d'au moins 12 caractères.</p>
          </div>
          ${settingsRow('Mot de passe actuel', undefined, html`<input name="current" type="password" autocomplete="current-password" required/>`, true)}
          ${settingsRow('Nouveau mot de passe', 'Min 12 caractères.', html`<input name="next" type="password" autocomplete="new-password" required minlength="12"/>`)}
          ${settingsRow('Confirmation', undefined, html`<input name="confirm" type="password" autocomplete="new-password" required minlength="12"/>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">Changer le mot de passe</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({
    title: 'Profil',
    body,
    user: { username: u.username, role: u.role },
    csrfToken: opts.csrfToken,
    activeSection: 'profile',
  });
}

// We need to also export _ = raw stub used by profile (avoid lint warning unused)
const _unused = raw('');
void _unused;
