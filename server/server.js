/* ============================================================================
   PlayVerse Server — REAL backend for accounts, profiles, leaderboards, admin
   ----------------------------------------------------------------------------
   • Zero native deps (express + ws) → deploys on Render/Railway/Fly/VPS/PC
   • Storage: single JSON file (data/db.json) with atomic writes — simple & safe
   • Passwords: scrypt + per-user salt (node:crypto) — never stored plaintext
   • Admin: the account named  mrshash  is automatically an admin
     (override with env ADMIN_USERNAME)
   • WS /ws : global presence counter + room message relay
   Start:  npm install && npm start        (PORT env, default 3010)
   ============================================================================ */
'use strict';
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3010;
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'mrshash').toLowerCase();
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const VER = '1.0.0';

/* ------------------------------ tiny JSON DB ----------------------------- */
let db = null;
let writeTimer = null;
function blankDB(){
  return { v:VER, users:{}, sessions:{}, scores:{}, inbox:{}, announce:null, flags:{}, stats:{matches:0, reg:0} };
}
function loadDB(){
  try{
    if(fs.existsSync(DB_PATH)){
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if(!db || typeof db!=='object' || !db.users) throw new Error('bad db');
      console.log('[db] loaded', Object.keys(db.users).length, 'users');
    }
  }catch(e){ console.error('[db] load failed, starting fresh:', e.message); }
  if(!db) db = blankDB();
}
function saveDB(now){
  if(now){
    try{
      fs.mkdirSync(path.dirname(DB_PATH), {recursive:true});
      const tmp = DB_PATH + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_PATH);
    }catch(e){ console.error('[db] write failed', e.message); }
    return;
  }
  if(writeTimer) return;
  writeTimer = setTimeout(()=>{ writeTimer=null; saveDB(true); }, 800);
}
loadDB();
process.on('SIGINT', ()=>{ saveDB(true); process.exit(0); });
process.on('SIGTERM', ()=>{ saveDB(true); process.exit(0); });

/* -------------------------------- helpers -------------------------------- */
function hashPw(pw, salt){
  return crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function pubProfile(u){
  const r = db.users[u]; if(!r) return null;
  return { u:r.u, name:r.name, avatar:r.avatar, bio:r.bio||'', created:r.created,
           admin:!!r.admin, banned:!!r.banned, xp:r.xp||0, coins:r.coins||0,
           badges:r.badges||[], stats:r.stats||{}, ratings:r.ratings||{}, friends:r.friends||[], ts:r.ts||0 };
}
function lvlOf(xp){
  let l=1, need=80, acc=0;
  while(xp >= acc+need && l<99){ acc+=need; l++; need=Math.round(80*Math.pow(l,1.35)); }
  return l;
}
function token(){ return crypto.randomBytes(24).toString('hex'); }
function norm(u){ return String(u||'').trim().toLowerCase(); }

/* simple per-IP rate limit for auth endpoints */
const hits = {};
function limited(ip, max=20){
  const w = Math.floor(Date.now()/60000);
  hits[ip+w] = (hits[ip+w]||0)+1;
  if(hits[ip+w] > max) return true;
  if(Object.keys(hits).length > 4000){ for(const k of Object.keys(hits)) if(!k.endsWith(w)) delete hits[k]; }
  return false;
}
function auth(req){
  const h = req.headers.authorization||'';
  const tok = h.startsWith('Bearer ')? h.slice(7) : null;
  if(!tok) return null;
  const u = db.sessions[tok];
  if(!u) return null;
  const r = db.users[u];
  if(!r || r.banned) return null;
  return r;
}

/* --------------------------------- app ----------------------------------- */
const app = express();
app.use(express.json({limit:'256kb'}));
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/api/health', (req,res)=> res.json({ok:true, name:'PlayVerse Server', ver:VER, users:Object.keys(db.users).length, admin:ADMIN_USERNAME}));

/* ------------------------------- auth API -------------------------------- */
app.post('/api/register', (req,res)=>{
  if(limited(req.ip, 12)) return res.status(429).json({ok:false, why:'rate'});
  const u = norm(req.body.username);
  const pw = String(req.body.password||'');
  const name = String(req.body.name||'').trim().slice(0,24) || u;
  if(!/^[a-z0-9_]{3,20}$/.test(u)) return res.status(400).json({ok:false, why:'user'});
  if(pw.length<6) return res.status(400).json({ok:false, why:'pw'});
  if(db.users[u]) return res.status(409).json({ok:false, why:'taken'});
  const salt = crypto.randomBytes(8).toString('hex');
  const rec = {
    u, name, avatar:'fox', bio:'', created:Date.now(),
    admin: u===ADMIN_USERNAME, banned:false,
    pw:{salt, hash:hashPw(pw,salt)},
    xp:0, coins:100, badges:[], stats:{}, ratings:{}, friends:[], ts:Date.now()
  };
  db.users[u] = rec;
  db.stats.reg = (db.stats.reg||0)+1;
  const tok = token();
  db.sessions[tok] = u;
  saveDB();
  console.log('[register]', u, rec.admin? '(ADMIN)':'');
  res.json({ok:true, token:tok, profile:pubProfile(u)});
});

app.post('/api/login', (req,res)=>{
  if(limited(req.ip, 25)) return res.status(429).json({ok:false, why:'rate'});
  const u = norm(req.body.username);
  const pw = String(req.body.password||'');
  const r = db.users[u];
  if(!r) return res.status(404).json({ok:false, why:'nf'});
  if(r.banned) return res.status(403).json({ok:false, why:'banned'});
  if(hashPw(pw, r.pw.salt) !== r.pw.hash) return res.status(401).json({ok:false, why:'pw'});
  if(u===ADMIN_USERNAME && !r.admin) r.admin = true;   /* belt & braces */
  const tok = token();
  db.sessions[tok] = u;
  if(Object.keys(db.sessions).length>5000) db.sessions = {};
  saveDB();
  console.log('[login]', u, r.admin? '(ADMIN)':'');
  res.json({ok:true, token:tok, profile:pubProfile(u)});
});

app.get('/api/me', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  res.json({ok:true, profile:pubProfile(r.u)});
});

app.put('/api/me', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  const b = req.body||{};
  if(typeof b.name==='string' && b.name.trim()) r.name = b.name.trim().slice(0,24);
  if(typeof b.avatar==='string' && /^[a-z]{2,8}$/.test(b.avatar)) r.avatar = b.avatar;
  if(typeof b.bio==='string') r.bio = b.bio.slice(0,240);
  if(typeof b.xp==='number' && b.xp >= (r.xp||0)) r.xp = Math.round(b.xp);      /* xp never decreases via sync */
  if(typeof b.coins==='number') r.coins = Math.max(0, Math.round(b.coins));
  if(b.badges && Array.isArray(b.badges)) r.badges = [...new Set([...(r.badges||[]), ...b.badges.map(String)])].slice(0,60);
  if(b.stats && typeof b.stats==='object') r.stats = Object.assign({}, r.stats, b.stats);
  if(b.ratings && typeof b.ratings==='object') r.ratings = Object.assign({}, r.ratings, b.ratings);
  if(Array.isArray(b.friends)) r.friends = [...new Set(b.friends.map(String))].slice(0,120);
  if(b.stats && typeof b.stats.best==='object') r.stats.best = b.stats.best;
  r.ts = Date.now();
  saveDB();
  res.json({ok:true, profile:pubProfile(r.u)});
});

/* ------------------------------ public data ------------------------------ */
app.get('/api/users', (req,res)=>{
  const list = Object.values(db.users).filter(r=>!r.banned)
    .map(r=>({u:r.name, av:r.avatar, lvl:lvlOf(r.xp||0), xp:r.xp||0}))
    .sort((a,b)=>b.xp-a.xp).slice(0,200);
  res.json({ok:true, users:list});
});
app.get('/api/users/:username', (req,res)=>{
  const r = db.users[norm(req.params.username)];
  if(!r) return res.status(404).json({ok:false, why:'nf'});
  res.json({ok:true, profile:pubProfile(r.u)});
});

/* -------------------------------- scores --------------------------------- */
app.post('/api/score', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  const g = String(req.body.game||'').replace(/[^\w-]/g,'').slice(0,24);
  const s = Math.round(Number(req.body.score));
  if(!g || !isFinite(s)) return res.status(400).json({ok:false});
  const arr = db.scores[g] ||= [];
  arr.push({u:r.name, av:r.avatar, s, ts:Date.now(), lvl:lvlOf(r.xp||0)});
  arr.sort((a,b)=>b.s-a.s);
  if(arr.length>100) arr.length = 100;
  db.stats.matches = (db.stats.matches||0)+1;
  saveDB();
  res.json({ok:true, rank: arr.findIndex(x=>x.u===r.name && x.s===s)+1});
});
app.get('/api/scores/:game', (req,res)=>{
  const g = String(req.params.game).replace(/[^\w-]/g,'');
  res.json({ok:true, rows:db.scores[g]||[]});
});

/* -------------------------------- friends -------------------------------- */
app.post('/api/friends/req', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  const to = norm(req.body.to);
  const target = db.users[to];
  if(!target) return res.status(404).json({ok:false, why:'nf'});
  if(to===r.u) return res.status(400).json({ok:false, why:'self'});
  const inbox = db.inbox[to] ||= [];
  if(inbox.some(m=>m.type==='req' && m.from===r.u)) return res.json({ok:true, dup:true});
  inbox.push({id:crypto.randomBytes(5).toString('hex'), type:'req', from:r.u, name:r.name, av:r.avatar, ts:Date.now(), txt:''});
  if(inbox.length>40) inbox.splice(0, inbox.length-40);
  saveDB();
  res.json({ok:true});
});
app.post('/api/friends/acc', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  const from = norm(req.body.from);
  const sender = db.users[from];
  const inbox = db.inbox[r.u] ||= [];
  const msg = inbox.find(m=>m.type==='req' && m.from===from);
  if(!sender || !msg) return res.status(404).json({ok:false, why:'nf'});
  inbox.splice(inbox.indexOf(msg), 1);
  if(!r.friends.includes(sender.name)) r.friends.push(sender.name);
  if(!sender.friends.includes(r.name)) sender.friends.push(r.name);
  const sInbox = db.inbox[from] ||= [];
  sInbox.push({id:crypto.randomBytes(5).toString('hex'), type:'sys', from:r.u, name:r.name, ts:Date.now(),
               txt:r.name+' درخواست دوستی‌ات را پذیرفت'});
  saveDB();
  res.json({ok:true, friends:r.friends});
});
app.get('/api/inbox', (req,res)=>{
  const r = auth(req); if(!r) return res.status(401).json({ok:false});
  res.json({ok:true, msgs:db.inbox[r.u]||[]});
});

/* --------------------------- announce + flags ---------------------------- */
app.get('/api/announce', (req,res)=> res.json({ok:true, announce:db.announce||null}));
app.get('/api/flags', (req,res)=> res.json({ok:true, flags:db.flags||{}}));

/* --------------------------------- admin --------------------------------- */
function adminOnly(req,res){ const r = auth(req); if(!r || !r.admin){ res.status(403).json({ok:false, why:'admin'}); return null; } return r; }

app.get('/api/admin/overview', (req,res)=>{
  const a = adminOnly(req,res); if(!a) return;
  const users = Object.values(db.users).map(r=>({
    u:r.u, name:r.name, avatar:r.avatar, xp:r.xp||0, coins:r.coins||0,
    lvl:lvlOf(r.xp||0), admin:!!r.admin, banned:!!r.banned, created:r.created,
    plays:(r.stats&&r.stats.plays)||0, ts:r.ts||0
  })).sort((a2,b)=>b.xp-a2.xp);
  const byGame = {};
  for(const [g,arr] of Object.entries(db.scores)) byGame[g] = arr.length;
  res.json({ok:true, users, matches:db.stats.matches||0, byGame, announce:db.announce, flags:db.flags, adminUser:ADMIN_USERNAME});
});
app.post('/api/admin/user/:username', (req,res)=>{
  const a = adminOnly(req,res); if(!a) return;
  const u = norm(req.params.username);
  const r = db.users[u]; if(!r) return res.status(404).json({ok:false, why:'nf'});
  const act = String(req.body.action||'');
  switch(act){
    case 'grantxp':   r.xp = Math.max(0,(r.xp||0) + Math.round(Number(req.body.n)||0)); break;
    case 'grantcoins':r.coins = Math.max(0,(r.coins||0) + Math.round(Number(req.body.n)||0)); break;
    case 'ban':       if(u===ADMIN_USERNAME) return res.status(400).json({ok:false, why:'self'}); r.banned = true; for(const [t,uu] of Object.entries(db.sessions)) if(uu===u) delete db.sessions[t]; break;
    case 'unban':     r.banned = false; break;
    case 'admin':     r.admin = !!req.body.on; break;
    case 'del':       if(u===ADMIN_USERNAME) return res.status(400).json({ok:false, why:'self'}); delete db.users[u]; for(const [t,uu] of Object.entries(db.sessions)) if(uu===u) delete db.sessions[t]; break;
    default: return res.status(400).json({ok:false, why:'act'});
  }
  r.ts = Date.now(); saveDB();
  res.json({ok:true, profile: db.users[u]? pubProfile(u):null});
});
app.post('/api/admin/announce', (req,res)=>{
  const a = adminOnly(req,res); if(!a) return;
  const txt = req.body.txt? String(req.body.txt).slice(0,220) : null;
  db.announce = txt? {txt, ts:Date.now(), by:a.name} : null;
  wsBroadcast({t:'announce', d:db.announce});
  saveDB(); res.json({ok:true});
});
app.post('/api/admin/flags', (req,res)=>{
  const a = adminOnly(req,res); if(!a) return;
  const g = String(req.body.game||'').replace(/[^\w-]/g,'');
  if(!g) return res.status(400).json({ok:false});
  db.flags[g] = !!req.body.on;
  saveDB(); res.json({ok:true, flags:db.flags});
});

app.use((req,res)=> res.status(404).json({ok:false, why:'404'}));

/* -------------------------------- server --------------------------------- */
const server = http.createServer(app);

/* ------------------------------ WS presence ------------------------------ */
const wss = new WebSocketServer({server, path:'/ws'});
const sockets = new Set();
function wsBroadcast(obj, except){
  const s = JSON.stringify(obj);
  for(const ws of sockets){ if(ws===except) continue; try{ if(ws.readyState===1) ws.send(s); }catch(e){} }
}
wss.on('connection', (ws, req)=>{
  sockets.add(ws);
  ws.meta = {u:null, rooms:new Set()};
  const online = ()=> sockets.size;
  ws.send(JSON.stringify({t:'hello', online:online()}));
  wsBroadcast({t:'online', n:online()}, ws);
  ws.on('message', raw=>{
    let m; try{ m = JSON.parse(raw); }catch(e){ return; }
    if(m.t==='hi' && typeof m.u==='string'){ ws.meta.u = m.u.slice(0,24); }
    else if(m.t==='room' && /^[A-Z0-9]{4,8}$/.test(String(m.code||''))){
      if(m.leave){ ws.meta.rooms.delete(m.code); }
      else ws.meta.rooms.add(m.code);
    }
    else if(m.t==='relay' && ws.meta.rooms.has(String(m.code||'').toUpperCase())){
      /* relay game payloads to everyone else in the same room code */
      wsBroadcast({t:'relay', code:String(m.code).toUpperCase(), from:ws.meta.u, d:m.d}, ws);
    }
  });
  ws.on('close', ()=>{ sockets.delete(ws); wsBroadcast({t:'online', n:online()}); });
});

server.listen(PORT, ()=> console.log(`✅ PlayVerse server running → http://localhost:${PORT}  (admin: ${ADMIN_USERNAME})`));
