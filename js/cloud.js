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

function provider(){
  const ep = (PV.store.settings.endpoint||'').trim();
  if(ep) return {name:'custom', url:ep, etagOk:true};
  const id = jsonblobId();
  if(id) return {name:'jsonblob', url:'https://jsonblob.com/api/jsonBlob/'+id, etagOk:true};
  return null;
}

async function probe(){
  state = 'off';
  const p = provider();
  if(!p) return false;
  try{
    const r = await tfetch(p.url, {cache:'no-store', headers:{'Accept':'application/json'}});
    if(!r.ok) throw 0;
    etag = r.headers.get('ETag');
    world = await r.json();
    if(!world || typeof world!=='object') throw 0;
    if(!world.users) world = blankWorld();
    state = 'ok';
    return true;
  }catch(e){
    // maybe world blob was purged (jsonblob 404) → recreate
    if(p.name==='jsonblob' && jsonblobId()){
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
}
async function createWorld(){
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
function blankWorld(){ return {v:1, ts:Date.now(), users:{}, scores:{}, inbox:{}, announce:null, flags:{}, cats:[], stats:{matches:0}}; }

async function pull(){
  const p = provider(); if(!p) return null;
  try{
    const r = await tfetch(p.url + (p.url.includes('?')?'&':'?') + '_=' + Date.now(), {cache:'no-store', headers:{'Accept':'application/json'}});
    if(!r.ok) throw 0;
    etag = r.headers.get('ETag');
    world = await r.json();
    if(!world || !world.users) world = blankWorld();
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
  await ensure();
  if(state!=='ok') return;
  await mutate(w=>{
    const u = p.u.toLowerCase();
    const rec = w.users[u] ||= {u:p.u, created:p.created};
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
      x.users[key] = {u, name, salt, ph, created:Date.now(), lvl:1, ratings:{}, friends:[], prof:{xp:0,coins:100,stats:{},best:{},ts:Date.now()}};
    });
    if(w){
      prof.cloud = true; PV.store.saveProfile(prof);
      return {ok:true};
    }
    return {ok:true, localOnly:true};
  }
  return {ok:true, localOnly:true};
}

async function login(u, pw){
  u = (u||'').trim().toLowerCase();
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
    PV.store.saveProfile(prof);
    PV.store.login(u, prof.name);
    return {ok:true};
  }
  if(lp) return {ok:false, why:'pw'};
  return {ok:false, why:'nf'};
}

const syncFromCloudSoon = U.debounce(async ()=>{
  if(PV.store.isGuest() || !PV.store.session) return;
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

/* friend requests via cloud inbox */
async function sendFriendReq(fromP, toU){
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
  await ensure(); if(state!=='ok') return false;
  return !!(await mutate(w=>{ w.announce = txt? {txt, ts:Date.now()} : null; }));
}
async function getAnnounce(){
  await ensure(); if(state!=='ok') return null;
  await pull();
  return (world && world.announce) || null;
}
async function setCats(arr){ await ensure(); if(state!=='ok'){ LS.set('cats', arr); return false; } return !!(await mutate(w=>{ w.cats = arr; })); }
async function getCats(){ const local = LS.get('cats', []); await ensure(); if(state!=='ok') return local; await pull(); return (world && world.cats) || local; }
async function setFlag(gid, on){ await ensure(); if(state!=='ok'){ const f=LS.get('flags',{}); f[gid]=on; LS.set('flags',f); return false; } return !!(await mutate(w=>{ w.flags[gid]=on; })); }
async function getFlags(){ await ensure(); if(state!=='ok') return LS.get('flags',{}); await pull(); return (world && world.flags) || {}; }
async function worldInfo(){
  await ensure();
  if(state!=='ok') return {state, users:PV.store.localUsers().length, matches:LS.get('stat:matches',0)};
  await pull();
  return {state, users:Object.keys(world.users).length, matches:world.stats?.matches||0};
}
function bumpMatches(){ LS.set('stat:matches', LS.get('stat:matches',0)+1); }

PV.cloud = {
  get state(){ return state; },
  ensure, probe, register, login,
  pushProfile: pushProfileSoon,
  syncNow: syncFromCloudSoon,
  sendFriendReq, cloudFriendsBoth,
  postScore, topScores, globalBoard,
  setAnnounce, getAnnounce, setCats, getCats, setFlag, getFlags,
  worldInfo, bumpMatches, get world(){return world;},
  isOn(){ return state==='ok'; }
};
})();
