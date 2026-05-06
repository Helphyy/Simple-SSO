import { html, raw, type Raw } from '../lib/html.js';
import { layout } from './layout.js';
import type { User } from '../models/users.js';
import type { Group } from '../models/groups.js';
import type { OidcClientPublic } from '../models/clients.js';
import type { Branding, ClientBranding } from '../models/branding.js';
import type { Principal } from '../models/access.js';
import type { AppSettings } from '../models/settings.js';
import type { AuditEntry } from '../models/audit.js';
import { t } from '../lib/i18n.js';
import { searchPicker } from './_components.js';

type NavUser = { username: string; role: 'admin' | 'member' };

const card = (body: Raw) => html`
  <div class="card">${body}</div>
`;

const btn = (label: string, extra = '', type: 'primary' | 'danger' | 'ghost' = 'primary') => {
  const cls = type === 'primary' ? 'btn-primary'
    : type === 'danger' ? 'btn-danger'
    : 'btn-ghost';
  return html`<button type="submit" class="${cls} ${extra}">${label}</button>`;
};

const input = (name: string, opts: {
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
  minlength?: number;
  help?: string;
} = { label: name }) => html`
  <div>
    <label class="label" style="margin-bottom: 6px;">${opts.label}</label>
    <input name="${name}" type="${opts.type ?? 'text'}"
           ${opts.value !== undefined ? raw(`value="${escapeAttr(opts.value)}"`) : raw('')}
           ${opts.required ? raw('required') : raw('')}
           ${opts.placeholder ? raw(`placeholder="${escapeAttr(opts.placeholder)}"`) : raw('')}
           ${opts.autocomplete ? raw(`autocomplete="${escapeAttr(opts.autocomplete)}"`) : raw('')}
           ${opts.minlength ? raw(`minlength="${opts.minlength}"`) : raw('')}
           class="w-full"/>
    ${opts.help ? html`<p class="text-xs mt-1.5" style="color: var(--text-faint)">${opts.help}</p>` : ''}
  </div>
`;

const pageHeader = (opts: { title: string; subtitle?: string; action?: Raw }) => html`
  <div class="mb-6 flex items-end justify-between gap-4">
    <div>
      <h1 style="font-size: 1.5rem; line-height: 1.2;">${opts.title}</h1>
      ${opts.subtitle ? html`<p class="text-sm mt-1" style="color: var(--text-muted)">${opts.subtitle}</p>` : ''}
    </div>
    ${opts.action ?? ''}
  </div>
`;

const sectionHeader = (label: string) => html`
  <div class="px-6 pt-5 pb-3">
    <h2>${label}</h2>
  </div>
`;

const alertBanner = (msg: string, kind: 'success' | 'error') => html`
  <div class="alert alert-${kind === 'success' ? 'success' : 'danger'}">${msg}</div>
`;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const colorField = (name: string, label: string, value: string) => html`
  <div class="form-field">
    <label class="label">${label}</label>
    <div class="color-field">
      <input type="color" name="${name}" value="${value}"/>
      <span class="color-hex">${value}</span>
    </div>
  </div>
`;

const rangeField = (name: string, label: string, value: number, suffix = '') => html`
  <div class="form-field">
    <div class="range-field">
      <div class="range-head">
        <label class="label" style="margin: 0;">${label}</label>
        <span class="range-value">${value}${suffix}</span>
      </div>
      <input type="range" name="${name}" min="0" max="100" step="5" value="${String(value)}"
             oninput="this.previousElementSibling.querySelector('.range-value').textContent=this.value+'${suffix}'"/>
    </div>
  </div>
`;

const fileField = (opts: {
  name: string;
  label: string;
  accept: string;
  help: string;
  preview: string | null;
  removeName: string;
  wide?: boolean;
}) => html`
  <div class="form-field">
    <label class="label">${opts.label}</label>
    <div class="file-upload">
      <input type="file" name="${opts.name}" accept="${opts.accept}" class="block w-full"/>
      <p class="help-text">${opts.help}</p>
      ${opts.preview ? html`
        <div class="file-preview">
          <img src="${opts.preview}" alt="" style="${opts.wide ? 'width:64px;height:40px;' : 'width:40px;height:40px;'}"/>
          <label class="remove-toggle">
            <input type="checkbox" name="${opts.removeName}" value="1"/>
            <span>${t('Remove current image', "Retirer l'image actuelle")}</span>
          </label>
        </div>` : ''}
    </div>
  </div>
`;

// ── Dashboard ─────────────────────────────────────────────────────
export function adminDashboardPage(opts: {
  user: NavUser;
  csrfToken: string;
  stats: { users: number; groups: number; clients: number; };
  flash?: string | null;
}): Raw {
  const body = html`
    <div class="fade-in">
      ${pageHeader({ title: t('Dashboard', 'Tableau de bord'), subtitle: t('Overview of Simple SSO.', "Vue d'ensemble de Simple SSO.") })}
    </div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    <div class="stat-grid fade-in fade-in-1">
      ${stat(t('Users', 'Utilisateurs'), opts.stats.users, '/admin/users', userIcon)}
      ${stat(t('Groups', 'Groupes'), opts.stats.groups, '/admin/groups', groupIcon)}
      ${stat(t('Applications', 'Applications'), opts.stats.clients, '/admin/clients', appIcon)}
    </div>
  `;
  return layout({ title: t('Admin', 'Admin'), body, user: opts.user, csrfToken: opts.csrfToken, activeSection: 'admin' });
}

const userIcon = raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5"/></svg>`);
const groupIcon = raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="2.5"/><circle cx="14" cy="8" r="2.5"/><path d="M2 16c0-2.5 2-4 5-4s5 1.5 5 4M10 16c0-2.5 2-4 4.5-4S18 13.5 18 16"/></svg>`);
const appIcon = raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>`);

const stat = (label: string, value: number, href: string, icon: Raw) => html`
  <a href="${href}" class="stat-card">
    <div class="stat-card-head">
      <span class="stat-icon">${icon}</span>
      <span class="stat-label">${label}</span>
    </div>
    <div class="stat-value tabular-nums">${value}</div>
  </a>
`;

// ── Users list ────────────────────────────────────────────────────
export function usersListPage(opts: {
  user: NavUser;
  csrfToken: string;
  users: (User & { groups: string[]; locked?: boolean })[];
  flash?: string | null;
}): Raw {
  const rows = opts.users.map((u) => html`
    <tr>
      <td>
        <div class="cell-primary">
          <span class="avatar-mark" style="width:28px;height:28px;font-size:11px;">${(u.username.trim()[0] ?? '?').toUpperCase()}</span>
          <div class="meta">
            <span class="name">${u.username}</span>
            ${u.email ? html`<div class="sub font-mono">${u.email}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="color: var(--text-muted)">${(u.first_name + ' ' + u.last_name).trim() || ''}</td>
      <td>
        <span class="badge badge-${u.role === 'admin' ? 'admin' : 'member'}">${u.role === 'admin' ? 'Admin' : t('Member', 'Membre')}</span>
      </td>
      <td style="color: var(--text-muted)">${u.groups.join(', ') || ''}</td>
      <td>
        <div class="flex items-center gap-2">
          <span class="status${u.enabled ? '' : ' status-off'}">
            <span class="status-dot"></span>
            <span>${u.enabled ? t('Active', 'Actif') : t('Disabled', 'Désactivé')}</span>
          </span>
          ${u.must_change_password ? html`<span class="badge badge-warning">${t('pw chg', 'chg. mdp')}</span>` : ''}
          ${u.locked ? html`<span class="badge badge-danger">${t('locked', 'bloqué')}</span>` : ''}
        </div>
      </td>
      <td>
        <div class="row-actions">
          <a href="/admin/users/${u.id}" class="btn-ghost btn-sm">${t('Edit', 'Modifier')}</a>
          <form method="POST" action="/admin/users/${u.id}/delete" class="inline"
                onsubmit="return confirm('${t('Delete', 'Supprimer')} ${escapeAttr(u.username)} ?');">
            <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
            <button type="submit" class="btn-ghost btn-ghost-danger btn-sm">${t('Delete', 'Supprimer')}</button>
          </form>
        </div>
      </td>
    </tr>
  `);

  const body = html`
    <div class="fade-in">
      ${pageHeader({
        title: t('Users', 'Utilisateurs'),
        subtitle: `${opts.users.length} ${opts.users.length === 1 ? t('account in total.', 'compte au total.') : t('accounts in total.', 'comptes au total.')}`,
        action: html`<a href="/admin/users/new" class="btn-primary inline-flex items-center gap-1.5">
          <span class="font-mono">+</span><span>${t('New', 'Nouveau')}</span>
        </a>`,
      })}
    </div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    <div class="fade-in fade-in-2">
      ${opts.users.length === 0
        ? html`<div class="card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5"/></svg>
              </div>
              <div class="empty-state-title">${t('No users', 'Aucun utilisateur')}</div>
              <a href="/admin/users/new" class="btn-primary btn-md mt-4 inline-flex items-center gap-1.5"><span class="font-mono">+</span><span>${t('Create an account', 'Créer un compte')}</span></a>
            </div>
          </div>`
        : html`<div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('Username', 'Identifiant')}</th>
                  <th>${t('Name', 'Nom')}</th>
                  <th>${t('Role', 'Rôle')}</th>
                  <th>${t('Groups', 'Groupes')}</th>
                  <th>${t('Status', 'État')}</th>
                  <th>${t('Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
    </div>
  `;
  return layout({ title: t('Users', 'Utilisateurs'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', width: 'wide', activeSection: 'users' });
}

// ── User new/edit ─────────────────────────────────────────────────
export function userNewPage(opts: {
  user: NavUser;
  csrfToken: string;
  groups: Group[];
  error?: string | null;
  formData?: { username?: string; email?: string; first_name?: string; last_name?: string; role?: string };
}): Raw {
  const fd = opts.formData ?? {};
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
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/users" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Users', 'Utilisateurs')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({ title: t('New user', 'Nouvel utilisateur'), subtitle: t('Create an account that can sign in to authorized applications.', 'Crée un compte qui pourra se connecter aux applications autorisées.') })}
    </div>
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}

    <div class="fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/admin/users">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('Username and personal information.', 'Identifiant et informations personnelles.')}</p>
          </div>
          ${settingsRow(t('Username', 'Identifiant'), t('Letters, digits, . _ -', 'Lettres, chiffres, . _ -'), html`<input name="username" type="text" value="${fd.username ?? ''}" required/>`, true)}
          ${settingsRow('Email', t('Required', 'Requis'), html`<input name="email" type="email" required value="${fd.email ?? ''}"/>`)}
          ${settingsRow(t('First name', 'Prénom'), undefined, html`<input name="first_name" type="text" value="${fd.first_name ?? ''}"/>`)}
          ${settingsRow(t('Last name', 'Nom'), undefined, html`<input name="last_name" type="text" value="${fd.last_name ?? ''}"/>`)}

          <div class="settings-section-head">
            <h2>${t('Initial password', 'Mot de passe initial')}</h2>
            <p class="sub">${t('The user will be prompted to change it on first sign-in.', "L'utilisateur sera invité à le changer à la première connexion.")}</p>
          </div>
          ${settingsRow(t('Password', 'Mot de passe'), t('Min 12 characters, zxcvbn strength 3 or above.', 'Min 12 caractères, force zxcvbn ≥ 3.'), html`<input name="password" type="password" required minlength="12"/>`, true)}
          ${settingsRow(t('Change required', 'Changement requis'), undefined, html`<label class="check-row" style="margin: 0;"><input type="checkbox" name="must_change_password" value="1" checked/><div class="meta"><div class="name">${t('Require a change at next sign-in', 'Exiger un changement à la prochaine connexion')}</div></div></label>`)}

          <div class="settings-section-head">
            <h2>${t('Role and groups', 'Rôle et groupes')}</h2>
            <p class="sub">${t('Controls permissions and access to applications.', "Détermine les permissions et l'accès aux applications.")}</p>
          </div>
          ${settingsRow(t('Role', 'Rôle'), undefined, html`
            <select name="role">
              <option value="member"${fd.role === 'member' ? raw(' selected') : raw('')}>${t('Member', 'Membre')}</option>
              <option value="admin"${fd.role === 'admin' ? raw(' selected') : raw('')}>Admin</option>
            </select>
          `, true)}
          ${opts.groups.length ? settingsRow(t('Groups', 'Groupes'), undefined, searchPicker({
            name: 'groups',
            items: opts.groups.map((g) => ({ id: g.id, label: g.name, sub: g.description })),
            selected: new Set<string>(),
            placeholder: t('Search a group…', 'Rechercher un groupe…'),
            emptyLabel: t('No group selected.', 'Aucun groupe sélectionné.'),
          })) : ''}

          <div class="form-actions">
            <a href="/admin/users" class="btn-ghost btn-md">${t('Cancel', 'Annuler')}</a>
            <button type="submit" class="btn-primary btn-md">${t('Create', 'Créer')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({ title: t('New user', 'Nouvel utilisateur'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'users' });
}

export function userEditPage(opts: {
  user: NavUser;
  csrfToken: string;
  target: User;
  allGroups: Group[];
  memberGroupIds: Set<string>;
  locked?: boolean;
  error?: string | null;
  flash?: string | null;
}): Raw {
  const tg = opts.target;
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
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/users" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Users', 'Utilisateurs')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({
        title: tg.username,
        subtitle: tg.email ?? t('No email', 'Sans email'),
      })}
    </div>

    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}

    ${opts.locked ? html`
      <div class="fade-in fade-in-1" style="max-width: 720px; margin-bottom: 16px;">
        <div class="alert alert-warning" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span>${t('This account is', 'Ce compte est')} <strong>${t('locked', 'bloqué')}</strong> ${t('after repeated failed sign-in attempts.', 'suite à des tentatives de connexion répétées.')}</span>
          <form method="POST" action="/admin/users/${tg.id}/unlock" class="inline">
            <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
            <button type="submit" class="btn-ghost btn-sm">${t('Unlock', 'Déverrouiller')}</button>
          </form>
        </div>
      </div>
    ` : ''}

    <div class="fade-in fade-in-1 stack-4">
      <div class="card">
        <form method="POST" action="/admin/users/${tg.id}">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Information', 'Informations')}</h2>
            <p class="sub">${t('Username, contact and activation.', 'Identifiant, contact et activation.')}</p>
          </div>
          ${settingsRow(t('Username', 'Identifiant'), t('Letters, digits, . _ -', 'Lettres, chiffres, . _ -'), html`<input name="username" type="text" value="${tg.username}" required/>`, true)}
          ${settingsRow('Email', t('Required', 'Requis'), html`<input name="email" type="email" required value="${tg.email ?? ''}"/>`)}
          ${settingsRow(t('First name', 'Prénom'), undefined, html`<input name="first_name" type="text" value="${tg.first_name}"/>`)}
          ${settingsRow(t('Last name', 'Nom'), undefined, html`<input name="last_name" type="text" value="${tg.last_name}"/>`)}
          ${settingsRow(t('Role', 'Rôle'), undefined, html`
            <select name="role">
              <option value="member"${tg.role === 'member' ? raw(' selected') : raw('')}>${t('Member', 'Membre')}</option>
              <option value="admin"${tg.role === 'admin' ? raw(' selected') : raw('')}>Admin</option>
            </select>
          `)}
          ${settingsRow(t('Account enabled', 'Compte activé'), undefined, html`<label class="check-row" style="margin: 0;"><input type="checkbox" name="enabled" value="1"${tg.enabled ? raw(' checked') : raw('')}/><div class="meta"><div class="name">${t('Enable the account', 'Activer le compte')}</div><div class="sub">${t('Uncheck to invalidate all sessions.', 'Décocher pour bloquer toutes les sessions.')}</div></div></label>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/admin/users/${tg.id}/groups">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Groups', 'Groupes')}</h2>
            <p class="sub">${t('Adjust group memberships.', 'Ajustement des appartenances aux groupes.')}</p>
          </div>
          ${opts.allGroups.length === 0
            ? html`<div style="padding: 0 24px 20px;"><p class="help-text">${t('No groups.', 'Aucun groupe.')} <a href="/admin/groups" style="color: var(--text); text-decoration: underline;">${t('Create one →', 'En créer un →')}</a></p></div>`
            : settingsRow(t('Member of', 'Membre de'), undefined, searchPicker({
                name: 'groups',
                items: opts.allGroups.map((g) => ({ id: g.id, label: g.name, sub: g.description })),
                selected: opts.memberGroupIds,
                placeholder: t('Search a group…', 'Rechercher un groupe…'),
                emptyLabel: t('Not a member of any group.', "Membre d'aucun groupe."),
              }), true)}
          ${opts.allGroups.length ? html`
            <div class="form-actions">
              <button type="submit" class="btn-primary btn-md">${t('Update', 'Mettre à jour')}</button>
            </div>
          ` : ''}
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/admin/users/${tg.id}/password">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Reset password', 'Réinitialiser le mot de passe')}</h2>
            <p class="sub">${t('All active sessions will be invalidated.', 'Toutes les sessions actives seront invalidées.')}</p>
          </div>
          ${settingsRow(t('New password', 'Nouveau mot de passe'), t('Min 12 characters.', 'Min 12 caractères.'), html`<input name="password" type="password" required minlength="12"/>`, true)}
          ${settingsRow(t('Change required', 'Changement requis'), undefined, html`<label class="check-row" style="margin: 0;"><input type="checkbox" name="must_change_password" value="1" checked/><div class="meta"><div class="name">${t('Require a change at next sign-in', 'Exiger un changement à la prochaine connexion')}</div></div></label>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Reset', 'Réinitialiser')}</button>
          </div>
        </form>
      </div>

      <div class="card card-danger">
        <div class="danger-section">
          <h2>${t('Delete account', 'Supprimer le compte')}</h2>
          <p>${t('This action is irreversible. All sessions, access and group memberships are revoked.', 'Cette action est irréversible. Toutes les sessions, accès et appartenances aux groupes sont révoqués.')}</p>
          <form method="POST" action="/admin/users/${tg.id}/delete" class="inline"
                onsubmit="return confirm('${t('Permanently delete', 'Supprimer définitivement')} ${escapeAttr(tg.username)} ?');">
            <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
            <button type="submit" class="btn-danger btn-md">${t('Delete permanently', 'Supprimer définitivement')}</button>
          </form>
        </div>
      </div>
    </div>
  `;
  return layout({ title: tg.username, body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'users' });
}

// ── Groups ────────────────────────────────────────────────────────
export function groupsListPage(opts: {
  user: NavUser;
  csrfToken: string;
  groups: (Group & { members: number })[];
  flash?: string | null;
  error?: string | null;
}): Raw {
  const body = html`
    <div class="fade-in">
      ${pageHeader({ title: t('Groups', 'Groupes'), subtitle: t('Group users together to manage access to applications.', "Regroupe des utilisateurs pour gérer l'accès aux applications.") })}
    </div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}
    <div class="fade-in fade-in-1 stack-4">
      <div class="card">
        <form method="POST" action="/admin/groups">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('New group', 'Nouveau groupe')}</h2>
            <p class="sub">${t('Groups bundle users together to grant collective access.', 'Les groupes regroupent des utilisateurs pour leur accorder un accès collectif.')}</p>
          </div>
          <div class="settings-row first">
            <div class="settings-row-label">
              <div class="settings-row-name">${t('Name', 'Nom')}</div>
              <div class="settings-row-help">${t('Letters, digits, . _ -', 'Lettres, chiffres, . _ -')}</div>
            </div>
            <div class="settings-row-control">
              <input name="name" type="text" required placeholder="wiki-users"/>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <div class="settings-row-name">${t('Description', 'Description')}</div>
            </div>
            <div class="settings-row-control">
              <input name="description" type="text"/>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Create', 'Créer')}</button>
          </div>
        </form>
      </div>

      ${opts.groups.length === 0
        ? html`<div class="card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="2.5"/><circle cx="14" cy="8" r="2.5"/><path d="M2 16c0-2.3 2-4 5-4s5 1.7 5 4M10 16c0-2.3 2-4 4.5-4S18 13.7 18 16"/></svg>
              </div>
              <div class="empty-state-title">${t('No groups', 'Aucun groupe')}</div>
              <p class="empty-state-body">${t('Use the form above to create the first one.', 'Utilise le formulaire ci-dessus pour créer le premier.')}</p>
            </div>
          </div>`
        : html`<div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('Group', 'Groupe')}</th>
                  <th>${t('Members', 'Membres')}</th>
                  <th>${t('Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${opts.groups.map((g) => html`
                  <tr>
                    <td>
                      <div class="meta">
                        <div class="name">${g.name}</div>
                        ${g.description ? html`<div class="sub">${g.description}</div>` : ''}
                      </div>
                    </td>
                    <td style="color: var(--text-muted)">${g.members}</td>
                    <td>
                      <div class="row-actions">
                        <a href="/admin/groups/${g.id}" class="btn-ghost btn-sm">${t('Edit', 'Modifier')}</a>
                        <form method="POST" action="/admin/groups/${g.id}/delete" class="inline"
                              onsubmit="return confirm('${t('Delete group', 'Supprimer le groupe')} ${escapeAttr(g.name)} ?');">
                          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
                          <button type="submit" class="btn-ghost btn-ghost-danger btn-sm">${t('Delete', 'Supprimer')}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>`}
    </div>
  `;
  return layout({ title: t('Groups', 'Groupes'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', width: 'wide', activeSection: 'groups' });
}

// ── Group edit (rename / description / members / delete) ─────────
export function groupEditPage(opts: {
  user: NavUser;
  csrfToken: string;
  group: Group;
  allUsers: User[];
  memberUserIds: Set<string>;
  flash?: string | null;
  error?: string | null;
  formData?: { name?: string; description?: string };
}): Raw {
  const g = opts.group;
  const fd = opts.formData ?? {};
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
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/groups" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Groups', 'Groupes')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({ title: g.name, subtitle: g.description || undefined })}
    </div>

    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}

    <div class="fade-in fade-in-1 stack-4">
      <div class="card">
        <form method="POST" action="/admin/groups/${g.id}">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
          </div>
          ${settingsRow(t('Name', 'Nom'), t('Letters, digits, . _ -', 'Lettres, chiffres, . _ -'), html`<input name="name" type="text" value="${fd.name ?? g.name}" required/>`, true)}
          ${settingsRow(t('Description', 'Description'), undefined, html`<input name="description" type="text" value="${fd.description ?? g.description}"/>`)}
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/admin/groups/${g.id}/members">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Members', 'Membres')}</h2>
            <p class="sub">${t('Add or remove users in this group.', 'Ajoute ou retire des utilisateurs dans ce groupe.')}</p>
          </div>
          ${opts.allUsers.length === 0
            ? html`<div style="padding: 0 24px 20px;"><p class="help-text">${t('No users.', 'Aucun utilisateur.')}</p></div>`
            : settingsRow(t('Members', 'Membres'), undefined, searchPicker({
                name: 'users',
                items: opts.allUsers.map((u) => ({ id: u.id, label: u.username, sub: u.email ?? undefined })),
                selected: opts.memberUserIds,
                placeholder: t('Search a user…', 'Rechercher un utilisateur…'),
                emptyLabel: t('No member yet.', 'Aucun membre.'),
                noOptionsLabel: t('No user available.', 'Aucun utilisateur disponible.'),
              }), true)}
          ${opts.allUsers.length ? html`
            <div class="form-actions">
              <button type="submit" class="btn-primary btn-md">${t('Save members', 'Enregistrer les membres')}</button>
            </div>
          ` : ''}
        </form>
      </div>

      <div class="card card-danger">
        <div class="danger-section">
          <h2>${t('Delete group', 'Supprimer le groupe')}</h2>
          <p>${t('Removes the group. Users keep their other memberships.', 'Retire le groupe. Les utilisateurs conservent leurs autres appartenances.')}</p>
          <form method="POST" action="/admin/groups/${g.id}/delete" class="inline"
                onsubmit="return confirm('${t('Delete group', 'Supprimer le groupe')} ${escapeAttr(g.name)} ?');">
            <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
            <button type="submit" class="btn-danger btn-md">${t('Delete permanently', 'Supprimer définitivement')}</button>
          </form>
        </div>
      </div>
    </div>
  `;
  return layout({ title: g.name, body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'groups' });
}

// ── Client secret display (after creation) ────────────────────────
export function clientSecretPage(opts: {
  user: NavUser;
  csrfToken: string;
  id: string;
  secret: string;
}): Raw {
  const body = html`
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/clients" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Applications', 'Applications')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({
        title: t('Application created', 'Application créée'),
        subtitle: t('Copy the client secret immediately, it will never be shown again.', 'Copie le client secret immédiatement, il ne sera plus jamais affiché.'),
      })}
    </div>

    <div class="fade-in fade-in-1">
      <div class="alert alert-warning" style="margin-bottom: 16px;">
        <strong>${t('The secret is shown only once.', 'Le secret est affiché une seule fois.')}</strong> ${t('Store it in a password manager or in the application configuration before leaving this page.', "Stocke-le dans un gestionnaire de mots de passe ou dans la configuration de l'application avant de quitter cette page.")}
      </div>
      <div class="card">
        <div class="settings-section-head">
          <h2>${t('Credentials', 'Identifiants')}</h2>
          <p class="sub">${t('Copy these values into the application configuration.', "Copie ces valeurs dans la configuration de l'application.")}</p>
        </div>
        <div class="settings-row first">
          <div class="settings-row-label">
            <div class="settings-row-name">Client ID</div>
          </div>
          <div class="settings-row-control wide">
            <code class="secret-value">${opts.id}</code>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">
            <div class="settings-row-name">Client Secret</div>
            <div class="settings-row-help">${t('Shown only once.', 'Affiché une seule fois.')}</div>
          </div>
          <div class="settings-row-control wide">
            <code class="secret-value">${opts.secret}</code>
          </div>
        </div>
        <div class="form-actions">
          <a href="/admin/clients/${opts.id}" class="btn-ghost btn-md">${t('Configure access', "Configurer l'accès")}</a>
          <a href="/admin/clients" class="btn-primary btn-md">${t('Back to applications', 'Retour aux applications')}</a>
        </div>
      </div>
    </div>
  `;
  return layout({ title: t('Application created', 'Application créée'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'clients' });
}

// ── Clients (OIDC apps) ───────────────────────────────────────────
export function clientsListPage(opts: {
  user: NavUser;
  csrfToken: string;
  clients: OidcClientPublic[];
  flash?: string | null;
}): Raw {
  const body = html`
    <div class="fade-in">
      ${pageHeader({
        title: t('Applications', 'Applications'),
        subtitle: t('OIDC clients allowed to sign in via Simple SSO.', 'Clients OIDC autorisés à se connecter via Simple SSO.'),
        action: html`<a href="/admin/clients/new" class="btn-primary inline-flex items-center gap-1.5">
          <span class="font-mono">+</span><span>${t('New', 'Nouvelle')}</span>
        </a>`,
      })}
    </div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    <div class="fade-in fade-in-2">
      ${opts.clients.length === 0
        ? html`<div class="card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="11" y="3" width="6" height="6" rx="1.3"/><rect x="3" y="11" width="6" height="6" rx="1.3"/><rect x="11" y="11" width="6" height="6" rx="1.3"/></svg>
              </div>
              <div class="empty-state-title">${t('No applications', 'Aucune application')}</div>
              <p class="empty-state-body">${t('Declare an OIDC application so it can sign in via Simple SSO.', "Déclare une application OIDC pour qu'elle puisse se connecter via Simple SSO.")}</p>
              <a href="/admin/clients/new" class="btn-primary btn-md mt-4 inline-flex items-center gap-1.5"><span class="font-mono">+</span><span>${t('Create the first one', 'Créer la première')}</span></a>
            </div>
          </div>`
        : html`<div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('Application', 'Application')}</th>
                  <th>Redirect URI</th>
                  <th class="text-right">${t('Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${opts.clients.map((c) => html`
                  <tr>
                    <td>
                      <div class="cell-primary">
                        <span class="avatar-mark" style="width:32px;height:32px;font-size:13px;">${(c.name.trim()[0] ?? '?').toUpperCase()}</span>
                        <div class="meta">
                          <a href="/admin/clients/${c.id}" class="name" style="text-decoration: none;">${c.name}</a>
                          <code class="sub font-mono">${c.id}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code class="font-mono text-xs" style="color: var(--text-muted)">${c.redirect_uris[0] ?? ''}</code>
                    </td>
                    <td>
                      <div class="row-actions">
                        <a href="/admin/clients/${c.id}" class="btn-ghost btn-sm">${t('Edit', 'Modifier')}</a>
                        <a href="/admin/clients/${c.id}/branding" class="btn-ghost btn-sm">${t('Appearance', 'Apparence')}</a>
                        <form method="POST" action="/admin/clients/${c.id}/delete" class="inline"
                              onsubmit="return confirm('${t('Delete', 'Supprimer')} ${escapeAttr(c.name)} ?');">
                          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
                          <button type="submit" class="btn-ghost btn-ghost-danger btn-sm">${t('Delete', 'Supprimer')}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>`}
    </div>
  `;
  return layout({ title: t('Applications', 'Applications'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', width: 'wide', activeSection: 'clients' });
}

export function clientNewPage(opts: {
  user: NavUser;
  csrfToken: string;
  error?: string | null;
  formData?: { id?: string; name?: string; home_url?: string; redirect_uris?: string; post_logout_uris?: string };
}): Raw {
  const fd = opts.formData ?? {};
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
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/clients" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Applications', 'Applications')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({ title: t('New application', 'Nouvelle application'), subtitle: t('Declare an OIDC client so it can sign in via Simple SSO.', "Déclare un client OIDC pour qu'il puisse se connecter via Simple SSO.") })}
    </div>
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}
    <div class="fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/admin/clients" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('How this application appears to users.', "Apparence de l'application pour les utilisateurs.")}</p>
          </div>
          ${settingsRow('Client ID', t('Technical identifier, immutable.', 'Identifiant technique, immutable.'), html`<input name="id" type="text" value="${fd.id ?? ''}" required placeholder="outline"/>`, true)}
          ${settingsRow(t('Display name', 'Nom affiché'), undefined, html`<input name="name" type="text" value="${fd.name ?? ''}" required placeholder="Outline"/>`)}
          ${settingsRow(t('Custom logo', 'Logo personnalisé'), t('PNG / SVG / JPEG, max 10 MB. Falls back to the favicon of the home URL.', 'PNG / SVG / JPEG, max 10 Mo. À défaut, le favicon de la home URL est utilisé.'), html`<input type="file" name="logo" accept="image/png,image/svg+xml,image/jpeg"/>`)}
          ${settingsRow(t('Home URL', "URL d'accueil"), t('Where the icon on the user hub leads. Empty = derived from the redirect URI.', "Cible de l'icône depuis le hub utilisateur. Vide = déduite du redirect URI."), html`<input name="home_url" type="url" value="${fd.home_url ?? ''}" placeholder="https://wiki.example.com"/>`)}

          <div class="settings-section-head">
            <h2>${t('OIDC URLs', 'URLs OIDC')}</h2>
            <p class="sub">${t('URLs the client may be redirected to.', 'URLs vers lesquelles le client peut être redirigé.')}</p>
          </div>
          ${settingsRow('Redirect URIs', t('One URL per line.', 'Une URL par ligne.'), html`<textarea name="redirect_uris" required rows="3" class="font-mono" placeholder="https://docs.example.com/auth/oidc.callback&#10;http://localhost:3000/auth/oidc.callback">${fd.redirect_uris ?? ''}</textarea>`, true)}
          ${settingsRow('Post Logout URIs', t('Optional.', 'Optionnel.'), html`<textarea name="post_logout_uris" rows="2" class="font-mono">${fd.post_logout_uris ?? ''}</textarea>`)}

          <div class="form-actions">
            <a href="/admin/clients" class="btn-ghost btn-md">${t('Cancel', 'Annuler')}</a>
            <button type="submit" class="btn-primary btn-md">${t('Create application', "Créer l'application")}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({ title: t('New application', 'Nouvelle application'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'clients' });
}

// ── Client edit (unified: identity + URLs + access + secret + delete)
export function clientEditPage(opts: {
  user: NavUser;
  csrfToken: string;
  client: OidcClientPublic;
  allUsers: User[];
  allGroups: Group[];
  selectedUsers: Set<string>;
  selectedGroups: Set<string>;
  logoDataUrl: string | null;
  flash?: string | null;
  error?: string | null;
  formData?: { name?: string; redirect_uris?: string; post_logout_uris?: string; home_url?: string };
}): Raw {
  const c = opts.client;
  const fd = opts.formData ?? {};
  const restricted = opts.selectedUsers.size + opts.selectedGroups.size > 0;
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
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/clients" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Applications', 'Applications')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({
        title: c.name,
        subtitle: c.id,
        action: html`<a href="/admin/clients/${c.id}/branding" class="btn-ghost btn-md">${t('Appearance', 'Apparence')}</a>`,
      })}
    </div>

    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}

    <div class="fade-in fade-in-1 stack-4">
      <div class="card">
        <form method="POST" action="/admin/clients/${c.id}" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('How this application appears to users.', "Apparence de l'application pour les utilisateurs.")}</p>
          </div>
          ${settingsRow('Client ID', t('Technical identifier, immutable.', 'Identifiant technique, immutable.'), html`<input type="text" value="${c.id}" disabled class="font-mono"/>`, true)}
          ${settingsRow(t('Display name', 'Nom affiché'), undefined, html`<input name="name" type="text" value="${fd.name ?? c.name}" required/>`)}
          ${settingsRow(t('Custom logo', 'Logo personnalisé'), t('PNG / SVG / JPEG, max 10 MB. Falls back to the favicon of the home URL.', 'PNG / SVG / JPEG, max 10 Mo. À défaut, le favicon de la home URL est utilisé.'), html`
            <div>
              <input type="file" name="logo" accept="image/png,image/svg+xml,image/jpeg"/>
              ${opts.logoDataUrl ? html`
                <div class="file-preview" style="margin-top: 8px;">
                  <img src="${opts.logoDataUrl}" alt="" style="width:40px;height:40px;"/>
                  <label class="remove-toggle">
                    <input type="checkbox" name="remove_logo" value="1"/>
                    <span>${t('Remove current logo', 'Retirer le logo actuel')}</span>
                  </label>
                </div>` : ''}
            </div>`)}
          ${settingsRow(t('Home URL', "URL d'accueil"), t('Where the icon on the user hub leads. Empty = derived from the redirect URI.', "Cible de l'icône depuis le hub utilisateur. Vide = déduite du redirect URI."), html`<input name="home_url" type="url" value="${fd.home_url ?? (c.home_url ?? '')}" placeholder="https://wiki.example.com"/>`)}

          <div class="settings-section-head">
            <h2>${t('OIDC URLs', 'URLs OIDC')}</h2>
            <p class="sub">${t('URLs the client may be redirected to.', 'URLs vers lesquelles le client peut être redirigé.')}</p>
          </div>
          ${settingsRow('Redirect URIs', t('One URL per line.', 'Une URL par ligne.'), html`<textarea name="redirect_uris" required rows="3" class="font-mono">${fd.redirect_uris ?? c.redirect_uris.join('\n')}</textarea>`, true)}
          ${settingsRow('Post Logout URIs', t('Optional.', 'Optionnel.'), html`<textarea name="post_logout_uris" rows="2" class="font-mono">${fd.post_logout_uris ?? c.post_logout_uris.join('\n')}</textarea>`)}

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/admin/clients/${c.id}/access">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Access', 'Accès')}</h2>
            <p class="sub">${restricted
              ? t('Application restricted to the selected users and groups.', 'Application restreinte aux utilisateurs et groupes sélectionnés.')
              : t('No restriction: any authenticated user may access.', 'Aucune restriction : tout utilisateur authentifié peut accéder.')}</p>
          </div>

          ${settingsRow(t('Allowed groups', 'Groupes autorisés'), opts.allGroups.length === 0
              ? t('No groups defined yet.', 'Aucun groupe défini.')
              : t('All members of these groups will have access.', 'Tous les membres de ces groupes auront accès.'),
            opts.allGroups.length === 0
              ? html`<p class="help-text">${t('Create a group from', 'Crée un groupe depuis')} <a href="/admin/groups" style="color: var(--text); text-decoration: underline;">${t('Groups', 'Groupes')}</a>.</p>`
              : searchPicker({
                  name: 'groups',
                  items: opts.allGroups.map((g) => ({ id: g.id, label: g.name, sub: g.description })),
                  selected: opts.selectedGroups,
                  placeholder: t('Search a group…', 'Rechercher un groupe…'),
                  emptyLabel: t('No group selected.', 'Aucun groupe sélectionné.'),
                }),
            true)}

          ${settingsRow(t('Allowed users', 'Utilisateurs autorisés'), t('In addition to the groups above.', 'En plus des groupes ci-dessus.'),
            opts.allUsers.length === 0
              ? html`<p class="help-text">${t('No users.', 'Aucun utilisateur.')}</p>`
              : searchPicker({
                  name: 'users',
                  items: opts.allUsers.map((u) => ({ id: u.id, label: u.username, sub: u.email ?? undefined })),
                  selected: opts.selectedUsers,
                  placeholder: t('Search a user…', 'Rechercher un utilisateur…'),
                  emptyLabel: t('No user selected.', 'Aucun utilisateur sélectionné.'),
                  noOptionsLabel: t('No user available.', 'Aucun utilisateur disponible.'),
                }))}

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save access', 'Enregistrer les accès')}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/admin/clients/${c.id}/rotate-secret"
              onsubmit="return confirm('${t('Rotate the client secret? Any integration using the current secret will stop working until updated.', 'Renouveler le client secret ? Toute integration utilisant le secret actuel cessera de fonctionner avant la mise a jour.')}');">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
          <div class="settings-section-head">
            <h2>${t('Client secret', 'Client secret')}</h2>
            <p class="sub">${t('Rotate the secret if you suspect it leaked. The new value is shown only once.', 'Renouvelle le secret en cas de fuite suspectée. La nouvelle valeur est affichée une seule fois.')}</p>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-ghost btn-md">${t('Rotate secret', 'Renouveler le secret')}</button>
          </div>
        </form>
      </div>

      <div class="card card-danger">
        <div class="danger-section">
          <h2>${t('Delete application', "Supprimer l'application")}</h2>
          <p>${t('Removes the OIDC client and all its access rules. Irreversible.', "Retire le client OIDC et toutes ses règles d'accès. Irréversible.")}</p>
          <form method="POST" action="/admin/clients/${c.id}/delete" class="inline"
                onsubmit="return confirm('${t('Delete', 'Supprimer')} ${escapeAttr(c.name)} ?');">
            <input type="hidden" name="csrf" value="${opts.csrfToken}"/>
            <button type="submit" class="btn-danger btn-md">${t('Delete permanently', 'Supprimer définitivement')}</button>
          </form>
        </div>
      </div>
    </div>
  `;
  return layout({ title: c.name, body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'clients' });
}

// ── Per-client branding ───────────────────────────────────────────
export function clientBrandingPage(opts: {
  user: NavUser;
  csrfToken: string;
  client: OidcClientPublic;
  branding: ClientBranding;
  flash?: string | null;
  error?: string | null;
}): Raw {
  const b = opts.branding;
  const settingsRow = (name: string, help: string | undefined, control: Raw, isFirst = false) => html`
    <div class="settings-row${isFirst ? ' first' : ''}">
      <div class="settings-row-label">
        <div class="settings-row-name">${name}</div>
        ${help ? html`<div class="settings-row-help">${help}</div>` : ''}
      </div>
      <div class="settings-row-control">${control}</div>
    </div>
  `;
  const colorCtrl = (name: string, value: string) => html`<div class="color-field"><input type="color" name="${name}" value="${value}"/><span class="color-hex">${value}</span></div>`;
  const fileCtrl = (name: string, accept: string, preview: string | null, removeName: string, wide = false) => html`
    <div>
      <input type="file" name="${name}" accept="${accept}"/>
      ${preview ? html`
        <div class="file-preview" style="margin-top: 8px;">
          <img src="${preview}" alt="" style="${wide ? 'width:64px;height:40px;' : 'width:40px;height:40px;'}"/>
          <label class="remove-toggle">
            <input type="checkbox" name="${removeName}" value="1"/>
            <span>${t('Remove current image', "Retirer l'image actuelle")}</span>
          </label>
        </div>` : ''}
    </div>
  `;
  const body = html`
    <div class="fade-in" style="margin-bottom: 12px;">
      <a href="/admin/clients" class="btn-link">
        <svg style="width: 12px; height: 12px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>
        <span>${t('Applications', 'Applications')}</span>
      </a>
    </div>
    <div class="fade-in">
      ${pageHeader({
        title: `${t('Appearance', 'Apparence')} ${opts.client.name}`,
        subtitle: t('Override the global branding for this application. Empty fields = global values.', 'Surcharge le branding global pour cette application. Champs vides = valeurs globales.'),
      })}
    </div>

    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}

    <div class="fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/admin/clients/${opts.client.id}/branding" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('Customize the name and colors for this app.', 'Personnalise le nom et les couleurs pour cette app.')}</p>
          </div>
          ${settingsRow(t('Display name', 'Nom affiché'), undefined, html`<input name="app_name" type="text" value="${b.app_name ?? ''}" placeholder="(global)"/>`, true)}
          ${settingsRow(t('Tagline', 'Sous-titre'), undefined, html`<input name="tagline" type="text" value="${b.tagline ?? ''}" placeholder="(global)"/>`)}
          ${settingsRow(t('Primary color', 'Couleur principale'), undefined, colorCtrl('primary_color', b.primary_color ?? '#0f172a'))}
          ${settingsRow(t('Accent color', "Couleur d'accent"), undefined, colorCtrl('accent_color', b.accent_color ?? '#2563eb'))}
          ${settingsRow('Logo', t('PNG / SVG / JPEG, max 10 MB. Empty = global logo.', 'PNG / SVG / JPEG, max 10 Mo. Vide = logo global.'), fileCtrl('logo', 'image/png,image/svg+xml,image/jpeg', b.logo_data_url, 'remove_logo'))}

          <div class="settings-section-head">
            <h2>${t('Background', 'Arrière-plan')}</h2>
            <p class="sub">${t('Image shown behind the sign-in form.', 'Image affichée derrière le formulaire de connexion.')}</p>
          </div>
          ${settingsRow(t('Background image', 'Image de fond'), t('PNG / JPEG / WebP, max 10 MB.', 'PNG / JPEG / WebP, max 10 Mo.'), fileCtrl('background', 'image/png,image/jpeg,image/webp', b.background_data_url, 'remove_background', true), true)}
          ${settingsRow(`${t('Background opacity', 'Opacité du fond')}${b.background_opacity === null ? ' (global)' : ''}`, undefined, html`
            <div class="range-field">
              <div class="range-head">
                <span class="range-value">${String(b.background_opacity ?? 100)}%</span>
              </div>
              <input type="range" name="background_opacity" min="0" max="100" step="5" value="${String(b.background_opacity ?? 100)}"
                     oninput="this.previousElementSibling.querySelector('.range-value').textContent=this.value+'%'"/>
            </div>
          `)}

          <div class="settings-section-head">
            <h2>${t('Texts', 'Textes')}</h2>
            <p class="sub">${t('Overrides for the texts shown at login.', 'Surcharges des textes affichés au login.')}</p>
          </div>
          ${settingsRow(t('Sign-in button label', 'Libellé du bouton de connexion'), undefined, html`<input name="login_button_label" type="text" value="${b.login_button_label ?? ''}" placeholder="(global)"/>`, true)}
          ${settingsRow(t('Footer text', 'Texte de pied de page'), undefined, html`<input name="footer_text" type="text" value="${b.footer_text ?? ''}" placeholder="(global)"/>`)}

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({ title: `${t('Appearance', 'Apparence')} ${opts.client.name}`, body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'clients' });
}

// ── Branding ──────────────────────────────────────────────────────
export function brandingPage(opts: {
  user: NavUser;
  csrfToken: string;
  branding: Branding;
  flash?: string | null;
  error?: string | null;
}): Raw {
  const b = opts.branding;
  const settingsRow = (name: string, help: string | undefined, control: Raw, isFirst = false) => html`
    <div class="settings-row${isFirst ? ' first' : ''}">
      <div class="settings-row-label">
        <div class="settings-row-name">${name}</div>
        ${help ? html`<div class="settings-row-help">${help}</div>` : ''}
      </div>
      <div class="settings-row-control">${control}</div>
    </div>
  `;
  const colorCtrl = (name: string, value: string) => html`<div class="color-field"><input type="color" name="${name}" value="${value}"/><span class="color-hex">${value}</span></div>`;
  const fileCtrl = (name: string, accept: string, preview: string | null, removeName: string, wide = false) => html`
    <div>
      <input type="file" name="${name}" accept="${accept}"/>
      ${preview ? html`
        <div class="file-preview" style="margin-top: 8px;">
          <img src="${preview}" alt="" style="${wide ? 'width:64px;height:40px;' : 'width:40px;height:40px;'}"/>
          <label class="remove-toggle">
            <input type="checkbox" name="${removeName}" value="1"/>
            <span>${t('Remove current image', "Retirer l'image actuelle")}</span>
          </label>
        </div>` : ''}
    </div>
  `;
  const body = html`
    <div class="fade-in">
      ${pageHeader({ title: t('Appearance', 'Apparence'), subtitle: t('Global visual identity. Each application can override these values.', 'Identité visuelle globale. Chaque application peut surcharger ces valeurs.') })}
    </div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    ${opts.error ? html`<div class="fade-in fade-in-1"><div class="alert alert-danger">${opts.error}</div></div>` : ''}
    <div class="fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/admin/branding" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('Identity', 'Identité')}</h2>
            <p class="sub">${t('Name and tagline shown on the sign-in screen.', "Nom et sous-titre affichés sur l'écran de connexion.")}</p>
          </div>
          ${settingsRow(t('Display name', 'Nom affiché'), undefined, html`<input name="app_name" type="text" value="${b.app_name}" required/>`, true)}
          ${settingsRow(t('Tagline', 'Sous-titre'), undefined, html`<input name="tagline" type="text" value="${b.tagline}"/>`)}
          ${settingsRow(t('Primary color', 'Couleur principale'), undefined, colorCtrl('primary_color', b.primary_color))}
          ${settingsRow(t('Accent color', "Couleur d'accent"), undefined, colorCtrl('accent_color', b.accent_color))}
          ${settingsRow('Logo', t('PNG / SVG / JPEG, max 10 MB.', 'PNG / SVG / JPEG, max 10 Mo.'), fileCtrl('logo', 'image/png,image/svg+xml,image/jpeg', b.logo_data_url, 'remove_logo'))}

          <div class="settings-section-head">
            <h2>${t('Theme', 'Thème')}</h2>
            <p class="sub">${t('Default appearance and corner radius.', 'Apparence par défaut et arrondis.')}</p>
          </div>
          ${settingsRow(t('Default theme', 'Thème par défaut'), undefined, html`
            <select name="default_theme">
              <option value="dark"${b.default_theme === 'dark' ? raw(' selected') : raw('')}>${t('Dark', 'Sombre')}</option>
              <option value="light"${b.default_theme === 'light' ? raw(' selected') : raw('')}>${t('Light', 'Clair')}</option>
              <option value="system"${b.default_theme === 'system' ? raw(' selected') : raw('')}>${t('System (auto)', 'Système (auto)')}</option>
            </select>
          `, true)}
          ${settingsRow(t('Corners', 'Coins'), undefined, html`
            <select name="radius">
              <option value="none"${b.radius === 'none' ? raw(' selected') : raw('')}>${t('Square', 'Carrés')}</option>
              <option value="sm"${b.radius === 'sm' ? raw(' selected') : raw('')}>${t('Slight', 'Légers')}</option>
              <option value="md"${b.radius === 'md' ? raw(' selected') : raw('')}>${t('Rounded', 'Arrondis')}</option>
              <option value="lg"${b.radius === 'lg' ? raw(' selected') : raw('')}>${t('Very rounded', 'Très arrondis')}</option>
            </select>
          `)}

          <div class="settings-section-head">
            <h2>${t('Background', 'Arrière-plan')}</h2>
            <p class="sub">${t('Background image applied to the sign-in page.', 'Image de fond appliquée à la page de connexion.')}</p>
          </div>
          ${settingsRow(t('Background image', 'Image de fond'), t('PNG / JPEG / WebP, max 10 MB.', 'PNG / JPEG / WebP, max 10 Mo.'), fileCtrl('background', 'image/png,image/jpeg,image/webp', b.background_data_url, 'remove_background', true), true)}
          ${settingsRow(t('Background opacity', 'Opacité du fond'), undefined, html`
            <div class="range-field">
              <div class="range-head">
                <span class="range-value">${String(b.background_opacity)}%</span>
              </div>
              <input type="range" name="background_opacity" min="0" max="100" step="5" value="${String(b.background_opacity)}"
                     oninput="this.previousElementSibling.querySelector('.range-value').textContent=this.value+'%'"/>
            </div>
          `)}

          <div class="settings-section-head">
            <h2>${t('Texts', 'Textes')}</h2>
            <p class="sub">${t('Customize the texts of the sign-in page.', 'Personnalise les textes de la page de connexion.')}</p>
          </div>
          ${settingsRow(t('Sign-in button label', 'Libellé du bouton de connexion'), undefined, html`<input name="login_button_label" type="text" value="${b.login_button_label}"/>`, true)}
          ${settingsRow(t('Footer text', 'Texte de pied de page'), t('Empty = no footer.', 'Vide = pas de footer.'), html`<input name="footer_text" type="text" value="${b.footer_text}"/>`)}

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({ title: t('Appearance', 'Apparence'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'branding' });
}

// ── Audit ─────────────────────────────────────────────────────────
export function auditPage(opts: {
  user: NavUser;
  csrfToken: string;
  entries: AuditEntry[];
}): Raw {
  const body = html`
    <div class="fade-in">
      ${pageHeader({ title: t('Audit log', "Journal d'audit"), subtitle: t('Last 200 events (logins, admin actions).', '200 derniers événements (logins, actions admin).') })}
    </div>
    <div class="fade-in fade-in-2">
      ${opts.entries.length === 0
        ? html`<div class="card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/></svg>
              </div>
              <div class="empty-state-title">${t('No events', 'Aucun événement')}</div>
              <p class="empty-state-body">${t('Admin actions and sign-ins will appear here.', 'Les actions admin et logins apparaîtront ici.')}</p>
            </div>
          </div>`
        : html`<div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('When', 'Quand')}</th>
                  <th>${t('Actor', 'Acteur')}</th>
                  <th>${t('Action', 'Action')}</th>
                  <th>${t('Target', 'Cible')}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                ${opts.entries.map((e) => html`
                  <tr>
                    <td class="font-mono" style="color: var(--text-muted); font-size: 12px;">${new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                    <td style="color: var(--text-muted)">${e.actor_user_id ?? raw('')}</td>
                    <td><code class="font-mono" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--surface-3); color: var(--text); border: 1px solid var(--border);">${e.action}</code></td>
                    <td style="color: var(--text-muted)">${e.target ?? raw('')}</td>
                    <td class="font-mono" style="color: var(--text-muted); font-size: 12px;">${e.ip ?? raw('')}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>`}
    </div>
  `;
  return layout({ title: t('Audit', 'Audit'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', width: 'wide', activeSection: 'audit' });
}

// ── Settings ──────────────────────────────────────────────────────
export function settingsPage(opts: {
  user: NavUser;
  csrfToken: string;
  settings: AppSettings;
  flash?: string | null;
}): Raw {
  const s = opts.settings;

  const settingsRow = (name: string, help: string | undefined, control: Raw, isFirst = false) => html`
    <div class="settings-row${isFirst ? ' first' : ''}">
      <div class="settings-row-label">
        <div class="settings-row-name">${name}</div>
        ${help ? html`<div class="settings-row-help">${help}</div>` : ''}
      </div>
      <div class="settings-row-control">${control}</div>
    </div>
  `;

  const numCtrl = (name: string, value: number) => html`<input name="${name}" type="number" min="0" value="${String(value)}"/>`;

  const body = html`
    <div class="fade-in">${pageHeader({ title: t('Settings', 'Paramètres'), subtitle: t('Security, passwords, sessions and accounts.', 'Sécurité, mots de passe, sessions et comptes.') })}</div>
    ${opts.flash ? html`<div class="fade-in fade-in-1"><div class="alert alert-success">${opts.flash}</div></div>` : ''}
    <div class="fade-in fade-in-1">
      <div class="card">
        <form method="POST" action="/admin/settings">
          <input type="hidden" name="csrf" value="${opts.csrfToken}"/>

          <div class="settings-section-head">
            <h2>${t('Security', 'Sécurité')}</h2>
            <p class="sub">${t('Protection against brute-force attacks.', 'Protection contre les attaques par force brute.')}</p>
          </div>
          ${settingsRow(t('Max attempts before lockout', 'Tentatives max avant blocage'), t('0 = never lock.', '0 = jamais bloquer.'), numCtrl('lockout_max_attempts', s.lockout_max_attempts), true)}
          ${settingsRow(t('Lockout duration (min)', 'Durée de blocage (min)'), undefined, numCtrl('lockout_window_minutes', s.lockout_window_minutes))}

          <div class="settings-section-head">
            <h2>${t('Password', 'Mot de passe')}</h2>
            <p class="sub">${t('Complexity policy applied to every account.', 'Politique de complexité appliquée à tous les comptes.')}</p>
          </div>
          ${settingsRow(t('Minimum length', 'Longueur minimale'), t('Min 8, 12+ recommended.', 'Min 8, recommandé 12+.'), numCtrl('password_min_length', s.password_min_length))}
          ${settingsRow(t('Minimum strength (zxcvbn)', 'Force minimale (zxcvbn)'), t('Score from 0 (no constraint) to 4 (very strict).', 'Score de 0 (aucune contrainte) à 4 (très exigeant).'), html`
            <select name="password_min_score">
              ${[0,1,2,3,4].map((n) => html`<option value="${String(n)}"${s.password_min_score === n ? raw(' selected') : raw('')}>${String(n)} ${n===0?t('none','aucune'):n===1?t('very weak','très faible'):n===2?t('weak','faible'):n===3?t('fair','correct'):t('strong','fort')}</option>`)}
            </select>
          `)}

          <div class="settings-section-head">
            <h2>${t('Sessions', 'Sessions')}</h2>
            <p class="sub">${t('Lifetime of user sessions on the IdP.', "Durée des sessions utilisateur sur l'IdP.")}</p>
          </div>
          ${settingsRow(t('Max duration (min)', 'Durée max (min)'), t('Default 480 = 8h.', 'Défaut 480 = 8 h.'), numCtrl('session_ttl_minutes', s.session_ttl_minutes))}
          ${settingsRow(t('Max idle (min)', 'Inactivité max (min)'), t('Default 60 = 1h.', 'Défaut 60 = 1 h.'), numCtrl('session_idle_minutes', s.session_idle_minutes))}

          <div class="settings-section-head">
            <h2>${t('Accounts', 'Comptes')}</h2>
            <p class="sub">${t('Default behavior when creating an account.', "Comportement par défaut à la création d'un compte.")}</p>
          </div>
          ${settingsRow(t('Accepted login', 'Login accepté'), undefined, html`
            <select name="login_mode">
              <option value="both"${s.login_mode === 'both' ? raw(' selected') : raw('')}>${t('Username or email', 'Identifiant ou email')}</option>
              <option value="username"${s.login_mode === 'username' ? raw(' selected') : raw('')}>${t('Username only', 'Identifiant uniquement')}</option>
              <option value="email"${s.login_mode === 'email' ? raw(' selected') : raw('')}>${t('Email only', 'Email uniquement')}</option>
            </select>
          `)}
          ${settingsRow(t('Default role', 'Rôle par défaut'), undefined, html`
            <select name="default_role">
              <option value="member"${s.default_role === 'member' ? raw(' selected') : raw('')}>${t('Member', 'Membre')}</option>
              <option value="admin"${s.default_role === 'admin' ? raw(' selected') : raw('')}>Admin</option>
            </select>
          `)}

          <div class="form-actions">
            <button type="submit" class="btn-primary btn-md">${t('Save', 'Enregistrer')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  return layout({ title: t('Settings', 'Paramètres'), body, user: opts.user, csrfToken: opts.csrfToken, mode: 'admin', activeSection: 'settings' });
}
