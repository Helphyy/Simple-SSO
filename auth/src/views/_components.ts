import { html, raw, type Raw } from '../lib/html.js';
import { t } from '../lib/i18n.js';

// ── Badge ──────────────────────────────────────────────────────────
export type BadgeVariant = 'admin' | 'member' | 'success' | 'danger' | 'warning' | 'neutral';

export function badge(variant: BadgeVariant, label: string): Raw {
  return html`<span class="badge badge-${variant}">${label}</span>`;
}

// ── Status (dot + label) ──────────────────────────────────────────
export function statusDot(active: boolean, labelActive = t('Active', 'Actif'), labelOff = t('Disabled', 'Désactivé')): Raw {
  return html`<span class="status${active ? '' : ' status-off'}">
    <span class="status-dot"></span>
    <span>${active ? labelActive : labelOff}</span>
  </span>`;
}

// ── Alert / banner ────────────────────────────────────────────────
export type AlertKind = 'success' | 'danger' | 'warning' | 'info';

export function alert(kind: AlertKind, body: Raw | string): Raw {
  return html`<div class="alert alert-${kind} fade-in">${body}</div>`;
}

// ── Empty state ───────────────────────────────────────────────────
export function emptyState(opts: {
  icon?: Raw;
  title: string;
  body?: string;
  cta?: { href: string; label: string };
}): Raw {
  return html`<div class="empty-state">
    ${opts.icon ? html`<div class="empty-state-icon">${opts.icon}</div>` : ''}
    <div class="empty-state-title">${opts.title}</div>
    ${opts.body ? html`<p class="empty-state-body">${opts.body}</p>` : ''}
    ${opts.cta ? html`<a href="${opts.cta.href}" class="btn-primary mt-4 inline-flex items-center gap-1.5">${opts.cta.label}</a>` : ''}
  </div>`;
}

// ── Page header ────────────────────────────────────────────────────
export function pageHeader(opts: { title: string; subtitle?: string; action?: Raw }): Raw {
  return html`<div class="page-header">
    <div>
      <h1 class="page-title">${opts.title}</h1>
      ${opts.subtitle ? html`<p class="page-subtitle">${opts.subtitle}</p>` : ''}
    </div>
    ${opts.action ?? ''}
  </div>`;
}

// ── Section header (inside a card) ───────────────────────────────
export function sectionHeader(label: string, sub?: string): Raw {
  return html`<div class="section-header">
    <h2>${label}</h2>
    ${sub ? html`<p class="section-sub">${sub}</p>` : ''}
  </div>`;
}

// ── Card ───────────────────────────────────────────────────────────
export function card(body: Raw, opts: { hover?: boolean; danger?: boolean } = {}): Raw {
  const classes = ['card'];
  if (opts.hover) classes.push('card-hover');
  if (opts.danger) classes.push('card-danger');
  return html`<div class="${classes.join(' ')}">${body}</div>`;
}

// ── Divider ───────────────────────────────────────────────────────
export const divider = raw('<hr class="divider"/>');

// ── Buttons ───────────────────────────────────────────────────────
export type BtnVariant = 'primary' | 'ghost' | 'danger' | 'ghost-danger';
export type BtnSize = 'sm' | 'md';

export function btn(label: string, opts: {
  variant?: BtnVariant;
  size?: BtnSize;
  type?: 'submit' | 'button';
  className?: string;
} = {}): Raw {
  const variant = opts.variant ?? 'primary';
  const size = opts.size ?? 'md';
  const variantClass =
    variant === 'primary' ? 'btn-primary' :
    variant === 'danger' ? 'btn-danger' :
    variant === 'ghost' ? 'btn-ghost' :
    'btn-ghost btn-ghost-danger';
  return html`<button type="${opts.type ?? 'submit'}" class="${variantClass} btn-${size} ${opts.className ?? ''}">${label}</button>`;
}

export function linkBtn(href: string, label: string, opts: {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: Raw;
} = {}): Raw {
  const variant = opts.variant ?? 'primary';
  const size = opts.size ?? 'md';
  const variantClass =
    variant === 'primary' ? 'btn-primary' :
    variant === 'danger' ? 'btn-danger' :
    variant === 'ghost' ? 'btn-ghost' :
    'btn-ghost btn-ghost-danger';
  return html`<a href="${href}" class="${variantClass} btn-${size} inline-flex items-center gap-1.5">
    ${opts.icon ?? ''}<span>${label}</span>
  </a>`;
}

// ── Form input ────────────────────────────────────────────────────
export function input(name: string, opts: {
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
  minlength?: number;
  help?: string;
  disabled?: boolean;
}): Raw {
  const v = opts.value !== undefined ? raw(`value="${escapeAttr(opts.value)}"`) : raw('');
  return html`<div class="form-field">
    <label class="label">${opts.label}</label>
    <input name="${name}" type="${opts.type ?? 'text'}"
           ${v}
           ${opts.required ? raw('required') : raw('')}
           ${opts.placeholder ? raw(`placeholder="${escapeAttr(opts.placeholder)}"`) : raw('')}
           ${opts.autocomplete ? raw(`autocomplete="${escapeAttr(opts.autocomplete)}"`) : raw('')}
           ${opts.minlength ? raw(`minlength="${opts.minlength}"`) : raw('')}
           ${opts.disabled ? raw('disabled') : raw('')}
           class="w-full"/>
    ${opts.help ? html`<p class="help-text">${opts.help}</p>` : ''}
  </div>`;
}

// ── Select ────────────────────────────────────────────────────────
export function select(name: string, opts: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  help?: string;
}): Raw {
  return html`<div class="form-field">
    <label class="label">${opts.label}</label>
    <select name="${name}" class="w-full">
      ${opts.options.map((o) => html`<option value="${o.value}"${opts.value === o.value ? raw(' selected') : raw('')}>${o.label}</option>`)}
    </select>
    ${opts.help ? html`<p class="help-text">${opts.help}</p>` : ''}
  </div>`;
}

// ── Form row (grid 2 cols, responsive) ───────────────────────────
export function formRow(...children: Raw[]): Raw {
  return html`<div class="form-row">${children.map((c) => c)}</div>`;
}

// ── Searchable picker (combobox + chips) ──────────────────────────
export interface PickerItem { id: string; label: string; sub?: string }
export function searchPicker(opts: {
  name: string;
  items: PickerItem[];
  selected: Set<string>;
  placeholder?: string;
  emptyLabel?: string;
  noOptionsLabel?: string;
}): Raw {
  const sel = opts.items.filter((i) => opts.selected.has(i.id));
  const all = opts.items;
  const noOptions = opts.noOptionsLabel ?? t('No option available.', 'Aucune option disponible.');
  return html`<div class="picker" data-picker data-name="${opts.name}">
    <div class="picker-chips" data-chips data-empty="${opts.emptyLabel ?? ''}">
      ${sel.map((it) => html`<span class="picker-chip" data-chip data-id="${it.id}" data-label="${it.label}" data-sub="${it.sub ?? ''}">
        <span class="picker-chip-label">${it.label}</span>
        <button type="button" class="picker-chip-x" aria-label="Remove">&times;</button>
        <input type="hidden" name="${opts.name}" value="${it.id}"/>
      </span>`)}
    </div>
    <div class="picker-search">
      <input type="text" data-picker-input placeholder="${opts.placeholder ?? ''}" autocomplete="off"/>
      <div class="picker-list" data-list hidden>
        ${all.map((it) => html`<button type="button" class="picker-option" data-id="${it.id}" data-label="${it.label}" data-sub="${it.sub ?? ''}">
          <span class="picker-option-label">${it.label}</span>
          ${it.sub ? html`<span class="picker-option-sub">${it.sub}</span>` : ''}
        </button>`)}
        <div class="picker-no-options" data-no-options hidden>${noOptions}</div>
      </div>
    </div>
  </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────
export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

// ── Avatar (logo-mark + name initial) ─────────────────────────────
export function avatar(label: string, opts: { size?: number; src?: string | null } = {}): Raw {
  const size = opts.size ?? 32;
  if (opts.src) {
    return html`<img src="${opts.src}" alt="" class="avatar-img" style="width:${size}px;height:${size}px;"/>`;
  }
  const fontSize = Math.round(size * 0.4);
  return html`<span class="avatar-mark" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${initial(label)}</span>`;
}
