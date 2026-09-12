/* ============ PlayVerse Sapi — REAL server accounts layer ============
   Talks to the Node backend (see /server). When a server URL is set in
   Settings → Server, ALL accounts live on that server (not just locally):
     register / login / profile sync / global leaderboards / friend requests
     announcements / admin panel. Falls back to local mode when unreachable.
   Admin: the account  mrshash  is auto-admin on the server side.
====================================================================== */
(function(){
'use strict';
const PV = window.PV = window.PV || {};
const U = PV.u;
const { LS } = U;

let state = 'off';                 /* 'ok' | 'fail' | 'off' */
let token = LS.get('sapi:token', null);
let lastProbe = 0;
let onlineCount = 0;
let ws = null, wsTimer = null;

function base(){
  const url = (PV.store.settings.serverUrl||'').trim().replace(/\/+$/,'');
  return url && /^https?:\/\//.test(url) ? url : '';
}
function configured(){ return !!base(); }

async function tfetch(url, opts={}, ms=6000){
  const ac = new AbortController();
  const to = setTimeout(()=>ac.abort(), ms);
  try{ return await fetch(url, {...opts, signal:ac.signal}); }
  finally{ clearTimeout(to); }
}
async function api(path, opts={}, ms){
  const b = base(); if(!b) throw new Error('no server');
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
  if(token) headers.Authorization = 'Bearer '+token;
  const r = await tfetch(b+path, {...opts, headers}, ms);
  let j = null; try{ j = await r.json(); }catch(e){}
  if(!r.ok || !j || j.ok===false){
    const err = new Error((j&&j.why)||('http'+r.status)); err.why = j&&j.why; err.status = r.status;
    throw err;
  }
  return j;
}

/* ------------------------------- probe ---------------------------------- */
async function probe(force){
  if(!configured()){ state='off'; return false; }
  if(!force && state==='ok' && Date.now()-lastProbe < 30000) return true;
  try{
    const j = await api('/api/health', {}, 5000);
    if(j && j.ok){ state='ok'; lastProbe=Date.now(); connectWs(); return true; }
  }catch(e){ state='fail'; closeWs(); }
  return false;
}
function getState(){ return state; }

/* ----------------------------- auth ------------------------------------- */
async function register(u, name, pw){
  u = String(u||'').trim().toLowerCase();
  const j = await api('/api/register', {method:'POST', body:JSON.stringify({username:u, name, password:pw})}, 8000);
  token = j.token; LS.set('sapi:token', token);
  return j.profile;
}
async function login(u, pw){
  u = String(u||'').trim().toLowerCase();
  const j = await api('/api/login', {method:'POST', body:JSON.stringify({username:u, password:pw})}, 8000);
  token = j.token; LS.set('sapi:token', token);
  return j.profile;
}
function hasToken(){ return !!token; }
function logoutSapi(){ token=null; LS.del('sapi:token'); closeWs(); }

/* ------------------------- profile sync --------------------------------- */
function toServerProfile(p){
  return { name:p.name, avatar:p.avatar, bio:p.bio||'', xp:p.xp||0, coins:p.coins||0,
           badges:p.badges||[], stats:p.stats||{}, ratings:p.ratings||{}, friends:p.friends||[] };
}
const pushProfileSoon = U.debounce(async ()=>{
  const p = PV.store.me(); if(!p || PV.store.isGuest() || !token) return;
  try{
    const j = await api('/api/me', {method:'PUT', body:JSON.stringify(toServerProfile(p))});
    if(j && j.profile){ applyServerExtras(j.profile); }
  }catch(e){ if(e.status===401){ token=null; LS.del('sapi:token'); } }
}, 3500);

function applyServerExtras(sp){
  /* server-only flags we surface in the UI */
  const p = PV.store.me(); if(!p) return;
  if(sp.admin !== undefined){ p.svAdmin = !!sp.admin; PV.store.saveProfile(p); }
}

async function pullProfile(){
  if(!token) return null;
  try{
    const j = await api('/api/me');
    return j.profile;
  }catch(e){ return null; }
}

/* merge a server profile into the local one (server wins on fresh stats) */
async function syncIntoLocal(){
  if(!token || PV.store.isGuest()) return false;
  const sp = await pullProfile(); if(!sp) return false;
  const p = PV.store.me(); if(!p) return false;
  if((sp.ts||0) > (p.ts||0)){
    p.xp = Math.max(p.xp||0, sp.xp||0);
    p.coins = Math.max(p.coins||0, sp.coins||0);
    p.badges = [...new Set([...(p.badges||[]), ...(sp.badges||[])])];
    for(const [k,v] of Object.entries(sp.stats||{})){
      if(typeof v==='object') p.stats[k] = Object.assign({}, p.stats[k]||{}, v);
      else p.stats[k] = Math.max(p.stats[k]||0, v||0);
    }
    p.ratings = Object.assign({}, sp.ratings||{}, p.ratings||{});
    if((sp.friends||[]).length > (p.friends||[]).length) p.friends = sp.friends;
    if(sp.name) p.name = p.name || sp.name;
    p.svAdmin = !!sp.admin;
    PV.store.saveProfile(p);
  } else { p.svAdmin = !!sp.admin; PV.store.saveProfile(p); }
  return true;
}

/* ------------------------- scores + boards ------------------------------ */
async function postScore(g, score){
  if(!token) return false;
  try{ await api('/api/score', {method:'POST', body:JSON.stringify({game:g, score})}); return true; }
  catch(e){ return false; }
}
async function topScores(g){
  try{ const j = await api('/api/scores/'+g); return (j.rows||[]).map(r=>({u:r.u, av:r.av, s:r.s, ts:r.ts, lvl:r.lvl})); }
  catch(e){ return null; }
}
async function globalUsers(){
  try{ const j = await api('/api/users'); return j.users||[]; }
  catch(e){ return null; }
}
async function getAnnounce(){
  const j = await api('/api/announce'); return j.announce||null;
}
async function getFlags(){
  try{ const j = await api('/api/flags'); return j.flags||{}; }catch(e){ return null; }
}

/* ---------------------------- friends ----------------------------------- */
async function friendReq(to){ await api('/api/friends/req', {method:'POST', body:JSON.stringify({to})}); return true; }
async function friendAcc(from){ const j = await api('/api/friends/acc', {method:'POST', body:JSON.stringify({from})}); return j.friends||[]; }
async function inbox(){
  try{ const j = await api('/api/inbox'); return j.msgs||[]; }catch(e){ return null; }
}

/* ------------------------------ admin ----------------------------------- */
const admin = {
  async overview(){ return api('/api/admin/overview'); },
  async userAction(u, action, n, on){ return api('/api/admin/user/'+encodeURIComponent(u), {method:'POST', body:JSON.stringify({action, n, on})}); },
  async announce(txt){ return api('/api/admin/announce', {method:'POST', body:JSON.stringify({txt})}); },
  async flags(g, on){ return api('/api/admin/flags', {method:'POST', body:JSON.stringify({game:g, on})}); },
};
function isAdmin(){ const p = PV.store.me(); return !!(p && (p.svAdmin || p.u==='mrshash') && state==='ok'); }

/* --------------------------- WS presence -------------------------------- */
function connectWs(){
  if(!base() || ws || typeof WebSocket==='undefined') return;
  try{
    ws = new WebSocket(base().replace(/^http/,'ws')+'/ws');
    ws.onopen = ()=>{ ws.send(JSON.stringify({t:'hi', u:PV.store.displayName()})); wsTimer = setInterval(()=>{ try{ ws.ping && ws.ping(); }catch(e){} }, 25000); };
    ws.onmessage = ev=>{ try{ const m = JSON.parse(ev.data); if(m.t==='online'||m.t==='hello'){ onlineCount = m.n||onlineCount; document.dispatchEvent(new CustomEvent('pv:sapi')); } }catch(e){} };
    ws.onclose = ()=>{ clearInterval(wsTimer); wsTimer=null; ws=null; };
    ws.onerror = ()=>{ try{ ws.close(); }catch(e){} };
  }catch(e){ ws=null; }
}
function closeWs(){ if(ws){ try{ ws.close(); }catch(e){} ws=null; } clearInterval(wsTimer); wsTimer=null; }
function onlineNow(){ return onlineCount; }

PV.sapi = {
  configured, probe, getState, onlineNow,
  register, login, hasToken, logoutSapi,
  pushProfile: pushProfileSoon, syncIntoLocal, pullProfile,
  postScore, topScores, globalUsers, getAnnounce, getFlags,
  friendReq, friendAcc, inbox, admin, isAdmin,
  get token(){ return token; },
};
})();
