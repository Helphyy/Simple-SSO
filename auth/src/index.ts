import http from 'node:http';
import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import type { AppEnv } from './types.js';
import { config } from './config.js';
import './db/index.js'; // open + run migrations
import { Sessions } from './models/sessions.js';
import { LoginAttempts } from './models/login_attempts.js';
import { loadSession } from './middleware/session.js';
import { securityHeaders } from './middleware/security.js';
import { langMiddleware } from './lib/i18n.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { handleInteraction } from './routes/interaction.js';
import { provider } from './oidc/provider.js';

// ── Hono app (tout sauf /oidc/*) ──
const app = new Hono<AppEnv>();

app.use('*', securityHeaders);
app.use('*', langMiddleware);
app.use('*', loadSession);

app.get('/healthz', (c) => c.json({ status: 'ok' }));

// Tiny client script: theme toggle. Kept here to satisfy CSP script-src 'self'.
const APP_JS = `(function(){
  var root = document.documentElement;
  function apply(t){ root.setAttribute('data-theme', t); }
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      apply(saved);
    } else {
      var def = root.getAttribute('data-default-theme') || 'dark';
      if (def === 'system') {
        var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
        apply(mq && mq.matches ? 'light' : 'dark');
        if (mq && mq.addEventListener) mq.addEventListener('change', function(e){
          try { if (!localStorage.getItem('theme')) apply(e.matches ? 'light' : 'dark'); } catch(_){}
        });
      } else {
        apply(def);
      }
    }
  } catch(e){}
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!t) return;
    var now = root.getAttribute('data-theme') || 'dark';
    var next = now === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('theme', next); } catch(e){}
  });
})();`;
app.get('/assets/app.js', (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(APP_JS);
});

app.get('/', (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');
  return c.redirect('/hub');
});

app.route('/', authRoutes);         // /login, /logout, /change-password
app.route('/admin', adminRoutes);

app.notFound((c) => c.text('Not found', 404));
app.onError((err, c) => {
  console.error('[http error]', err);
  return c.text('Internal error', 500);
});

// ── Node http server : dispatch OIDC vs Hono ──
const honoHandler = getRequestListener(app.fetch);
const oidcHandler = provider.callback();

// Paths que oidc-provider gère (à la racine).
const OIDC_PATH_RE = /^\/(?:auth|token|me|userinfo|jwks|certs|introspection|revocation|session|device|\.well-known)(?:\/|$|\?)/;

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  if (OIDC_PATH_RE.test(url)) {
    oidcHandler(req, res);
    return;
  }
  if (url.startsWith('/interaction/')) {
    // Handler Node raw — ne pas passer par Hono (oidc-provider écrit res directement)
    handleInteraction(req, res).catch((e) => {
      console.error('[interaction]', e);
      if (!res.headersSent) { res.statusCode = 500; res.end('Internal error'); }
    });
    return;
  }
  honoHandler(req, res);
});

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`[auth] listening on :${config.PORT} (${config.NODE_ENV})`);
  console.log(`[auth] public URL: ${config.PUBLIC_URL}`);
});

// ── GC scheduler ──
setInterval(() => {
  try {
    Sessions.gc();
    LoginAttempts.gc();
  } catch (e) {
    console.error('[gc]', e);
  }
}, 60 * 60 * 1000); // 1h

// ── Graceful shutdown ──
const shutdown = (sig: string) => {
  console.log(`[auth] ${sig} received, closing...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
