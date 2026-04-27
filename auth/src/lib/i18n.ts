import { AsyncLocalStorage } from 'node:async_hooks';
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

export type Lang = 'en' | 'fr';
export const SUPPORTED_LANGS: Lang[] = ['en', 'fr'];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lang';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (SUPPORTED_LANGS as string[]).includes(v);
}

interface I18nContext { lang: Lang; path: string }

const store = new AsyncLocalStorage<I18nContext>();

export function getLang(): Lang {
  return store.getStore()?.lang ?? DEFAULT_LANG;
}

export function getRequestPath(): string {
  return store.getStore()?.path ?? '/';
}

export function runWithLang<T>(lang: Lang, fn: () => T, path: string = '/'): T {
  return store.run({ lang, path }, fn);
}

/**
 * Pick the localized string. Default language is English.
 * Usage: t('Save', 'Enregistrer')
 */
export function t(en: string, fr: string): string {
  return getLang() === 'fr' ? fr : en;
}

/**
 * Translate a Zod issue. Used because Zod schemas are constructed at module
 * load time, before any request — calling t() inside .regex(msg) would freeze
 * the language to the default. Schemas should pass a sentinel code; this
 * function maps codes to per-request localized text.
 */
export function translateZodMessage(message: string): string {
  switch (message) {
    case 'INVALID_USERNAME_FORMAT':
      return t('Invalid username format.', 'Format identifiant invalide.');
    case 'INVALID_GROUP_NAME':
      return t('Invalid group name.', 'Nom de groupe invalide.');
    case 'INVALID_CLIENT_ID':
      return t('Invalid Client ID.', 'Client ID invalide.');
    default:
      return message;
  }
}

// ── Zod error map (per-request localized) ─────────────────────────
// Replaces Zod's English defaults with FR/EN strings via getLang().
// Evaluated at parse time, so it picks up the request language.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t('Required.', 'Requis.') };
      }
      return { message: t(`Expected ${issue.expected}, received ${issue.received}.`, `Attendu ${issue.expected}, reçu ${issue.received}.`) };
    case 'invalid_string':
      if (issue.validation === 'email') return { message: t('Invalid email.', 'Email invalide.') };
      if (issue.validation === 'url')   return { message: t('Invalid URL.', 'URL invalide.') };
      if (issue.validation === 'regex') return { message: translateZodMessage(ctx.defaultError) };
      return { message: t('Invalid string.', 'Chaîne invalide.') };
    case 'too_small':
      if (issue.type === 'string') {
        if (issue.minimum === 1) return { message: t('Required.', 'Requis.') };
        return { message: t(`At least ${issue.minimum} characters.`, `${issue.minimum} caractères minimum.`) };
      }
      if (issue.type === 'number') return { message: t(`Must be ${issue.minimum} or more.`, `Doit être ≥ ${issue.minimum}.`) };
      return { message: ctx.defaultError };
    case 'too_big':
      if (issue.type === 'string') return { message: t(`At most ${issue.maximum} characters.`, `${issue.maximum} caractères maximum.`) };
      if (issue.type === 'number') return { message: t(`Must be ${issue.maximum} or less.`, `Doit être ≤ ${issue.maximum}.`) };
      return { message: ctx.defaultError };
    case 'invalid_enum_value':
      return { message: t('Invalid value.', 'Valeur invalide.') };
    case 'invalid_literal':
      return { message: t('Invalid value.', 'Valeur invalide.') };
    default:
      return { message: ctx.defaultError };
  }
});

export const langMiddleware: MiddlewareHandler = async (c, next) => {
  const cookie = getCookie(c, LANG_COOKIE);
  const lang: Lang = isLang(cookie) ? cookie : DEFAULT_LANG;
  const url = new URL(c.req.url);
  await runWithLang(lang, () => next(), url.pathname + url.search);
};

export function setLangCookie(c: Parameters<MiddlewareHandler>[0], lang: Lang): void {
  setCookie(c, LANG_COOKIE, lang, {
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false,
  });
}
