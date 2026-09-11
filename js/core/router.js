/* ============================================================
   GameVerse — روتر هش‌محور (سازگار با GitHub Pages)
   مسیرها به شکل #/games و #/play/memory?mode=solo
   ============================================================ */

import { Bus } from './bus.js';

const routes = [];
let cleanup = null;
let outlet = null;
let notFoundHandler = null;

export function addRoute(pattern, handler) {
  routes.push({ re: new RegExp(`^${pattern}$`), handler });
}

export function navigate(path) {
  const target = '#' + path;
  if (location.hash === target) resolve();
  else location.hash = target;
}

export function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: path || '/', query };
}

async function resolve() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
      window.scrollTo(0, 0);
      Bus.emit('route:changed', { path, query });
      try {
        cleanup = await r.handler({ outlet, params: m.slice(1), query, path });
      } catch (e) {
        console.error('[router]', e);
        outlet.innerHTML = '';
        outlet.append(
          Object.assign(document.createElement('div'), {
            className: 'gv-empty',
            innerHTML: `<div class="icon">💥</div><div class="msg">خطایی رخ داد؛ لطفاً صفحه را دوباره باز کنید.</div>`,
          })
        );
      }
      return;
    }
  }
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  cleanup = await notFoundHandler({ outlet, path });
}

export function startRouter(outletEl, { notFound }) {
  outlet = outletEl;
  notFoundHandler = notFound;
  window.addEventListener('hashchange', resolve);
  resolve();
}
