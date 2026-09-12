/* ============ PlayVerse Store — settings, session, profiles (localStorage-first) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { LS, levelFromXp } = U;

const DEF_SETTINGS = { theme:'light', lang:'fa', sound:true, vol:.8, motion:true, cloud:true, favs:[], endpoint:'' };
let settings = Object.assign({}, DEF_SETTINGS, LS.get('settings', {}));
let session  = LS.get('session', null);   // {u, name, guest}
const profileCache = {};

function saveSettings(patch){
  settings = Object.assign({}, settings, patch);
  LS.set('settings', settings);
  applySettings();
}
function applySettings(){
  document.documentElement.dataset.theme = settings.theme;
  document.body.classList.toggle('no-motion', settings.motion===false);
  PV.sound.setEnabled(settings.sound!==false);
  PV.sound.setVol(settings.vol ?? .8);
}

function blankProfile(u, name){
  return {
    u, name: name||u, avatar:'fox', bio:'', created:Date.now(),
    xp:0, coins:100, badges:[], claims:{},
    stats:{ plays:0, wins:0, losses:0, draws:0, msgs:0, hosted:0, bestDayStreak:0,
            byGame:{}, best:{}, night:false },
    ratings:{}, friends:[], reqsIn:[], reqsOut:[],
    history:[], streak:{last:'',count:0}, ts:Date.now()
  };
}
function loadProfile(u){ return LS.get('prof:'+u, null); }
function saveProfile(p){ p.ts=Date.now(); profileCache[p.u]=p; LS.set('prof:'+p.u, p); }

function me(){ return session ? (profileCache[session.u] ||= loadProfile(session.u)) : null; }

function update(fn){
  const p = me(); if(!p) return null;
  fn(p); saveProfile(p);
  return p;
}

function addXP(n){
  const p = update(x=>{ x.xp = Math.max(0, x.xp + n); });
  if(!p) return null;
  const before = LS.get('lvlhint:'+p.u, 1);
  const after = levelFromXp(p.xp).level;
  if(after > before){ LS.set('lvlhint:'+p.u, after); return {levelUp:after}; }
  return {levelUp:null};
}
function addCoins(n){ update(x=>{ x.coins = Math.max(0, x.coins + n); }); }

function addHistory(entry){
  update(p=>{
    p.history.unshift(entry);
    p.history = p.history.slice(0, 40);
    p.stats.plays++;
    if(entry.res==='w') p.stats.wins++; else if(entry.res==='l') p.stats.losses++; else p.stats.draws++;
    const bg = p.stats.byGame[entry.g] ||= {plays:0, wins:0};
    bg.plays++; if(entry.res==='w') bg.wins++;
    if(entry.score!=null){ const b = p.stats.best[entry.g]; if(b==null || entry.score>b) p.stats.best[entry.g]=entry.score; }
  });
}
function rating(g){ const p=me(); return p ? (p.ratings[g] ?? 1000) : 1000; }
function setRating(g, v){ update(p=>{ p.ratings[g]=Math.round(v); }); }

function pushScore(g, score, meta={}){
  if(!me() || score==null) return;
  const board = LS.get('board:'+g, []);
  board.push({u:me().name, av:me().avatar, s:Math.round(score), ts:Date.now(), lvl:levelFromXp(me().xp).level});
  board.sort((a,b)=>b.s-a.s);
  LS.set('board:'+g, board.slice(0,100));
}
function localScores(g){ return LS.get('board:'+g, []); }

/* daily streak (Tehran calendar) */
function touchStreak(){
  const p = me(); if(!p) return {streak:0, isNew:false};
  const today = U.todayKey();
  if(p.streak.last === today) return {streak:p.streak.count, isNew:false};
  const y = new Date(Date.now()-864e5), yk = U.todayKey();
  p.streak.count = (p.streak.last === yk) ? (p.streak.count||0)+1 : 1;
  p.streak.last = today;
  if(p.streak.count > (p.stats.bestDayStreak||0)) p.stats.bestDayStreak = p.streak.count;
  saveProfile(p);
  return {streak:p.streak.count, isNew:true};
}
function localUsers(){ return LS.get('users', []); }
function registerLocalUser(u){ const a=localUsers(); if(!a.includes(u)){ a.push(u); LS.set('users', a); } }

function login(u, name, opts={}){
  session = {u, name: name||u, guest: !!opts.guest};
  LS.set('session', session);
  const p = profileCache[u] ||= (loadProfile(u) || blankProfile(u, name));
  if(!p.u) p.u = u;
  saveProfile(p);
  if(!opts.guest) registerLocalUser(u);
  return p;
}
function logout(){ session=null; LS.del('session'); for(const k in profileCache) delete profileCache[k]; }

function exportAll(){
  const out = {v:1, exported:Date.now(), settings, users:{}};
  for(const u of localUsers()) out.users[u] = loadProfile(u);
  return out;
}
function importAll(data){
  try{
    if(data.settings) Object.assign(settings, data.settings), LS.set('settings', settings);
    for(const [u,p] of Object.entries(data.users||{})){ LS.set('prof:'+u, p); }
    return true;
  }catch(e){ return false; }
}

applySettings();
PV.store = {
  get settings(){ return settings; }, saveSettings, applySettings,
  get session(){ return session; }, login, logout, me, update, saveProfile,
  addXP, addCoins, addHistory, rating, setRating, pushScore, localScores, touchStreak,
  blankProfile, loadProfile, localUsers, exportAll, importAll,
  isGuest(){ return !!(session && session.guest); },
  displayName(){ return session ? session.name : t('c.guest'); }
};
})();
