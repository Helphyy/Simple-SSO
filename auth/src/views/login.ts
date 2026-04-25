import { html, type Raw } from '../lib/html.js';
import { layout } from './layout.js';
import { Brand } from '../models/branding.js';

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
        <label class="label">Identifiant</label>
        <input name="username" type="text" autocomplete="username" required autofocus
               value="${opts.username ?? ''}"
               class="w-full"/>
      </div>
      <div class="form-field">
        <label class="label">Mot de passe</label>
        <input name="password" type="password" autocomplete="current-password" required
               class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        ${b.login_button_label || 'Se connecter'}
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
        <label class="label">Identifiant</label>
        <input name="username" type="text" required autofocus
               value="${opts.username ?? ''}"
               placeholder="admin"
               class="w-full"/>
        <p class="help-text">Lettres, chiffres, points, tirets et underscores.</p>
      </div>
      <div class="form-field">
        <label class="label">Email</label>
        <input name="email" type="email" value="${opts.email ?? ''}" class="w-full" placeholder="optionnel"/>
      </div>
      <div class="form-field">
        <label class="label">Mot de passe</label>
        <input name="password" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
        <p class="help-text">Au moins 12 caractères, force zxcvbn ≥ 3.</p>
      </div>
      <div class="form-field">
        <label class="label">Confirmation</label>
        <input name="confirm" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        Créer l'administrateur
      </button>
    </form>
  `;
  return authShell({
    title: 'Premier démarrage',
    subtitle: 'Crée le compte administrateur pour démarrer.',
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
        <label class="label">Mot de passe actuel</label>
        <input name="current" type="password" autocomplete="current-password" required class="w-full"/>
      </div>
      <div class="form-field">
        <label class="label">Nouveau mot de passe</label>
        <input name="next" type="password" autocomplete="new-password" required minlength="12" class="w-full"/>
        <p class="help-text">Au moins 12 caractères.</p>
      </div>
      <div class="form-field">
        <label class="label">Confirmation</label>
        <input name="confirm" type="password" autocomplete="new-password" required class="w-full"/>
      </div>
      <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">
        Enregistrer
      </button>
    </form>
  `;
  return authShell({
    title: 'Nouveau mot de passe',
    subtitle: `${opts.username}, choisis ton nouveau mot de passe.`,
    body,
  });
}
