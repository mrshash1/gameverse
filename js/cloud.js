/* ============ PlayVerse Cloud — world sync (provider chain + honest degradation) ============
   Providers (in order):
   1) Custom endpoint (settings.endpoint) — any URL answering GET / PUT with JSON
   2) jsonblob.com auto-created world blob
   3) Offline (localStorage only) — always functional, honestly labeled
   Passwords are stored as salted SHA-256 hashes only. Never send plaintext.
========================================================================================= */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { LS, sha256hex, randomSalt, debounce } = U;

let state = 'off';            // 'ok' | 'off' | 'fail'
let etag = null;
let world = null;
let writing = false, lastWrite = 0, pendingMut = null;

const JSONBLOB_KEY = 'cloud:jsonblobId';
async function tfetch(url, opts={}, ms=4500){
  const ac = new AbortController();
  const to = setTimeout(()=>ac.abort(), ms);
  try{ return await fetch(url, {...opts, signal: ac.signal}); }
  finally{ clearTimeout(to); }
}
function jsonblobId(){ return LS.get(JSONBLOB_KEY, null); }
const CFG = window.SRV_CONFIG || null;
let lastMiss = false;   /* jsonblob 404 → safe to recreate */

function cfgProvider(){
  if(CFG && CFG.provider==='textdb' && CFG.key) return {name:'textdb', key:String(CFG.key), etagOk:false};
  return null;
}
function provider(){
  const ep = (PV.store.settings.endpoint||'').trim();
  if(ep) return {name:'custom', url:ep, etagOk:true};
  const c = cfgProvider();
  if(c) return c;
  const id = jsonblobId();
  if(id) return {name:'jsonblob', url:'https://jsonblob.com/api/jsonBlob/'+id, etagOk:true};
  return null;
}
/* --- textdb.online driver: CORS *, reads always 200 (empty body = not created yet),
       writes via POST form to /update (NO trailing slash — /update/ 301 would drop the body) --- */
async function tdRead(key){
  const r = await tfetch('https://textdb.online/'+key+'?_='+Date.now(), {cache:'no-store', headers:{'Accept':'text/plain'}}, 7000);
  if(!r.ok) throw 0;
  return (await r.text()||'').trim();
}
async function tdWrite(key, obj){
  const body = 'key='+encodeURIComponent(key)+'&value='+encodeURIComponent(JSON.stringify(obj));
  const r = await tfetch('https://textdb.online/update', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body}, 12000);
  if(!r.ok) return false;
  try{ const j = await r.json(); if(j && j.status===0) return false; }catch(e){}
  return true;
}

async function probe(){
  state = 'off'; lastMiss = false;
  const p = provider();
  if(!p) return false;
  const w = await pull();
  if(state==='ok') return true;
  /* self-heal: only when the provider says the record is GONE (404), never on garbage */
  if(p.name==='jsonblob' && lastMiss){
    try{
      const r2 = await tfetch('https://jsonblob.com/api/jsonBlob', {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(blankWorld())});
      if(r2.ok){
        const loc = r2.headers.get('Location') || r2.headers.get('X-jsonblob');
        const id = (loc||'').split('/').pop();
        if(id){ LS.set(JSONBLOB_KEY, id); state='ok'; etag=r2.headers.get('ETag'); world=blankWorld(); return true; }
      }
    }catch(e2){}
  }
  state = 'fail';
  return false;
}
async function createWorld(){
  const c = cfgProvider();
  if(c && c.name==='textdb'){
    const w = blankWorld();
    if(await tdWrite(c.key, w)){ world = w; state='ok'; return true; }
  }
  try{
    const r = await tfetch('https://jsonblob.com/api/jsonBlob', {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(blankWorld())});
    if(!r.ok) return false;
    const loc = r.headers.get('Location') || r.headers.get('X-jsonblob');
    const id = (loc||'').split('/').pop();
    if(!id) return false;
    LS.set(JSONBLOB_KEY, id);
    state = 'ok';
    return true;
  }catch(e){ return false; }
}
function blankWorld(){ return {v:1, ts:Date.now(), users:{}, scores:{}, inbox:{}, announce:null, flags:{}, cats:[], stats:{matches:0}, meta:{app:'playverse', admins:['mrshash']}}; }

async function pull(){
  const p = provider(); if(!p) return null;
  try{
    let txt = null;
    if(p.name==='textdb'){
      txt = await tdRead(p.key);
      if(txt===''){ world = blankWorld(); state='ok'; return world; }  /* first ever read → will be created on first write */
    } else {
      const r = await tfetch(p.url + (p.url.includes('?')?'&':'?') + '_=' + Date.now(), {cache:'no-store', headers:{'Accept':'application/json'}});
      if(!r.ok){ if(p.name==='jsonblob') lastMiss = true; throw 0; }
      etag = r.headers.get('ETag');
      txt = await r.text();
    }
    const w = JSON.parse(txt);
    /* strict validation: garbage/corrupted world must NEVER blank-overwrite the real data */
    if(!w || typeof w!=='object' || !w.users || typeof w.users!=='object') throw 0;
    world = w;
    state = 'ok';
    return world;
  }catch(e){ state='fail'; return null; }
}

async function push(next){
  const p = provider(); if(!p) return false;
  if(next) world = next;
  if(!world) return false;
  world.ts = Date.now();
  try{
    if(p.name==='textdb'){
      if(!await tdWrite(p.key, world)) throw 0;
      state='ok';
      return true;
    }
    const headers = {'Content-Type':'application/json','Accept':'application/json'};
    if(p.etagOk && etag) headers['If-Match'] = etag;
    const r = await tfetch(p.url, {method:'PUT', headers, body:JSON.stringify(world)});
    if(r.status===412){ etag=null; return false; }   // conflict → caller retries after pull
    if(!r.ok) throw 0;
    etag = r.headers.get('ETag') || etag;
    state='ok';
    return true;
  }catch(e){ state='fail'; return false; }
}

/* read-modify-write with retry */
async function mutate(fn, tries=3){
  for(let i=0;i<tries;i++){
    await pull();
    if(state!=='ok') return null;
    const snapshot = JSON.stringify(world);
    fn(world);
    if(await push(world)) return world;
    await pull();
    if(JSON.stringify(world)!==snapshot) continue;
  }
  return null;
}

/* ---- debounced profile push ---- */
const pushProfileSoon = U.debounce(async ()=>{
  const p = PV.store.me(); if(!p || PV.store.isGuest()) return;
  if(PV.sapi && PV.sapi.configured() && PV.sapi.hasToken()){ if(await PV.sapi.probe()){ PV.sapi.pushProfile(); return; } }
  await ensure();
  if(state!=='ok') return;
  await mutate(w=>{
    const u = p.u.toLowerCase();
    const rec = w.users[u] ||= {u:p.u, created:p.created, salt:p.salt||'', ph:p.ph||'', svAdmin:!!(p.svAdmin||u==='mrshash')};
    /* make sure the server record can authenticate on other devices */
    if(p.salt && !rec.salt) rec.salt = p.salt;
    if(p.ph && !rec.ph) rec.ph = p.ph;
    if(u==='mrshash') rec.svAdmin = true;
    rec.name = p.name; rec.avatar = p.avatar; rec.bio = p.bio||'';
    rec.lvl = (PV.u.levelFromXp(p.xp)).level;
    rec.ratings = p.ratings; rec.friends = p.friends||[];
    rec.prof = {xp:p.xp, coins:p.coins, stats:p.stats, best:p.stats.best, ts:Date.now()};
  });
}, 4000);

async function ensure(){
  if(state==='ok') return true;
  if(state==='off'){ const p=provider(); if(!p) return false; }
  const ok = await probe();
  if(!ok && provider()===null) ok2: { if(await createWorld()){ await push(); } }
  return state==='ok';
}

/* ---- auth ---- */
async function register(u, name, pw){
  u = (u||'').trim().toLowerCase();
  /* ---------- REAL SERVER first: accounts live on the server ---------- */
  if(PV.sapi && PV.sapi.configured()){
    const up = await PV.sapi.probe(true);
    if(up){
      try{
        const sp = await PV.sapi.register(u, name, pw);
        const prof = PV.store.blankProfile(u, (sp&&sp.name)||name);
        prof.cloud = true; prof.svAdmin = !!(sp&&sp.admin);
        PV.store.saveProfile(prof);
        PV.store.login(u, prof.name);
        PV.sapi.pushProfile();
        setTimeout(()=>syncFromCloudSoon(), 600);
        return {ok:true, server:true};
      }catch(e){
        if(e && (e.why==='taken')) return {ok:false, why:'taken'};
        if(e && (e.why==='user'||e.why==='pw'||e.why==='rate')) return {ok:false, why:'sv'};
        /* server unreachable → fall through to local */
      }
    }
  }
  const salt = randomSalt();
  const ph = await sha256hex(salt+'::'+pw);
  // local first
  if(PV.store.loadProfile(u)) return {ok:false, why:'taken'};
  const prof = PV.store.blankProfile(u, name);
  prof.salt = salt; prof.ph = ph; prof.cloud = false;
  PV.store.saveProfile(prof);
  PV.store.login(u, name);
  // cloud attempt
  await ensure();
  if(state==='ok'){
    const w = await mutate(x=>{
      const key = u;
      if(x.users[key]) { throw 'taken'; }
      const admin = u==='mrshash' || !!(((x.meta&&x.meta.admins)||[]).includes(u));
      x.users[key] = {u, name, salt, ph, created:Date.now(), lvl:1, ratings:{}, friends:[], svAdmin:admin, prof:{xp:0,coins:100,stats:{},best:{},ts:Date.now()}};
    });
    if(w){
      prof.cloud = true; prof.svAdmin = !!w.users[u].svAdmin; PV.store.saveProfile(prof);
      return {ok:true};
    }
    return {ok:true, localOnly:true};
  }
  return {ok:true, localOnly:true};
}

async function login(u, pw){
  u = (u||'').trim().toLowerCase();
  /* ---------- REAL SERVER first ---------- */
  if(PV.sapi && PV.sapi.configured()){
    const up = await PV.sapi.probe(true);
    if(up){
      try{
        const sp = await PV.sapi.login(u, pw);
        const prof = PV.store.loadProfile(u) || PV.store.blankProfile(u, (sp&&sp.name)||u);
        prof.u = u; prof.cloud = true; prof.svAdmin = !!(sp&&sp.admin);
        prof.xp = Math.max(prof.xp||0, (sp&&sp.xp)||0);
        prof.coins = Math.max(prof.coins||0, (sp&&sp.coins)||0);
        if(sp){
          prof.badges = [...new Set([...(prof.badges||[]), ...(sp.badges||[])])];
          for(const [k,v] of Object.entries(sp.stats||{})){
            if(typeof v==='object') prof.stats[k] = Object.assign({}, prof.stats[k]||{}, v);
            else if(typeof v==='number') prof.stats[k] = Math.max(prof.stats[k]||0, v);
          }
          prof.ratings = Object.assign({}, sp.ratings||{}, prof.ratings||{});
          if((sp.friends||[]).length > (prof.friends||[]).length) prof.friends = sp.friends;
        }
        PV.store.saveProfile(prof);
        PV.store.login(u, prof.name);
        setTimeout(()=>syncFromCloudSoon(), 500);
        return {ok:true, server:true};
      }catch(e){
        if(e && (e.why==='nf')) return {ok:false, why:'nf'};
        if(e && (e.why==='pw')) return {ok:false, why:'pw'};
        if(e && (e.why==='banned')) return {ok:false, why:'banned'};
        /* server unreachable → local fallback */
      }
    }
  }
  // local check first (instant + offline)
  const lp = PV.store.loadProfile(u);
  if(lp && lp.ph){
    const h = await sha256hex((lp.salt||'')+'::'+pw);
    if(h === lp.ph){
      PV.store.login(u, lp.name);
      const p = PV.store.me(); p.cloud = !!lp.cloud; PV.store.saveProfile(p);
      syncFromCloudSoon();
      return {ok:true, localOnly:!lp.cloud};
    }
    // wrong local password → try cloud before failing
  }
  await ensure();
  if(state==='ok'){
    await pull();
    const rec = world && world.users[u];
    if(!rec || !rec.ph) return {ok:false, why:'nf'};
    if(rec.banned) return {ok:false, why:'banned'};
    const h = await sha256hex(rec.salt+'::'+pw);
    if(h!==rec.ph) return {ok:false, why:'pw'};
    // pull cloud profile into local
    const prof = PV.store.blankProfile(u, rec.name||u);
    prof.salt = rec.salt; prof.ph = rec.ph; prof.cloud = true;
    prof.created = rec.created || Date.now();
    if(rec.prof){
      prof.xp = rec.prof.xp||0; prof.coins = rec.prof.coins??100;
      Object.assign(prof.stats, rec.prof.stats||{});
      prof.stats.best = rec.prof.best||{};
    }
    prof.ratings = rec.ratings||{};
    prof.friends = rec.friends||[];
    /* protect an existing LOCAL profile of the same username from being wiped */
    const exist = PV.store.loadProfile(u);
    if(exist){
      prof.avatar = exist.avatar || prof.avatar;
      prof.bio = exist.bio || prof.bio;
      prof.xp = Math.max(prof.xp||0, exist.xp||0);
      prof.coins = Math.max(prof.coins||0, exist.coins||0);
      prof.badges = [...new Set([...(prof.badges||[]), ...(exist.badges||[])])];
      prof.friends = [...new Set([...(prof.friends||[]), ...(exist.friends||[])])];
      for(const [k,v] of Object.entries(exist.stats||{})){
        if(typeof v==='object') prof.stats[k] = Object.assign({}, v, prof.stats[k]||{});
        else if(typeof v==='number') prof.stats[k] = Math.max(v, prof.stats[k]||0);
      }
      if(exist.history && exist.history.length) prof.history = exist.history;
      prof.created = exist.created || prof.created;
    }
    prof.svAdmin = !!(rec.svAdmin || u==='mrshash');
    PV.store.saveProfile(prof);
    PV.store.login(u, prof.name);
    return {ok:true};
  }
  if(lp) return {ok:false, why:'pw'};
  return {ok:false, why:'nf'};
}

/* ---- change password (task 3-g): verify old pw with the SAME salt+SHA-256
   routine used at register/login, then rotate salt+ph locally and push to the
   cloud world. Server (sapi) accounts keep their password on the server — we
   honestly report {why:'nopw'} when no salted record exists anywhere. ------ */
async function changePassword(u, oldPw, newPw){
  u = String(u||'').trim().toLowerCase();
  const p = PV.store.me();
  if(!p || PV.store.isGuest() || String(p.u).toLowerCase()!==u) return {ok:false, why:'auth'};
  newPw = String(newPw||'');
  if(newPw.length<6) return {ok:false, why:'weak'};
  /* locate the authoritative salted record: local profile first, cloud world second */
  let salt = p.salt||'', ph = p.ph||'';
  await ensure();
  let rec = null;
  if(state==='ok'){
    await pull();
    rec = world && world.users && world.users[u];
    if(rec && rec.ph && !(salt && ph)){ salt = rec.salt||''; ph = rec.ph; }
  }
  if(!(salt && ph)) return {ok:false, why:'nopw'};
  const hOld = await sha256hex(salt+'::'+String(oldPw||''));
  if(hOld !== ph) return {ok:false, why:'pw'};
  const nsalt = randomSalt();
  const nph = await sha256hex(nsalt+'::'+newPw);
  p.salt = nsalt; p.ph = nph; PV.store.saveProfile(p);
  let synced = false;
  if(state==='ok' && rec){
    try{ synced = !!(await mutate(w=>{ const r=w.users[u]; if(!r) throw 'nf'; r.salt=nsalt; r.ph=nph; })); }catch(e){ synced=false; }
    if(!synced){ try{ synced = !!(await mutate(w=>{ const r=w.users[u]; if(r){ r.salt=nsalt; r.ph=nph; } })); }catch(e){ synced=false; } }
  }
  return {ok:true, cloud:synced, localOnly:!synced};
}

const syncFromCloudSoon = U.debounce(async ()=>{
  if(PV.store.isGuest() || !PV.store.session) return;
  /* REAL SERVER sync (profile + server inbox → notifications) */
  if(PV.sapi && PV.sapi.configured() && PV.sapi.hasToken()){
    if(await PV.sapi.probe()){
      await PV.sapi.syncIntoLocal();
      const msgs = await PV.sapi.inbox();
      const p2 = PV.store.me();
      if(msgs && msgs.length && p2){
        const notifs = LS.get('notifs:'+p2.u, []);
        const known = new Set(notifs.map(n=>n.id));
        for(const m of msgs){
          if(known.has(m.id)) continue;
          notifs.unshift({id:m.id, type:m.type==='req'?'req':'sys', txt:m.txt||(m.name+' تو را به دوستی دعوت کرد'), from:m.name||m.from, ts:m.ts, read:false});
        }
        LS.set('notifs:'+p2.u, notifs.slice(0,60));
        document.dispatchEvent(new CustomEvent('pv:notif'));
      }
      return;
    }
  }
  await ensure();
  if(state!=='ok') return;
  const key = PV.store.session.u.toLowerCase();
  const w = world;
  const rec = w && w.users[key];
  const p = PV.store.me();
  if(rec && p){
    // merge: cloud may be newer
    const cTs = rec.prof?.ts || 0;
    if(cTs > (p.ts||0)){
      p.xp = Math.max(p.xp, rec.prof?.xp||0);
      p.coins = Math.max(p.coins, rec.prof?.coins||0);
      p.ratings = Object.assign({}, rec.ratings, p.ratings);
      if(!p.friends.length && rec.friends) p.friends = rec.friends;
      PV.store.saveProfile(p);
    }
    // inbox → notifications
    const inbox = (w.inbox||{})[key]||[];
    if(inbox.length){
      const notifs = LS.get('notifs:'+p.u, []);
      const known = new Set(notifs.map(n=>n.id));
      for(const m of inbox){
        if(known.has(m.id)) continue;
        notifs.unshift({id:m.id, type:m.type, txt:m.txt, from:m.from, ts:m.ts, read:false});
      }
      LS.set('notifs:'+p.u, notifs.slice(0,60));
      LS.set('inboxseen:'+p.u, Date.now());
      document.dispatchEvent(new CustomEvent('pv:notif'));
    }
  }
}, 1500);

/* friend requests via REAL SERVER or cloud inbox */
async function sendFriendReq(fromP, toU){
  if(PV.sapi && PV.sapi.configured() && PV.sapi.hasToken()){
    if(await PV.sapi.probe()){
      try{ await PV.sapi.friendReq(toU); return true; }
      catch(e){ if(e && (e.why==='nf')) return false; return false; }
    }
  }
  await ensure();
  if(state!=='ok') return false;
  const ok = await mutate(w=>{
    const k = toU.toLowerCase();
    if(!w.users[k]) throw 'nf';
    const arr = w.inbox[k] ||= [];
    if(arr.some(m=>m.type==='req' && m.from===fromP.u)) throw 'dup';
    arr.push({id:U.uid(10), type:'req', from:fromP.u, name:fromP.name, av:fromP.avatar, ts:Date.now(), txt:''});
    if(arr.length>40) arr.splice(0, arr.length-40);
  }).catch?.(()=>{}) ?? null;
  return !!ok || state==='ok';
}
async function cloudFriendsBoth(me, other){ /* used on accept: write both friends lists */
  if(PV.sapi && PV.sapi.configured() && PV.sapi.hasToken()){
    if(await PV.sapi.probe()){
      try{ await PV.sapi.friendAcc(other); }catch(e){}
    }
  }
  await ensure();
  if(state!=='ok') return false;
  await mutate(w=>{
    for(const uname of [me.u, other]){
      const k = uname.toLowerCase();
      const rec = w.users[k];
      if(!rec) continue;
      rec.friends ||= [];
      const otherName = (uname===me.u) ? other : me.name;
      if(!rec.friends.some(f=>f.toLowerCase()===otherName.toLowerCase())) rec.friends.push(otherName);
    }
  });
  return true;
}
async function postScore(g, score){
  const p = PV.store.me(); if(!p || PV.store.isGuest() || score==null) return false;
  if(PV.sapi && PV.sapi.configured() && PV.sapi.hasToken()){ if(await PV.sapi.probe()){ PV.sapi.postScore(g, score); } }
  await ensure();
  if(state!=='ok') return false;
  await mutate(w=>{
    const arr = w.scores[g] ||= [];
    arr.push({u:p.name, av:p.avatar, s:Math.round(score), ts:Date.now(), lvl:(PV.u.levelFromXp(p.xp)).level});
    arr.sort((a,b)=>b.s-a.s);
    if(arr.length>120) arr.length = 120;
    w.stats.matches = (w.stats.matches||0)+1;
  });
  return true;
}
async function topScores(g){
  if(PV.sapi && PV.sapi.configured()){
    const rows = await PV.sapi.topScores(g);
    if(rows) return rows;
  }
  if(state!=='ok') return PV.store.localScores(g);
  try{
    await pull();
    return (world && world.scores && world.scores[g]) || [];
  }catch(e){ return PV.store.localScores(g); }
}
async function topScoresOld(g){
  await ensure();
  if(state==='ok'){
    await pull();
    return (world && world.scores && world.scores[g]) || [];
  }
  return PV.store.localScores(g);
}
async function globalBoard(){
  if(PV.sapi && PV.sapi.configured()){
    const users = await PV.sapi.globalUsers();
    if(users) return users.slice(0,50);
  }
  if(state!=='ok') return localUsersList();
  try{
    await pull();
    const users = Object.values((world&&world.users)||{}).map(r=>({u:r.name||r.u, av:r.avatar||'fox', lvl:r.lvl||1, xp:r.prof?.xp||0}));
    users.sort((a,b)=>b.xp-a.xp);
    return users.slice(0,50);
  }catch(e){ return localUsersList(); }
}
async function globalBoardOld(){
  await ensure();
  if(state==='ok'){
    await pull();
    const users = Object.values((world&&world.users)||{}).map(r=>({u:r.name||r.u, av:r.avatar||'fox', lvl:r.lvl||1, xp:r.prof?.xp||0}));
    users.sort((a,b)=>b.xp-a.xp);
    return users.slice(0,50);
  }
  return localUsersList();
}
function localUsersList(){
  return PV.store.localUsers().map(u=>{
    const p = PV.store.loadProfile(u);
    return p && {u:p.name||u, av:p.avatar, lvl:(PV.u.levelFromXp(p.xp)).level, xp:p.xp};
  }).filter(Boolean).sort((a,b)=>b.xp-a.xp);
}
async function setAnnounce(txt){
  if(PV.sapi && PV.sapi.configured() && PV.sapi.isAdmin()){
    if(await PV.sapi.probe()){ try{ await PV.sapi.admin.announce(txt); return true; }catch(e){ return false; } }
  }
  await ensure(); if(state!=='ok') return false;
  return !!(await mutate(w=>{ w.announce = txt? {txt, ts:Date.now()} : null; }));
}
async function getAnnounce(){
  if(PV.sapi && PV.sapi.configured()){
    try{ return await PV.sapi.getAnnounce(); }catch(e){ /* fall through */ }
  }
  await ensure(); if(state!=='ok') return null;
  await pull();
  return (world && world.announce) || null;
}
async function setCats(arr){ await ensure(); if(state!=='ok'){ LS.set('cats', arr); return false; } return !!(await mutate(w=>{ w.cats = arr; })); }
async function getCats(){ const local = LS.get('cats', []); await ensure(); if(state!=='ok') return local; await pull(); return (world && world.cats) || local; }
async function setFlag(gid, on){
  if(PV.sapi && PV.sapi.configured() && PV.sapi.isAdmin()){
    if(await PV.sapi.probe()){ try{ await PV.sapi.admin.flags(gid, on); }catch(e){} }
  }
  await ensure(); if(state!=='ok'){ const f=LS.get('flags',{}); f[gid]=on; LS.set('flags',f); return false; } return !!(await mutate(w=>{ w.flags[gid]=on; })); }
async function getFlags(){
  if(PV.sapi && PV.sapi.configured()){ const f = await PV.sapi.getFlags(); if(f) return f; }
  await ensure(); if(state!=='ok') return LS.get('flags',{}); await pull(); return (world && world.flags) || {}; }
async function worldInfo(){
  if(PV.sapi && PV.sapi.configured() && await PV.sapi.probe()){
    const users = await PV.sapi.globalUsers();
    return {state:'ok', server:true, users:users? users.length : 0, matches:0, online:PV.sapi.onlineNow()};
  }
  await ensure();
  if(state!=='ok') return {state, users:PV.store.localUsers().length, matches:LS.get('stat:matches',0)};
  await pull();
  return {state, users:Object.keys(world.users).length, matches:world.stats?.matches||0};
}
function bumpMatches(){ LS.set('stat:matches', LS.get('stat:matches',0)+1); }

/* ---------------- admin over the shared world (mrshash) ---------------- */
async function adminList(){
  await ensure(); if(state!=='ok') return null;
  await pull(); if(state!=='ok' || !world) return null;
  return Object.values(world.users||{}).map(r=>({
    u:r.u||'', name:r.name||r.u||'', avatar:r.avatar||'fox',
    lvl:r.lvl||1, xp:(r.prof&&r.prof.xp)||0, coins:(r.prof&&r.prof.coins)||0,
    banned:!!r.banned, svAdmin:!!r.svAdmin, plays:(r.prof&&r.prof.stats&&r.prof.stats.plays)||0
  })).sort((a,b)=>b.xp-a.xp);
}
async function adminAction(u, action, n){
  await ensure(); if(state!=='ok') return false;
  const k = String(u||'').trim().toLowerCase();
  if(k==='mrshash' && action!=='grantxp' && action!=='grantcoins') return 'prot';
  try{
    const w = await mutate(x=>{
      const rec = x.users[k]; if(!rec) throw 'nf';
      rec.prof = rec.prof||{};
      if(action==='grantxp'){ rec.prof.xp = Math.max(0,(rec.prof.xp||0)+Math.round(n||0)); rec.lvl = (PV.u.levelFromXp(rec.prof.xp)).level; }
      else if(action==='grantcoins') rec.prof.coins = Math.max(0,(rec.prof.coins||0)+Math.round(n||0));
      else if(action==='ban') rec.banned = true;
      else if(action==='unban') rec.banned = false;
      else if(action==='admin') rec.svAdmin = true;
      else if(action==='rmvadmin') rec.svAdmin = false;
      else if(action==='del') delete x.users[k];
      else throw 'nf';
    });
    return w? 'ok' : false;
  }catch(e){ return e==='nf'? 'nf' : false; }
}
async function exportWorld(){ await ensure(); if(state!=='ok') return null; await pull(); return state==='ok'? world : null; }
async function importWorld(w){ await ensure(); if(state!=='ok') return false; if(!w || typeof w!=='object' || !w.users || typeof w.users!=='object') return false; w.v = w.v||1; w.ts = Date.now(); return !!(await push(w)); }
function providerInfo(){ const p = provider(); if(!p) return null; if(p.name==='textdb') return {name:'textdb.online', code:p.key}; if(p.name==='jsonblob') return {name:'jsonblob', code:jsonblobId()}; return {name:'custom'}; }

PV.cloud = {
  get state(){ return state; },
  ensure, probe, register, login, changePassword,
  pushProfile: pushProfileSoon,
  syncNow: syncFromCloudSoon,
  sendFriendReq, cloudFriendsBoth,
  postScore, topScores, globalBoard,
  setAnnounce, getAnnounce, setCats, getCats, setFlag, getFlags,
  worldInfo, bumpMatches, get world(){return world;},
  adminList, adminAction, exportWorld, importWorld, providerInfo,
  isOn(){ return state==='ok'; }
};
})();
