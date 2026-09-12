/* ============ PlayVerse Daily Missions — seeded per Tehran date ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { LS } = U;

const POOL = [
  {id:'m1', ic:'dice',   goal:3,  rw:{xp:40, coins:25},  track:e=>e.event==='match:end'},
  {id:'m2', ic:'swords', goal:1,  rw:{xp:50, coins:30},  track:e=>e.event==='match:end' && e.mode!=='solo' && e.vsHuman},
  {id:'m3', ic:'trophy', goal:1,  rw:{xp:40, coins:30},  track:e=>e.event==='match:end' && e.res==='w'},
  {id:'m4', ic:'zap',    goal:1,  rw:{xp:35, coins:25},  track:e=>e.event==='stat' && e.g==='reaction' && e.stat==='best' && e.val>0 && e.val<=400},
  {id:'m5', ic:'brain',  goal:3,  rw:{xp:40, coins:25},  track:e=>e.event==='stat' && e.g==='quiz' && e.stat==='correct', inc:e=>1},
  {id:'m6', ic:'puzzle', goal:2,  rw:{xp:35, coins:20},  track:e=>e.event==='match:end' && e.g==='memory'},
  {id:'m7', ic:'dpad',   goal:1,  rw:{xp:40, coins:30},  track:e=>e.event==='match:end' && e.g==='connect4' && e.res==='w'},
  {id:'m8', ic:'spark',  goal:50, rw:{xp:0,  coins:40},  track:e=>e.event==='xp', inc:e=>e.n||0},
];
const META = { m1:'mi.m1', m2:'mi.m2', m3:'mi.m3', m4:'mi.m4', m5:'mi.m5', m6:'mi.m6', m7:'mi.m7', m8:'mi.m8' };

function dayList(dateKey){
  const h = U.hashStr('missions-'+dateKey);
  const idx = [h%8, (h>>3)%8, (h>>6)%8];
  const picks = [...new Set(idx)];
  while(picks.length<3) picks.push((picks[picks.length-1]+1)%8);
  return picks.slice(0,3).map(i=>POOL[i]);
}
function today(){
  const p = PV.store.me(); if(!p) return [];
  const key = U.todayKey();
  if(!p.missions || p.missions.date!==key){
    p.missions = {date:key, list:dayList(key).map(m=>({id:m.id, prog:0, done:false, claimed:false}))};
    PV.store.saveProfile(p);
  }
  return p.missions.list;
}
function defs(){ return POOL; }

function track(payload){
  const p = PV.store.me(); if(!p) return [];
  const key = U.todayKey();
  if(!p.missions || p.missions.date!==key) today();
  const changed = [];
  for(const m of p.missions.list){
    if(m.done) continue;
    const def = POOL.find(x=>x.id===m.id); if(!def) continue;
    try{
      if(def.track(payload)){
        m.prog += def.inc? def.inc(payload) : 1;
        if(m.prog >= def.goal){ m.prog = def.goal; m.done = true; changed.push(m); }
      }
    }catch(e){}
  }
  if(changed.length) PV.store.saveProfile(p);
  return changed;
}
function claim(id){
  const p = PV.store.me(); if(!p) return null;
  const m = (p.missions?.list||[]).find(x=>x.id===id);
  const def = POOL.find(x=>x.id===id);
  if(!m || !def || !m.done || m.claimed) return null;
  m.claimed = true;
  if(def.rw.xp) p.xp += def.rw.xp;
  if(def.rw.coins) p.coins += def.rw.coins;
  PV.store.saveProfile(p);
  return def.rw;
}

PV.missions = { today, defs, META, track, claim };
})();
