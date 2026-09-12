/* ============ PlayVerse Game Registry — plugin system ============
   Adding a new game = create games/<id>/game.js that calls
   PV.registry.register({...meta, factory}) — nothing else to touch.
================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { LS } = U;

const games = new Map();       // id → meta
const factories = new Map();   // id → factory fn
const loadedScripts = new Set();

const BASE_CATS = ['board','classic','party','brain','speed','word','luck','family'];

function register(meta){
  const existing = meta.id ? games.get(meta.id) : null;
  const m = Object.assign({
    id:null, players:[1,4], modes:['solo','online'], weight:50,
    cats:['classic'], rating:1000, plays:0, isNew:false,
    bot:false, dynamicScore:false, lowerBetter:false
  }, existing||{}, meta);
  if(!m.id) throw new Error('registry: game needs id');
  m.plays = LS.get('plays:'+m.id, existing?.plays||0);
  games.set(m.id, m);
  if(m.factory) factories.set(m.id, m.factory);
  return m;
}

/* ---- static metadata: ships with the shell so home/discover render instantly;
        factories are lazy-loaded from games/<id>/game.js on demand ---- */
[
  {id:'tictactoe', cats:['board','classic','family'], players:[2,2], weight:95},
  {id:'connect4',  cats:['board','classic','family'], players:[2,2], weight:90},
  {id:'rps',       cats:['party','classic','luck'],   players:[2,2], weight:88},
  {id:'memory',    cats:['brain','family','party'],   players:[1,2], weight:84},
  {id:'quiz',      cats:['brain','family','party'],   players:[1,8], weight:80},
  {id:'reaction',  cats:['speed','party'],            players:[1,8], weight:76},
  {id:'word',      cats:['word','brain'],             players:[1,2], weight:72},
].forEach(register);
function loadFactory(id){
  return factories.get(id) || null;
}
/* lazy-load game module from games/<id>/game.js */
function ensureLoaded(id){
  return new Promise((res, rej)=>{
    if(factories.has(id) || loadedScripts.has(id)) return res(factories.get(id)||null);
    loadedScripts.add(id);
    const s = document.createElement('script');
    s.src = 'games/'+id+'/game.js';
    s.onload = ()=> res(factories.get(id)||null);
    s.onerror = ()=> rej(new Error('game module not found: '+id));
    document.head.appendChild(s);
  });
}
function get(id){ return games.get(id)||null; }
function all(){ return [...games.values()].sort((a,b)=>b.weight-a.weight); }
function enabled(id){
  const f = LS.get('flags', {});
  return f[id] !== false;
}
function byCat(cat){
  return all().filter(g=> (g.cats||[]).includes(cat) && enabled(g.id));
}
async function customCats(){
  try{ return await PV.cloud.getCats(); }catch(e){ return LS.get('cats', []); }
}
async function allCats(){
  const custom = await customCats();
  const extra = (custom||[]).map(c=> typeof c==='string' ? c : c.id);
  return [...new Set([...BASE_CATS, ...extra])];
}
function catLabel(c){
  const k = 'cat.'+c;
  const tr = PV.t(k);
  return tr===k ? c : tr;
}
function bumpPlays(id){
  const g = games.get(id); if(!g) return;
  g.plays++;
  LS.set('plays:'+id, g.plays);
}
function ids(){ return [...games.keys()]; }

PV.registry = { register, get, all, byCat, allCats, catLabel, ensureLoaded, loadFactory, bumpPlays, enabled, ids, BASE_CATS };
})();
