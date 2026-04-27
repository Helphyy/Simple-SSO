import { html, raw, type Raw } from '../lib/html.js';
import { Brand, RADIUS_MAP } from '../models/branding.js';
import { getLang, getRequestPath, t } from '../lib/i18n.js';

function langSelector(): Raw {
  const cur = getLang();
  const next = getRequestPath();
  return html`<form method="POST" action="/language" class="lang-switch" title="${t('Language', 'Langue')}" aria-label="${t('Language', 'Langue')}">
    <input type="hidden" name="next" value="${next}"/>
    <button type="submit" name="lang" value="en" class="lang-btn${cur === 'en' ? ' is-active' : ''}" aria-label="English">EN</button>
    <span class="lang-sep" aria-hidden="true">/</span>
    <button type="submit" name="lang" value="fr" class="lang-btn${cur === 'fr' ? ' is-active' : ''}" aria-label="Français">FR</button>
  </form>`;
}

export interface LayoutOpts {
  title: string;
  body: Raw;
  hideNav?: boolean;
  user?: { username: string; role: 'admin' | 'member' } | null;
  csrfToken?: string | null;
  clientId?: string | null;
  mode?: 'user' | 'admin';
  width?: 'narrow' | 'normal' | 'wide';
  activeSection?: 'home' | 'profile' | 'admin' | 'users' | 'groups' | 'clients' | 'branding' | 'settings' | 'audit' | null;
}

function themeToggle(): Raw {
  return html`<button type="button" data-theme-toggle class="tbtn" aria-label="${t('Toggle theme', 'Basculer le thème')}" title="${t('Theme', 'Thème')}">
    <svg class="i-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v1.5M10 16v1.5M2.5 10h1.5M16 10h1.5M4.5 4.5l1 1M14.5 14.5l1 1M4.5 15.5l1-1M14.5 5.5l1-1"/></svg>
    <svg class="i-moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 12.5A7 7 0 017.5 3a.5.5 0 00-.7-.5A8 8 0 1017.5 13.2a.5.5 0 00-.5-.7z"/></svg>
  </button>`;
}

export function layout(opts: LayoutOpts): Raw {
  const b = Brand.get(opts.clientId ?? null);
  const useShell = !opts.hideNav && !!opts.user;
  const floatingToggle = opts.hideNav ? html`<div class="floating-toggle">${langSelector()}${themeToggle()}</div>` : raw('');
  const radius = RADIUS_MAP[b.radius] ?? RADIUS_MAP.sm;
  const initialTheme = b.default_theme === 'system' ? '' : b.default_theme;
  const bgOpacity = Math.max(0, Math.min(100, b.background_opacity)) / 100;
  const showBg = opts.hideNav && b.background_data_url;

  return html`<!doctype html>
<html lang="${getLang()}"${initialTheme ? raw(` data-theme="${initialTheme}"`) : raw('')} data-default-theme="${b.default_theme}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="dark light"/>
  <title>${opts.title} ${b.app_name}</title>
  <script src="/assets/app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-primary: ${b.primary_color};
      --color-accent: ${b.accent_color};
      --radius-base: ${radius.base};
      --radius-card: ${radius.card};

      --bg: #191919;
      --surface: #202020;
      --surface-2: #2a2a2a;
      --surface-3: #373737;
      --border: rgba(255,255,255,0.094);
      --border-strong: rgba(255,255,255,0.16);
      --text: rgba(255,255,255,0.87);
      --text-muted: rgba(255,255,255,0.56);
      --text-faint: rgba(255,255,255,0.35);

      --success: #52987a;
      --success-bg: rgba(82,152,122,0.12);
      --success-border: rgba(82,152,122,0.3);
      --danger: #e06b64;
      --danger-bg: rgba(224,107,100,0.1);
      --danger-border: rgba(224,107,100,0.28);
      --warning: #e0a83a;
      --warning-bg: rgba(224,168,58,0.1);
      --warning-border: rgba(224,168,58,0.28);

      --hover: rgba(255,255,255,0.055);
      --hover-strong: rgba(255,255,255,0.09);

      --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;

      /* Spacing scale (4px grid) */
      --s1: 4px;
      --s2: 8px;
      --s3: 12px;
      --s4: 16px;
      --s5: 20px;
      --s6: 24px;
      --s8: 32px;
      --s10: 40px;
      --s12: 48px;
    }

    [data-theme="light"] {
      --bg: #ffffff;
      --surface: #f7f6f3;
      --surface-2: #f1f1ef;
      --surface-3: #e9e9e7;
      --border: rgba(55,53,47,0.09);
      --border-strong: rgba(55,53,47,0.16);
      --text: #37352f;
      --text-muted: rgba(55,53,47,0.65);
      --text-faint: rgba(55,53,47,0.45);

      --success: #448361;
      --success-bg: rgba(68,131,97,0.12);
      --success-border: rgba(68,131,97,0.28);
      --danger: #d44c47;
      --danger-bg: rgba(212,76,71,0.08);
      --danger-border: rgba(212,76,71,0.24);
      --warning: #cb912f;
      --warning-bg: rgba(203,145,47,0.12);
      --warning-border: rgba(203,145,47,0.28);

      --hover: rgba(55,53,47,0.06);
      --hover-strong: rgba(55,53,47,0.1);
    }

    * { box-sizing: border-box; }
    html, body { background: var(--bg); }
    body {
      font-family: var(--font-sans);
      color: var(--text);
      font-feature-settings: "ss01", "ss03", "cv11";
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      min-height: 100vh;
      transition: background-color 0.2s ease, color 0.2s ease;
      line-height: 1.5;
      font-size: 14px;
    }

    /* ── Typography ────────────────────────────────────────── */
    h1 {
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 22px;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: var(--text);
    }
    h2 {
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 14px;
      letter-spacing: -0.005em;
      line-height: 1.3;
      color: var(--text);
    }
    h3 {
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0;
      color: var(--text);
    }
    p { margin: 0; }
    .label {
      font-family: var(--font-sans);
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text);
      display: block;
      letter-spacing: -0.005em;
    }
    .font-mono, code { font-family: var(--font-mono); font-feature-settings: "ss01"; }

    /* ── Shell: sidebar + content ──────────────────────────── */
    .shell {
      display: grid;
      grid-template-columns: 248px 1fr;
      min-height: 100vh;
    }
    .sidebar {
      position: fixed;
      left: 0; top: 0; bottom: 0;
      width: 248px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 14px 10px;
      z-index: 30;
      overflow-y: auto;
    }
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px 16px;
    }
    .sidebar-brand .brand-name {
      font-weight: 600;
      font-size: 13.5px;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-top: 4px;
      flex: 1;
    }
    .sidebar-section {
      padding: 16px 10px 6px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-faint);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .s-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13.5px;
      font-weight: 400;
      color: var(--text-muted);
      transition: background 0.1s, color 0.1s;
      cursor: pointer;
      line-height: 1.3;
      text-decoration: none;
    }
    .s-link:hover { background: var(--hover); color: var(--text); }
    .s-link.is-active { background: var(--hover-strong); color: var(--text); font-weight: 500; }
    .s-link .s-icon { width: 16px; height: 16px; flex-shrink: 0; color: currentColor; opacity: 0.9; }
    .sidebar-foot {
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 6px 4px;
    }
    .sidebar-foot .who {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      font-size: 13px;
      color: var(--text);
      min-width: 0;
    }
    .sidebar-foot .who .avatar {
      width: 22px; height: 22px;
      border-radius: 4px;
      background: color-mix(in oklab, var(--color-accent) 80%, var(--surface-2));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600;
      flex-shrink: 0;
    }
    .sidebar-foot .who .u-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* .content uses asymmetric padding to make its content-box symmetric
       relative to the viewport (compensates the 248px fixed sidebar).
       Result: any element with margin auto inside .content is
       viewport-centered, not content-area-centered. */
    .content {
      grid-column: 2;
      padding: 48px 304px 80px 56px;
      max-width: 100%;
    }
    .content-inner {
      max-width: 720px;
      margin-left: auto;
      margin-right: auto;
    }
    .content-inner.wide { max-width: 1040px; }
    .content-inner.narrow { max-width: 560px; }
    .form-wrap { max-width: 720px; margin: 0 auto; }

    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar {
        position: static;
        width: 100%;
        flex-direction: row;
        padding: 8px 12px;
        border-right: none;
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
      }
      .sidebar-nav { flex-direction: row; gap: 2px; margin: 0; }
      .sidebar-section { display: none; }
      .sidebar-brand { padding: 6px 8px; }
      .sidebar-foot { margin: 0; padding: 0 6px; border: 0; }
      .sidebar-foot .who .u-name { display: none; }
      .content { padding: 32px 20px 60px; }
      .content-inner,
      .content-inner.wide,
      .content-inner.narrow { margin-left: auto; margin-right: auto; }
    }

    /* ── Small buttons (toggle, logout) ─────────────────── */
    .tbtn {
      width: 28px; height: 28px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--text-muted);
      border: 0;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }
    .tbtn:hover { background: var(--hover); color: var(--text); }
    .tbtn svg { width: 16px; height: 16px; }
    .tbtn .i-sun { display: block; }
    .tbtn .i-moon { display: none; }
    [data-theme="light"] .tbtn .i-sun { display: none; }
    [data-theme="light"] .tbtn .i-moon { display: block; }

    .floating-toggle { position: fixed; top: 16px; right: 16px; z-index: 20; display: inline-flex; align-items: center; gap: 6px; }

    /* ── Language switch ────────────────────────────────── */
    .lang-switch { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; line-height: 1; }
    .lang-switch .lang-btn {
      padding: 4px 6px; border: 0; background: transparent;
      color: var(--text-faint); cursor: pointer; border-radius: 4px;
      font: 500 11px/1 var(--font-sans); letter-spacing: 0.05em;
    }
    .lang-switch .lang-btn:hover { color: var(--text-muted); background: var(--hover); }
    .lang-switch .lang-btn.is-active { color: var(--text); }
    .lang-switch .lang-sep { color: var(--text-faint); user-select: none; }
    .sidebar-tools { display: inline-flex; align-items: center; gap: 6px; }

    /* ── Logo mark ──────────────────────────────────────── */
    .logo-mark {
      width: 22px; height: 22px;
      border-radius: 5px;
      background: linear-gradient(135deg,
        color-mix(in oklab, var(--color-accent) 100%, white),
        color-mix(in oklab, var(--color-accent) 80%, black));
      color: #fff;
      display: inline-flex;
      align-items: center; justify-content: center;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }

    /* ── Tailwind neutrals → Notion palette ──────────────── */
    .bg-white { background-color: var(--surface) !important; }
    .bg-slate-50 { background-color: var(--surface-2) !important; }
    .bg-slate-100 { background-color: var(--surface-2) !important; color: var(--text) !important; }
    .bg-slate-800, .bg-slate-900 { background-color: var(--surface) !important; }
    .text-slate-900, .text-slate-700 { color: var(--text) !important; }
    .text-slate-600, .text-slate-500, .text-slate-300 { color: var(--text-muted) !important; }
    .text-slate-400 { color: var(--text-faint) !important; }
    .border-slate-200, .border-slate-300 { border-color: var(--border) !important; }
    .divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color: var(--border) !important; }

    .shadow-sm { box-shadow: none !important; }
    .shadow-md { box-shadow: none !important; }
    .rounded-lg { border-radius: var(--radius-card) !important; }
    .rounded-md { border-radius: var(--radius-base) !important; }

    /* ── Inputs ────────────────────────────────────────── */
    input[type=text], input[type=email], input[type=password],
    input[type=number], input[type=url], input[type=tel],
    input[type=file], textarea, select {
      background-color: var(--surface-2) !important;
      border: 1px solid var(--border) !important;
      color: var(--text) !important;
      border-radius: 6px !important;
      font-family: var(--font-sans);
      font-size: 13.5px;
      line-height: 1.4;
      padding: 8px 11px !important;
      transition: border-color 0.1s, box-shadow 0.1s, background-color 0.1s;
      box-shadow: rgba(15,15,15,0.06) 0px 1px 2px inset;
    }
    [data-theme="light"] input[type=text],
    [data-theme="light"] input[type=email],
    [data-theme="light"] input[type=password],
    [data-theme="light"] input[type=number],
    [data-theme="light"] input[type=url],
    [data-theme="light"] input[type=tel],
    [data-theme="light"] textarea,
    [data-theme="light"] select {
      background-color: #fff !important;
      box-shadow: rgba(15,15,15,0.025) 0px 1px 2px inset;
    }
    input[type=text]:hover, input[type=email]:hover, input[type=password]:hover,
    input[type=number]:hover, input[type=url]:hover,
    textarea:hover, select:hover { border-color: var(--border-strong) !important; }
    input[type=text]:focus, input[type=email]:focus, input[type=password]:focus,
    input[type=number]:focus, input[type=url]:focus,
    textarea:focus, select:focus {
      outline: none !important;
      border-color: color-mix(in oklab, var(--color-accent) 70%, var(--border-strong)) !important;
      box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 18%, transparent),
                  rgba(15,15,15,0.1) 0px 1px 2px inset !important;
    }
    input::placeholder, textarea::placeholder { color: var(--text-faint); }
    textarea {
      font-family: var(--font-mono) !important;
      font-size: 12.5px !important;
      line-height: 1.5 !important;
      resize: vertical;
      min-height: 64px;
    }
    input[type=color] {
      padding: 2px !important;
      height: 32px;
      cursor: pointer;
    }
    input[type=checkbox] { accent-color: var(--color-accent); width: 14px; height: 14px; }
    input[type=file] {
      font-size: 13px;
      color: var(--text-muted) !important;
      cursor: pointer;
    }
    input[type=file]::file-selector-button {
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 10px;
      margin-right: 10px;
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.1s;
    }
    input[type=file]::file-selector-button:hover { background: var(--surface-3); }

    /* ── Buttons ───────────────────────────────────────── */
    .btn-primary, .btn-danger, .btn-ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--font-sans) !important;
      font-weight: 500 !important;
      font-size: 13px !important;
      letter-spacing: -0.005em;
      padding: 6px 12px !important;
      line-height: 1.4 !important;
      border-radius: 6px !important;
      cursor: pointer;
      transition: filter 0.1s, background 0.1s, border-color 0.1s, box-shadow 0.1s;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--text) !important;
      color: var(--bg) !important;
      border: 1px solid transparent !important;
      box-shadow: 0 1px 2px rgba(15,15,15,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .btn-primary:hover { filter: brightness(0.94); }
    .btn-primary:active { filter: brightness(0.86); }
    [data-theme="light"] .btn-primary {
      background: #2c2b27 !important;
      color: #fff !important;
    }

    .btn-danger {
      background: var(--danger) !important;
      color: #fff !important;
      border: 1px solid transparent !important;
      box-shadow: 0 1px 2px rgba(15,15,15,0.08);
    }
    .btn-danger:hover { filter: brightness(1.08); }

    .btn-ghost {
      background: transparent !important;
      color: var(--text) !important;
      border: 1px solid var(--border) !important;
    }
    .btn-ghost:hover { background: var(--hover) !important; border-color: var(--border-strong) !important; }
    .btn-ghost.btn-ghost-danger { color: var(--danger) !important; }
    .btn-ghost.btn-ghost-danger:hover {
      background: var(--danger-bg) !important;
      border-color: var(--danger-border) !important;
    }
    .btn-link {
      background: transparent !important;
      color: var(--text-muted) !important;
      border: 0 !important;
      font-size: 13px !important;
      padding: 4px 8px !important;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.1s, color 0.1s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-link:hover { background: var(--hover); color: var(--text) !important; }

    .link-accent {
      color: var(--color-accent) !important;
      transition: opacity 0.1s;
      font-weight: 500;
    }
    .link-accent:hover { opacity: 0.8; }

    /* ── Alerts ─────────────────────────────────────────── */
    .bg-emerald-50 { background-color: var(--success-bg) !important; }
    .border-emerald-200 { border-color: var(--success-border) !important; }
    .text-emerald-800 { color: var(--success) !important; }
    .bg-emerald-500 { background-color: var(--success) !important; }

    .bg-red-50 { background-color: var(--danger-bg) !important; }
    .border-red-200 { border-color: var(--danger-border) !important; }
    .text-red-800, .text-red-600 { color: var(--danger) !important; }

    .bg-amber-50 { background-color: var(--warning-bg) !important; }
    .border-amber-200 { border-color: var(--warning-border) !important; }
    .text-amber-700, .text-amber-800, .text-amber-900 { color: var(--warning) !important; }

    .bg-indigo-100 { background-color: color-mix(in oklab, var(--color-accent) 15%, var(--surface-2)) !important; }
    .text-indigo-700 { color: color-mix(in oklab, var(--color-accent) 85%, var(--text)) !important; }

    .bg-slate-400 { background-color: var(--text-faint) !important; }

    /* ── Tables ─────────────────────────────────────────── */
    table { border-collapse: separate; border-spacing: 0; width: 100%; }
    table thead tr.bg-slate-50, table thead tr { background: transparent !important; }
    table thead th {
      font-family: var(--font-sans) !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      color: var(--text-faint) !important;
      border-bottom: 1px solid var(--border);
      padding: 10px 14px !important;
      text-align: left;
    }
    table tbody tr { transition: background 0.08s; }
    table tbody tr:hover { background: var(--hover); }
    table tbody tr.border-t { border-top-color: var(--border) !important; }

    ::selection { background: color-mix(in oklab, var(--color-accent) 30%, transparent); color: var(--text); }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }
    ::-webkit-scrollbar-track { background: transparent; }

    /* ── Card primitive ─────────────────────────────────── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      overflow: hidden;
    }
    .card-danger { border-color: var(--danger-border); }

    /* ── Card section (segment interne d'une card) ──────── */
    .card-section {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
    }
    .card-section:last-child { border-bottom: 0; }
    .card-section-header {
      margin-bottom: 16px;
    }
    .card-section-header h2 {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--text);
    }
    .card-section-header .sub {
      margin-top: 3px;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* Header autonome (legacy compat) */
    .section-header {
      padding: 16px 24px 14px;
      border-bottom: 1px solid var(--border);
    }
    .section-header h2 {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--text);
    }
    .section-header .section-sub {
      margin-top: 3px;
      font-size: 12.5px;
      color: var(--text-muted);
    }

    /* ── Page header ──────────────────────────────────── */
    .page-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border);
    }
    .page-title {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: var(--text);
    }
    .page-subtitle {
      margin-top: 6px;
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* ── Settings row (macOS / Linear style: label left, control right) ─ */
    /* No inter-row dividers; only sections separate visually. */
    .settings-row {
      display: flex;
      align-items: flex-start;
      gap: 32px;
      padding: 12px 24px;
    }
    .settings-row.first { padding-top: 14px; }
    .settings-row-label {
      flex: 0 0 240px;
      min-width: 0;
      padding-top: 8px;
    }
    .settings-row-name {
      font-size: 13.5px;
      font-weight: 500;
      color: var(--text);
      letter-spacing: -0.005em;
    }
    .settings-row-help {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .settings-row-control {
      flex: 1;
      min-width: 0;
      max-width: 360px;
    }
    .settings-row-control.wide { max-width: none; }
    .settings-row-control.wide .secret-value {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .settings-row-control > input,
    .settings-row-control > select,
    .settings-row-control > textarea {
      width: 100% !important;
    }
    .settings-row-control.row-color {
      max-width: 240px;
    }
    .settings-row-control .inline-help {
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .settings-section-head {
      padding: 16px 24px 4px;
    }
    .settings-section-head h2 {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--text);
    }
    .settings-section-head .sub {
      margin-top: 3px;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    /* Row right after a section head: tight top padding (head owns the spacing). */
    .settings-section-head + .settings-row { padding-top: 8px; }
    /* A new section head starting after rows owns the separator above. */
    .settings-row + .settings-section-head,
    .settings-section-head + .settings-section-head {
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    @media (max-width: 720px) {
      .settings-row {
        flex-direction: column;
        gap: 6px;
      }
      .settings-row-label { padding-top: 0; flex: none; }
      .settings-row-control { max-width: none; }
    }

    /* ── Form primitives ───────────────────────────────── */
    .form-field { display: block; }
    .form-field + .form-field { margin-top: 16px; }
    .form-field .label { margin-bottom: 6px; }
    .form-field .help-text {
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 720px) {
      .form-row { grid-template-columns: 1fr 1fr; }
    }
    /* Form section : groupement de form-field avec un titre */
    .form-section {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
    }
    .form-section:last-child { border-bottom: 0; }
    .form-section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .form-section-head h2 {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--text);
    }
    .form-section-head .sub {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .form-actions {
      padding: 14px 24px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
      background: color-mix(in oklab, var(--surface-2) 50%, transparent);
    }
    .form-actions a.btn-ghost,
    .form-actions a.btn-primary,
    .form-actions a.btn-danger {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }

    /* ── Range field (slider with live value) ──────────── */
    .range-field { display: flex; flex-direction: column; gap: 8px; }
    .range-field .range-head {
      display: flex; align-items: baseline; justify-content: space-between;
    }
    .range-field .range-value {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      border-radius: 999px;
      background: var(--surface-3);
      outline: none;
      padding: 0 !important;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--text);
      cursor: pointer;
      transition: transform 0.1s;
    }
    input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
    input[type=range]::-moz-range-thumb {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--text);
      cursor: pointer;
      border: 0;
    }

    /* ── Color field ──────────────────────────────────── */
    .color-field {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .color-field input[type=color] {
      width: 32px !important;
      height: 32px !important;
      padding: 2px !important;
      border-radius: 6px !important;
      flex-shrink: 0;
    }
    .color-field .color-hex {
      flex: 1;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    /* ── Checkbox row (dans une liste) ────────────────── */
    .check-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
      font-size: 13.5px;
    }
    .check-row:hover { background: var(--hover); }
    .check-row input[type=checkbox] { margin: 0; }
    .check-row .meta { flex: 1; min-width: 0; }
    .check-row .meta .name { color: var(--text); font-weight: 500; }
    .check-row .meta .sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* ── File upload field with preview ───────────────── */
    .file-upload {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .file-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-base);
    }
    .file-preview img {
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }
    .file-preview .remove-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--text-muted);
      cursor: pointer;
    }

    /* ── Divider ───────────────────────────────────────── */
    .divider {
      margin: 0;
      border: 0;
      border-top: 1px solid var(--border);
    }

    /* ── Help text outside form-field ─────────────────── */
    .help-text {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* ── Utility colors ───────────────────────────────── */
    .text-faint { color: var(--text-faint); }
    .text-muted { color: var(--text-muted); }
    .text-mono-xs { font-family: var(--font-mono); font-size: 11.5px; }

    /* ── Danger section (zone de danger dans un card) ─── */
    .danger-section {
      padding: 18px 24px;
      background: color-mix(in oklab, var(--danger-bg) 60%, transparent);
      border-top: 1px solid var(--danger-border);
    }
    .danger-section h2 {
      color: var(--danger);
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .danger-section p {
      font-size: 12.5px;
      color: var(--text-muted);
      margin-bottom: 12px;
      line-height: 1.45;
    }

    /* ── Stat grid (admin dashboard) ──────────────────── */
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 600px) { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
    .stat-card {
      display: block;
      padding: 16px 18px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: background 0.12s, border-color 0.12s;
    }
    .stat-card:hover {
      background: var(--surface-2);
      border-color: var(--border-strong);
    }
    .stat-card-head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .stat-icon {
      width: 14px; height: 14px;
      display: inline-flex;
      align-items: center; justify-content: center;
      color: var(--text-muted);
    }
    .stat-icon svg { width: 100%; height: 100%; }
    .stat-label {
      font-size: 12.5px;
      font-weight: 500;
      letter-spacing: -0.005em;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.025em;
      color: var(--text);
      line-height: 1;
    }

    /* ── App grid (hub) ───────────────────────────────── */
    .app-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 600px) { .app-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1000px) { .app-grid { grid-template-columns: repeat(3, 1fr); } }
    .app-card {
      display: block;
      padding: 18px 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: background 0.12s, border-color 0.12s, transform 0.12s;
      position: relative;
    }
    .app-card:hover {
      background: var(--surface-2);
      border-color: var(--border-strong);
    }
    .app-card.is-disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .app-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .app-card-logo {
      width: 36px; height: 36px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .app-card-logo-fallback {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg,
        color-mix(in oklab, var(--color-accent) 100%, white),
        color-mix(in oklab, var(--color-accent) 75%, black));
      color: #fff;
      display: inline-flex;
      align-items: center; justify-content: center;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    /* Wrap holding a favicon img on top of a letter background. The letter
       shows through as a fallback if the favicon fails to load. */
    .app-card-logo-wrap {
      position: relative;
      width: 36px; height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: linear-gradient(135deg,
        color-mix(in oklab, var(--color-accent) 100%, white),
        color-mix(in oklab, var(--color-accent) 75%, black));
      display: inline-flex;
      align-items: center; justify-content: center;
      overflow: hidden;
    }
    .app-card-logo-wrap::before {
      content: attr(data-letter);
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    .app-card-logo-wrap img {
      position: relative;
      width: 100%; height: 100%;
      object-fit: contain;
      background: #fff;
    }
    /* If favicon 404s, hide the broken img so the letter background shows. */
    .app-card-logo-wrap img:not([src]),
    .app-card-logo-wrap img[src=""] { display: none; }
    .app-card-arrow {
      width: 14px; height: 14px;
      color: var(--text-faint);
      opacity: 0;
      transform: translate(-4px, 4px);
      transition: opacity 0.12s, transform 0.12s, color 0.12s;
    }
    .app-card:hover .app-card-arrow {
      opacity: 1;
      transform: translate(0, 0);
      color: var(--text-muted);
    }
    .app-card-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: -0.01em;
      margin-bottom: 2px;
    }
    .app-card-id {
      font-size: 11.5px;
      color: var(--text-faint);
      font-family: var(--font-mono);
    }

    /* ── Secret display (post-create) ─────────────────── */
    .secret-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .secret-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-faint);
    }
    .secret-value {
      font-family: var(--font-mono);
      font-size: 12.5px;
      color: var(--text);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      word-break: break-all;
      user-select: all;
    }

    /* ── Stack / Inline utilities ─────────────────────── */
    .stack-2 { display: flex; flex-direction: column; gap: 8px; }
    .stack-3 { display: flex; flex-direction: column; gap: 12px; }
    .stack-4 { display: flex; flex-direction: column; gap: 16px; }
    .stack-6 { display: flex; flex-direction: column; gap: 24px; }
    .inline-2 { display: inline-flex; align-items: center; gap: 8px; }
    .inline-3 { display: inline-flex; align-items: center; gap: 12px; }

    /* ── Empty state ──────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: var(--text-muted);
    }
    .empty-state-icon {
      width: 36px;
      height: 36px;
      margin: 0 auto 16px;
      color: var(--text-faint);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
    }
    .empty-state-icon svg {
      width: 100%;
      height: 100%;
    }
    .empty-state-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 4px;
      letter-spacing: -0.005em;
    }
    .empty-state-body {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 360px;
      margin: 0 auto;
      line-height: 1.5;
    }

    /* ── Badges (cohérence) ────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.01em;
      border: 1px solid transparent;
      line-height: 1.5;
      white-space: nowrap;
    }
    .badge-admin {
      background: color-mix(in oklab, var(--color-accent) 15%, var(--surface-3));
      color: color-mix(in oklab, var(--color-accent) 85%, white);
      border-color: color-mix(in oklab, var(--color-accent) 30%, transparent);
    }
    .badge-member {
      background: var(--surface-3);
      color: var(--text-muted);
      border-color: var(--border);
    }
    .badge-success {
      background: var(--success-bg);
      color: var(--success);
      border-color: var(--success-border);
    }
    .badge-warning {
      background: var(--warning-bg);
      color: var(--warning);
      border-color: var(--warning-border);
    }
    .badge-danger {
      background: var(--danger-bg);
      color: var(--danger);
      border-color: var(--danger-border);
    }
    .badge-neutral {
      background: var(--surface-3);
      color: var(--text-muted);
      border-color: var(--border);
    }

    /* ── Status (dot + label) ─────────────────────────── */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text);
    }
    .status .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
    }
    .status.status-off .status-dot { background: var(--text-faint); }
    .status.status-off { color: var(--text-faint); }

    /* ── Alert ─────────────────────────────────────────── */
    .alert {
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid;
      font-size: 13px;
      line-height: 1.45;
      margin-bottom: 18px;
    }
    .alert-success {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: var(--success);
    }
    .alert-danger {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger);
    }
    .alert-warning {
      background: var(--warning-bg);
      border-color: var(--warning-border);
      color: var(--warning);
    }
    .alert-info {
      background: var(--surface-2);
      border-color: var(--border);
      color: var(--text-muted);
    }

    /* ── Button sizes (override) ───────────────────────── */
    .btn-sm {
      padding: 3px 9px !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
      gap: 4px !important;
    }
    .btn-md {
      padding: 6px 12px !important;
      font-size: 13px !important;
    }
    .btn-lg {
      padding: 8px 14px !important;
      font-size: 14px !important;
    }

    /* ── Avatar ────────────────────────────────────────── */
    .avatar-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg,
        color-mix(in oklab, var(--color-accent) 100%, white),
        color-mix(in oklab, var(--color-accent) 75%, black));
      color: #fff;
      border-radius: 5px;
      font-weight: 600;
      letter-spacing: -0.02em;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .avatar-img {
      object-fit: cover;
      border-radius: 5px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    /* ── DataTable (cohérent users/groups/clients) ────── */
    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    .data-table thead th {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-faint);
      text-align: left;
      padding: 11px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    .data-table thead th:first-child { padding-left: 24px; }
    .data-table thead th:last-child { padding-right: 24px; text-align: right; }
    .data-table tbody td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
      font-size: 13px;
    }
    .data-table tbody td:first-child { padding-left: 24px; }
    .data-table tbody td:last-child { padding-right: 24px; }
    .data-table tbody tr:last-child td { border-bottom: 0; }
    .data-table tbody tr { transition: background 0.1s; }
    .data-table tbody tr:hover { background: var(--hover); }
    .data-table .row-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: flex-end;
    }
    .data-table .cell-primary {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .data-table .cell-primary .meta {
      min-width: 0;
    }
    .data-table .cell-primary .meta .name {
      font-weight: 600;
      color: var(--text);
      font-size: 13px;
      letter-spacing: -0.005em;
    }
    .data-table .cell-primary .meta .sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* ── Searchable picker (combobox + chips) ───────────── */
    .picker { display: flex; flex-direction: column; gap: 8px; }
    .picker-chips {
      display: flex; flex-wrap: wrap; gap: 6px;
      min-height: 28px;
    }
    .picker-empty {
      font-size: 12.5px; color: var(--text-faint); padding: 4px 0;
    }
    .picker-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 4px 4px 10px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 12.5px;
      color: var(--text);
    }
    .picker-chip-label { white-space: nowrap; }
    .picker-chip-x {
      width: 18px; height: 18px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: 0; border-radius: 999px;
      color: var(--text-muted); font-size: 14px; line-height: 1;
      cursor: pointer; padding: 0;
    }
    .picker-chip-x:hover { background: var(--hover-strong); color: var(--text); }
    .picker-search { position: relative; }
    .picker-search input[type="text"] {
      width: 100%;
    }
    .picker-list {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      max-height: 240px; overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      z-index: 30;
      padding: 4px;
    }
    .picker-option {
      display: block; width: 100%; text-align: left;
      padding: 8px 10px;
      background: transparent; border: 0; border-radius: 6px;
      cursor: pointer;
      color: var(--text);
      font-size: 13px;
    }
    .picker-option:hover { background: var(--hover); }
    .picker-option .picker-option-label { font-weight: 500; }
    .picker-option .picker-option-sub {
      display: block;
      font-size: 11.5px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      margin-top: 1px;
    }

    /* ── Background image (login) ─────────────────────────── */
    .bg-layer {
      position: fixed; inset: 0;
      z-index: 0;
      background-size: cover;
      background-position: center;
      pointer-events: none;
    }
    .bg-layer ~ main { position: relative; z-index: 1; }

    /* ── Auth pages (login/setup/change-password) ──────────── */
    .auth-wrap {
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
    }
    .auth-panel {
      background: color-mix(in oklab, var(--bg) 86%, transparent);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
    }
    .auth-head {
      text-align: center;
      margin-bottom: 28px;
    }
    .auth-logo,
    .auth-logo-fallback {
      width: 44px;
      height: 44px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
    }
    .auth-logo {
      object-fit: cover;
      border: 1px solid var(--border);
    }
    .auth-logo-fallback {
      background: linear-gradient(135deg,
        color-mix(in oklab, var(--color-accent) 100%, white),
        color-mix(in oklab, var(--color-accent) 75%, black));
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    .auth-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--text);
      margin-bottom: 4px;
    }
    .auth-subtitle {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .auth-foot {
      margin-top: 24px;
      font-size: 11.5px;
      color: var(--text-faint);
      text-align: center;
      line-height: 1.5;
    }

    /* Legacy compat: anciennes classes appelées depuis ailleurs */
    .login-panel { /* deprecated, kept for safety */
      background: color-mix(in oklab, var(--bg) 86%, transparent);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
    }
    .login-foot {
      margin-top: 18px;
      font-size: 12px;
      color: var(--text-faint);
      text-align: center;
    }
    .card-hover { transition: background 0.1s, border-color 0.1s; }
    .card-hover:hover { background: var(--surface-2); border-color: var(--border-strong); }

    /* ── Reveal ─────────────────────────────────────────── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.3s ease-out both; }
    .fade-in-1 { animation-delay: 0.04s; }
    .fade-in-2 { animation-delay: 0.09s; }
    .fade-in-3 { animation-delay: 0.14s; }
    .fade-in-4 { animation-delay: 0.19s; }

    /* Status dot */
    .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }

    /* Kill legacy glow on generic status dots */
    .inline-block.w-2.h-2.rounded-full { box-shadow: none; }

    /* Eyebrow compat: some code still uses it, render as plain small muted */
    .eyebrow {
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      color: var(--text-muted);
    }
  </style>
</head>
<body class="min-h-screen">
  ${showBg ? html`<div class="bg-layer" style="background-image: url('${b.background_data_url!}'); opacity: ${String(bgOpacity)};"></div>` : ''}
  ${useShell ? renderShell(opts) : html`${floatingToggle}<main class="min-h-screen flex items-center justify-center px-6 py-10" style="position: relative; z-index: 1;">${opts.body}</main>`}
</body>
</html>`;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function navItem(href: string, label: string, icon: Raw, key: LayoutOpts['activeSection'], active: LayoutOpts['activeSection']): Raw {
  return html`<a href="${href}" class="s-link ${key === active ? 'is-active' : ''}">
    <span class="s-icon">${icon}</span>
    <span>${label}</span>
  </a>`;
}

function renderShell(opts: LayoutOpts): Raw {
  const b = Brand.get();
  const u = opts.user!;
  const mode = opts.mode ?? 'user';
  const icons = {
    home:    raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L10 4l7 5.5V16a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9.5z"/></svg>`),
    profile: raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5"/></svg>`),
    users:   raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5"/></svg>`),
    groups:  raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="2.5"/><circle cx="14" cy="8" r="2.5"/><path d="M2 16c0-2.3 2-4 5-4s5 1.7 5 4M10 16c0-2.3 2-4 4.5-4S18 13.7 18 16"/></svg>`),
    clients: raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="11" y="3" width="6" height="6" rx="1.3"/><rect x="3" y="11" width="6" height="6" rx="1.3"/><rect x="11" y="11" width="6" height="6" rx="1.3"/></svg>`),
    brand:   raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3c3.9 0 7 2.7 7 6 0 2.2-1.8 4-4 4h-1.5a1 1 0 00-.9 1.4l.2.5a1.5 1.5 0 01-1.4 2C6.1 17 3 14 3 10s3.1-7 7-7z"/><circle cx="7" cy="9" r="0.9" fill="currentColor"/><circle cx="10" cy="6.5" r="0.9" fill="currentColor"/><circle cx="13" cy="9" r="0.9" fill="currentColor"/></svg>`),
    audit:   raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/></svg>`),
    settings:raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="2.4"/><path d="M10 2v2M10 16v2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M2 10h2M16 10h2M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>`),
    shield:  raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5l6 2v5.5c0 3.4-2.5 6.4-6 7.5-3.5-1.1-6-4.1-6-7.5V4.5l6-2z"/></svg>`),
    arrowLeft: raw(`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l-6 6 6 6M6 10h11"/></svg>`),
  };

  const isAdmin = u.role === 'admin';

  return html`
    <div class="shell">
      <aside class="sidebar">
        <a href="/hub" class="sidebar-brand" title="${t('Home', 'Accueil')}">
          ${b.logo_data_url
            ? html`<img src="${b.logo_data_url}" alt="" class="logo-mark" style="object-fit: cover; background: transparent;"/>`
            : html`<span class="logo-mark">${initial(b.app_name)}</span>`}
          <span class="brand-name">${b.app_name}</span>
        </a>

        <nav class="sidebar-nav">
          <div class="sidebar-section">${t('Personal', 'Personnel')}</div>
          ${navItem('/hub',     t('Home', 'Accueil'), icons.home,    'home',    opts.activeSection ?? null)}
          ${navItem('/account', t('Profile', 'Profil'),  icons.profile, 'profile', opts.activeSection ?? null)}
          ${isAdmin ? html`
            <div class="sidebar-section">${t('Administration', 'Administration')}</div>
            ${navItem('/admin', t('Dashboard', 'Tableau de bord'), icons.shield, 'admin', opts.activeSection ?? null)}

            <div class="sidebar-section">${t('Accounts', 'Comptes')}</div>
            ${navItem('/admin/users',  t('Users', 'Utilisateurs'), icons.users,  'users',  opts.activeSection ?? null)}
            ${navItem('/admin/groups', t('Groups', 'Groupes'),      icons.groups, 'groups', opts.activeSection ?? null)}

            <div class="sidebar-section">${t('Applications', 'Applications')}</div>
            ${navItem('/admin/clients', t('OIDC applications', 'Applications OIDC'), icons.clients, 'clients', opts.activeSection ?? null)}

            <div class="sidebar-section">${t('Configuration', 'Configuration')}</div>
            ${navItem('/admin/settings', t('Settings', 'Paramètres'), icons.settings, 'settings', opts.activeSection ?? null)}
            ${navItem('/admin/branding', t('Appearance', 'Apparence'),  icons.brand,    'branding', opts.activeSection ?? null)}
            ${navItem('/admin/audit',    t('Audit', 'Audit'),      icons.audit,    'audit',    opts.activeSection ?? null)}
          ` : ''}
        </nav>

        <div class="sidebar-foot">
          <div class="who">
            <span class="avatar">${initial(u.username)}</span>
            <span class="u-name">${u.username}</span>
          </div>
          ${themeToggle()}
          <form method="POST" action="/logout" class="inline">
            ${opts.csrfToken ? html`<input type="hidden" name="csrf" value="${opts.csrfToken}"/>` : ''}
            <button type="submit" class="tbtn" aria-label="${t('Sign out', 'Déconnexion')}" title="${t('Sign out', 'Déconnexion')}">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M12 4h3a1 1 0 011 1v10a1 1 0 01-1 1h-3"/><path d="M9 7l-3 3 3 3M6 10h8"/></svg>
            </button>
          </form>
        </div>
      </aside>

      <main class="content">
        <div class="content-inner${opts.width === 'wide' ? ' wide' : opts.width === 'narrow' ? ' narrow' : ''}">${opts.body}</div>
      </main>
    </div>
  `;
}
