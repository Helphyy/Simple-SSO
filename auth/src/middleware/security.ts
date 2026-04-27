import type { MiddlewareHandler } from 'hono';
import { config } from '../config.js';

/**
 * Headers de sécurité standard :
 *  - HSTS (prod only, HTTPS)
 *  - X-Content-Type-Options : empêche le MIME sniffing
 *  - X-Frame-Options : empêche le framing (clickjacking)
 *  - Referrer-Policy : ne leake pas l'URL précédente
 *  - CSP : script-src 'self' + HTMX + Tailwind CDN
 *
 * Trade-offs CSP connus, à durcir en prod :
 *  - `style-src 'unsafe-inline'` est requis car Tailwind CDN injecte des
 *    <style> au runtime, et nos vues utilisent style="..." attribute.
 *    Remediation : bundler Tailwind statiquement (npm run build:css) et
 *    remplacer les style-attr par des classes CSS dédiées.
 *  - `script-src https://cdn.tailwindcss.com https://unpkg.com` autorise
 *    deux CDN externes (supply chain risk). Remediation : self-host les
 *    fichiers JS de Tailwind/HTMX.
 *  - Risque XSS résiduel négligeable car notre HTML est entièrement
 *    server-rendered avec auto-escaping (lib/html.ts) — pas de contenu
 *    user-controlled rendu en raw().
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const h = c.res.headers;

  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (config.cookieSecure) {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Pas de CSP sur les routes OIDC (oidc-provider a ses propres réponses JSON)
  const url = new URL(c.req.url);
  if (!url.pathname.startsWith('/oidc') && url.pathname !== '/.well-known/openid-configuration') {
    h.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://fonts.googleapis.com",
        "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com",
        "connect-src 'self'",
        "font-src 'self' data: https://fonts.gstatic.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }
};

export function getClientIp(c: any): string {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return c.req.header('x-real-ip') ?? c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
