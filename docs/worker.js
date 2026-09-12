/**
 * PlayVerse — Cloudflare Worker (free tier) world-state backend.
 * ۵ دقیقه راه‌اندازی:
 *  1) dash.cloudflare.com → Workers & Pages → Create Worker
 *  2) کل این فایل را paste کنید و Deploy بزنید
 *  3) آدرس https://<name>.<account>.workers.dev را در پنل مدیریت پلی‌ورس
 *     (مدیریت → آدرس بک‌اند سفارشی) ذخیره کنید.
 *
 * API (همان قرارداد cloud.js):
 *   GET  /          → world JSON
 *   PUT  /          → replace world (Body: JSON)
 * Optionally protect writes: set env var WRITE_KEY and send header X-Key.
 */

const KV_READY = typeof caches !== 'undefined'; // workers always have KV via bindings? We use Durable-free approach: store in memory of a single Worker is NOT durable — use Workers KV.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,If-Match,X-Key',
      'Access-Control-Expose-Headers': 'ETag',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (!env.WORLD) {
      return json({ error: 'Bind a KV namespace as WORLD (Settings → Variables → KV Namespace Bindings)' }, 500, CORS);
    }
    if (env.WRITE_KEY && request.method === 'PUT' && request.headers.get('X-Key') !== env.WRITE_KEY) {
      return json({ error: 'unauthorized' }, 401, CORS);
    }

    if (request.method === 'GET') {
      const val = await env.WORLD.get('world');
      const data = val ? val : JSON.stringify({ v: 1, ts: 0, users: {}, scores: {}, inbox: {}, announce: null, flags: {}, cats: [], stats: { matches: 0 } });
      const etag = `"${await sha256(data)}"`;
      return new Response(data, {
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ETag: etag, 'Cache-Control': 'no-store' },
      });
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await request.text();
      try { JSON.parse(body); } catch { return json({ error: 'bad json' }, 400, CORS); }
      await env.WORLD.put('world', body);
      const etag = `"${await sha256(body)}"`;
      return new Response(body, { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ETag: etag } });
    }

    return json({ error: 'method' }, 405, CORS);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
