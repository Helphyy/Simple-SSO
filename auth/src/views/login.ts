import { html, type Raw } from '../lib/html.js';
import { layout } from './layout.js';
import { Brand } from '../models/branding.js';
import { t } from '../lib/i18n.js';

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function authShell(opts: { title: string; subtitle?: string; body: Raw; clientId?: string | null }): Raw {
  const b = Brand.get(opts.clientId ?? null);
  const hasBg = !!b.background_data_url;

  const head = html`
    <div class="auth-head">
      ${b.logo_data_url
        ? html`<img src="${b.logo_data_url}" alt="" class="auth-logo"/>`
        : html`<span class="auth-logo-fallback">${initial(b.app_name)}</span>`}
      <h1 class="auth-title">${opts.title}</h1>
      ${opts.subtitle ? html`<p class="auth-subtitle">${opts.subtitle}</p>` : ''}
    </div>
  `;

  const inner = html`${head}${opts.body}`;

  const wrap = html`
    <div class="auth-wrap fade-in">
      ${hasBg ? html`<div class="auth-panel">${inner}</div>` : inner}
      ${b.footer_text ? html`<p class="auth-foot">${b.footer_text}</p>` : ''}
    </div>
  `;

  return layout({ title: opts.title, body: wrap, hideNav: true, clientId: opts.clientId ?? null });
}

export function loginPage(opts: {
  error?: string | null;
  flash?: string | null;
  username?: string;
  next?: string;
  csrfToken?: string;
  clientId?: string | null;
}): Raw {
  const b = Brand.get(opts.clientId ?? null);
  const body = html`
    ${opts.flash ? html`<div class="alert alert-success" style="margin-bottom: 18px;">${opts.flash}</div>` : ''}
    ${opts.error ? html`<div class="alert alert-danger" style="margin-bottom: 18px;">${opts.error}</div>` : ''}

    <form method="POST" action="/login" class="stack-4">
      <input type="hidden" name="next" value="${opts.next ?? ''}"/>
      ${opts.csrfToken ? html`<input type="hidden" name="csrf" value="${opts.csrfToken}"/>` : ''}

      <div class="form-field">
        <label class="label">${t('Username', 'Identifiant')}</label>
        <input name="username" type="text" autocomplete="username" required autofocus
               value="${opts.username ?? ''}"
               class="w-full"/>
      </div>
      <div class="form-field">
        <label class="label">${t('Password', 'Mot de passe')}</label>
        <input name="password" type="password" autocomplete="current-password" required
               class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        ${b.login_button_label || t('Sign in', 'Se connecter')}
      </button>
    </form>
  `;
  return authShell({
    title: b.app_name,
    subtitle: b.tagline,
    body,
    clientId: opts.clientId,
  });
}

export function setupPage(opts: {
  error?: string | null;
  csrfToken: string;
  username?: string;
  email?: string;
}): Raw {
  const body = html`
    ${opts.error ? html`<div class="alert alert-danger" style="margin-bottom: 18px;">${opts.error}</div>` : ''}

    <form method="POST" action="/setup" class="stack-4">
      <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
      <div class="form-field">
        <label class="label">${t('Username', 'Identifiant')}</label>
        <input name="username" type="text" required autofocus
               value="${opts.username ?? ''}"
               placeholder="admin"
               class="w-full"/>
        <p class="help-text">${t('Letters, digits, dots, dashes and underscores.', 'Lettres, chiffres, points, tirets et underscores.')}</p>
      </div>
      <div class="form-field">
        <label class="label">Email</label>
        <input name="email" type="email" required value="${opts.email ?? ''}" class="w-full" placeholder="admin@example.com"/>
      </div>
      <div class="form-field">
        <label class="label">${t('Password', 'Mot de passe')}</label>
        <input name="password" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
        <p class="help-text">${t('At least 12 characters, zxcvbn strength 3 or above.', 'Au moins 12 caractères, force zxcvbn ≥ 3.')}</p>
      </div>
      <div class="form-field">
        <label class="label">${t('Confirmation', 'Confirmation')}</label>
        <input name="confirm" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        ${t("Create administrator", "Créer l'administrateur")}
      </button>
    </form>
  `;
  return authShell({
    title: t('First-time setup', 'Premier démarrage'),
    subtitle: t('Create the administrator account to get started.', 'Crée le compte administrateur pour démarrer.'),
    body,
  });
}

export function changePasswordPage(opts: {
  error?: string | null;
  csrfToken: string;
  username: string;
}): Raw {
  const body = html`
    ${opts.error ? html`<div class="alert alert-danger" style="margin-bottom: 18px;">${opts.error}</div>` : ''}

    <form method="POST" action="/change-password" class="stack-4">
      <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
      <div class="form-field">
        <label class="label">${t('Current password', 'Mot de passe actuel')}</label>
        <input name="current" type="password" autocomplete="current-password" required class="w-full"/>
      </div>
      <div class="form-field">
        <label class="label">${t('New password', 'Nouveau mot de passe')}</label>
        <input name="next" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
        <p class="help-text">${t('At least 12 characters.', 'Au moins 12 caractères.')}</p>
      </div>
      <div class="form-field">
        <label class="label">${t('Confirmation', 'Confirmation')}</label>
        <input name="confirm" type="password" autocomplete="new-password" required class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        ${t('Save', 'Enregistrer')}
      </button>
    </form>
  `;
  return authShell({
    title: t('New password', 'Nouveau mot de passe'),
    subtitle: `${opts.username}, ${t('choose your new password.', 'choisis ton nouveau mot de passe.')}`,
    body,
  });
}
