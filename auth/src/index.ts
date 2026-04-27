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

  // ── Searchable picker ───────────────────────────────────────────
  // Markup:
  //   <div class="picker" data-picker data-name="users">
  //     <div class="picker-chips" data-chips></div>
  //     <div class="picker-search">
  //       <input type="text" data-picker-input placeholder="Search..."/>
  //       <div class="picker-list" data-list hidden>
  //         <button type="button" class="picker-option" data-id="..." data-label="..." data-sub="..."> ... </button>
  //       </div>
  //     </div>
  //   </div>
  //   On submit, hidden <input name="<data-name>" value="<chip-id>"> elements are emitted for each chip.
  function setupPickers() {
    var pickers = document.querySelectorAll('[data-picker]');
    for (var i = 0; i < pickers.length; i++) initPicker(pickers[i]);
  }
  function initPicker(root) {
    var name = root.getAttribute('data-name') || 'items';
    var chipsEl = root.querySelector('[data-chips]');
    var input = root.querySelector('[data-picker-input]');
    var list = root.querySelector('[data-list]');
    var options = list ? list.querySelectorAll('.picker-option') : [];
    var selected = {};

    // Read pre-selected chips (rendered server-side as data-id on existing chips)
    var initial = chipsEl ? chipsEl.querySelectorAll('[data-chip]') : [];
    for (var j = 0; j < initial.length; j++) {
      var id = initial[j].getAttribute('data-id');
      if (id) selected[id] = { label: initial[j].getAttribute('data-label') || id, sub: initial[j].getAttribute('data-sub') || '' };
    }
    render();

    function render() {
      chipsEl.innerHTML = '';
      var ids = Object.keys(selected);
      if (ids.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'picker-empty';
        empty.textContent = chipsEl.getAttribute('data-empty') || 'None';
        chipsEl.appendChild(empty);
      }
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k];
        var info = selected[id];
        var chip = document.createElement('span');
        chip.className = 'picker-chip';
        chip.setAttribute('data-chip', '');
        chip.setAttribute('data-id', id);
        chip.setAttribute('data-label', info.label);
        if (info.sub) chip.setAttribute('data-sub', info.sub);
        chip.innerHTML = '<span class="picker-chip-label"></span><button type="button" class="picker-chip-x" aria-label="Remove">&times;</button>';
        chip.querySelector('.picker-chip-label').textContent = info.label;
        chip.querySelector('.picker-chip-x').addEventListener('click', (function(idLocal){
          return function(){ delete selected[idLocal]; refreshOptions(); render(); syncHidden(); };
        })(id));
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = name;
        hidden.value = id;
        chip.appendChild(hidden);
        chipsEl.appendChild(chip);
      }
    }
    function syncHidden() { /* hidden inputs are part of chips → re-rendered every time */ }
    function refreshOptions() {
      for (var i = 0; i < options.length; i++) {
        var oid = options[i].getAttribute('data-id');
        options[i].style.display = selected[oid] ? 'none' : '';
      }
    }
    function filter() {
      var q = (input.value || '').trim().toLowerCase();
      for (var i = 0; i < options.length; i++) {
        var lbl = (options[i].getAttribute('data-label') || '').toLowerCase();
        var sub = (options[i].getAttribute('data-sub') || '').toLowerCase();
        var match = !q || lbl.indexOf(q) !== -1 || sub.indexOf(q) !== -1;
        var oid = options[i].getAttribute('data-id');
        options[i].style.display = (match && !selected[oid]) ? '' : 'none';
      }
    }
    refreshOptions();
    input.addEventListener('focus', function(){ list.hidden = false; });
    input.addEventListener('input', filter);
    input.addEventListener('keydown', function(e){ if (e.key === 'Escape') { list.hidden = true; input.blur(); } });
    document.addEventListener('click', function(e){
      if (!root.contains(e.target)) list.hidden = true;
    });
    for (var m = 0; m < options.length; m++) {
      options[m].addEventListener('click', (function(opt){
        return function(){
          var id = opt.getAttribute('data-id');
          selected[id] = {
            label: opt.getAttribute('data-label') || id,
            sub: opt.getAttribute('data-sub') || '',
          };
          input.value = '';
          filter();
          render();
        };
      })(options[m]));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPickers);
  } else { setupPickers(); }
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
