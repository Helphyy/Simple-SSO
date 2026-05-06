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
        "img-src 'self' data: https:",
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

/**
 * Returns the client IP, respecting TRUST_PROXY_COUNT.
 *
 * X-Forwarded-For grows left-to-right as the request transits proxies:
 *   client, proxy1, proxy2, …
 * If we trust N proxies in front, the real client IP is at index
 * `length - 1 - N` from the right (the rightmost N entries are our trusted
 * hops, anything before them is attacker-controlled).
 *
 * With TRUST_PROXY_COUNT=0, X-Forwarded-For is ignored entirely (direct
 * connection assumed) — required to avoid IP spoofing when the service is
 * exposed without a reverse proxy.
 */
export function getClientIp(c: any): string {
  const trust = config.TRUST_PROXY_COUNT;
  if (trust > 0) {
    const fwd = c.req.header('x-forwarded-for');
    if (fwd) {
      const parts = fwd.split(',').map((s: string) => s.trim()).filter(Boolean);
      const idx = parts.length - trust;
      if (idx >= 0 && idx < parts.length) return parts[idx]!;
      if (parts.length) return parts[0]!;
    }
    const real = c.req.header('x-real-ip');
    if (real) return real.trim();
  }
  return c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
