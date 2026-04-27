import type { IncomingMessage, ServerResponse } from 'node:http';
import { provider } from '../oidc/provider.js';
import { Users } from '../models/users.js';
import { Sessions } from '../models/sessions.js';
import { Access } from '../models/access.js';
import { unsign } from '../lib/signed_cookie.js';
import { SESSION_COOKIE } from '../middleware/session.js';
import { t, isLang, runWithLang, DEFAULT_LANG, LANG_COOKIE, type Lang } from '../lib/i18n.js';

/**
 * Raw Node handler (not Hono) for OIDC interaction routes.
 * Reason: provider.interactionFinished() writes directly to the
 * ServerResponse (redirect). Wrapping it in Hono would make Hono
 * also try to write, producing ERR_HTTP_HEADERS_SENT.
 */
export async function handleInteraction(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const m = url.match(/^\/interaction\/([^/?#]+)(?:[/?#]|$)/);
  if (!m) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const uid = m[1]!;

  // langMiddleware does not run on this raw path; resolve manually.
  const cookieHeaderForLang = req.headers.cookie ?? '';
  const langRaw = getCookieValue(cookieHeaderForLang, LANG_COOKIE);
  const lang: Lang = isLang(langRaw) ? langRaw : DEFAULT_LANG;

  return runWithLang(lang, () => handleInteractionInner(req, res, uid), url);
}

async function handleInteractionInner(req: IncomingMessage, res: ServerResponse, uid: string): Promise<void> {
  try {
    const details: any = await provider.interactionDetails(req, res);
    const { prompt, params } = details;

    if (prompt.name === 'login') {
      const cookieHeader = req.headers.cookie ?? '';
      const raw = getCookieValue(cookieHeader, SESSION_COOKIE);
      const sid = raw ? unsign(raw) : null;
      const s = sid ? Sessions.touch(sid) : null;
      if (s) {
        const user = Users.findById(s.user_id);
        if (user && user.enabled && !s.pending_pw_change) {
          const clientId = String(params?.client_id ?? '');
          if (clientId && !Access.canAccess(user.id, clientId)) {
            await provider.interactionFinished(
              req,
              res,
              { error: 'access_denied', error_description: `${t('Access denied to', 'Accès refusé à')} ${clientId}.` },
              { mergeWithLastSubmission: false }
            );
            return;
          }
          await provider.interactionFinished(
            req,
            res,
            { login: { accountId: user.id } },
            { mergeWithLastSubmission: false }
          );
          return;
        }
      }
      // Not signed in: redirect to our /login (with client_id to apply its branding)
      const clientId = params?.client_id ? `&client=${encodeURIComponent(String(params.client_id))}` : '';
      res.statusCode = 302;
      res.setHeader('Location', `/login?next=${encodeURIComponent(`/interaction/${uid}`)}${clientId}`);
      res.end();
      return;
    }

    if (prompt.name === 'consent') {
      let grantId: string | undefined = details.grantId;
      if (!grantId) {
        const grant = new (provider as any).Grant({
          accountId: details.session.accountId,
          clientId: params.client_id,
        });
        const scopes = String(params.scope ?? '').split(' ').filter(Boolean);
        if (scopes.length) grant.addOIDCScope(scopes.join(' '));
        if (prompt.details?.missingOIDCScope) grant.addOIDCScope((prompt.details.missingOIDCScope as string[]).join(' '));
        if (prompt.details?.missingOIDCClaims) grant.addOIDCClaims(prompt.details.missingOIDCClaims);
        if (prompt.details?.missingResourceScopes) {
          for (const [indicator, s] of Object.entries(prompt.details.missingResourceScopes)) {
            grant.addResourceScope(indicator, (s as string[]).join(' '));
          }
        }
        grantId = await grant.save();
      }
      await provider.interactionFinished(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: true }
      );
      return;
    }

    res.statusCode = 400;
    res.end(`Unknown prompt: ${prompt.name}`);
  } catch (err) {
    console.error('[interaction]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal error');
    }
  }
}

function getCookieValue(header: string, name: string): string | null {
  const parts = header.split(';').map((p) => p.trim());
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0 && p.slice(0, eq) === name) {
      try { return decodeURIComponent(p.slice(eq + 1)); }
      catch { return null; }
    }
  }
  return null;
}
