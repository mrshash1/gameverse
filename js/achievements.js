/* ============ PlayVerse Achievements ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { LS } = U;

const LIST = [
  {id:'first',  ic:'play',   rw:20,  check:e=>e.event==='match:end'},
  {id:'win1',   ic:'trophy', rw:30,  check:e=>e.event==='match:end' && e.res==='w'},
  {id:'grind',  ic:'dice',   rw:40,  check:e=>e.event==='match:end' && (e.p?.stats.plays>=10)},
  {id:'addict', ic:'fire',   rw:80,  check:e=>e.event==='match:end' && (e.p?.stats.plays>=50)},
  {id:'streak3',ic:'bolt',   rw:40,  check:e=>e.event==='streak' && e.n>=3},
  {id:'streak5',ic:'fire',   rw:70,  check:e=>e.event==='streak' && e.n>=5},
  {id:'explore',ic:'compass',rw:60,  check:e=>e.event==='match:end' && e.p && Object.keys(e.p.stats.byGame||{}).length>=10},
  {id:'socialize',ic:'chat', rw:30,  check:e=>e.event==='chat' && (e.p?.stats.msgs>=10)},
  {id:'host',   ic:'flag',   rw:40,  check:e=>e.event==='hosted' && (e.p?.stats.hosted>=1)},
  {id:'online1',ic:'swords', rw:50,  check:e=>e.event==='match:end' && e.mode!=='solo' && e.vsHuman && e.res==='w'},
  {id:'nightowl',ic:'moon',  rw:30,  check:e=>e.event==='match:end' && (e.p?.stats.night)},
  {id:'flash',  ic:'zap',    rw:60,  check:e=>e.event==='stat' && e.g==='reaction' && e.stat==='best' && e.val>0 && e.val<=250},
  {id:'quizA',  ic:'brain',  rw:60,  check:e=>e.event==='stat' && e.g==='quiz' && e.stat==='correct' && e.val>=5},
  {id:'memM',   ic:'puzzle', rw:60,  check:e=>e.event==='stat' && e.g==='memory' && e.stat==='misses' && e.val===0},
  {id:'c4',     ic:'dpad',   rw:50,  check:e=>e.event==='match:end' && e.g==='connect4' && e.res==='w' && (e.p?.stats.byGame?.connect4?.wins>=5)},
  {id:'wordW',  ic:'spark',  rw:60,  check:e=>e.event==='stat' && e.g==='word' && e.stat==='tries' && e.val<=3},
  {id:'streak7',ic:'calendar',rw:100,check:e=>e.event==='streakDay' && e.n>=7},
  {id:'rich',   ic:'coin',   rw:0,   check:e=>e.event==='coins' && (e.p?.coins>=500)},
  {id:'ranked', ic:'medal',  rw:70,  check:e=>e.event==='match:end' && e.mode==='ranked' && e.res==='w'},
  {id:'tourney',ic:'crown',  rw:120, check:e=>e.event==='tournament' && e.res==='w'},
];
const META = {
  first:'an.first', win1:'an.win1', grind:'an.grind', addict:'an.addict', streak3:'an.streak3',
  streak5:'an.streak5', explore:'an.explore', socialize:'an.socialize', host:'an.host',
  online1:'an.online1', nightowl:'an.nightowl', flash:'an.flash', quizA:'an.quizA', memM:'an.memM',
  c4:'an.c4', wordW:'an.wordW', streak7:'an.streak7', rich:'an.rich', ranked:'an.ranked', tourney:'an.tourney'
};

function unlockedSet(){ const p = PV.store.me(); return new Set(p? p.badges:[]); }

function evaluate(payload){
  const p = PV.store.me(); if(!p) return [];
  const newly = [];
  for(const a of LIST){
    if(p.badges.includes(a.id)) continue;
    let ok = false;
    try{ ok = !!a.check({...payload, p}); }catch(e){}
    if(ok){
      p.badges.push(a.id);
      if(a.rw>0) p.coins += a.rw;
      newly.push({...a, name:t(META[a.id])});
    }
  }
  if(newly.length){ PV.store.saveProfile(p); }
  return newly;
}

function progressOf(a){
  const p = PV.store.me(); if(!p) return {cur:0, max:1};
  const s = p.stats;
  switch(a.id){
    case 'first': return {cur:s.plays, max:1};
    case 'win1': return {cur:s.wins, max:1};
    case 'grind': return {cur:s.plays, max:10};
    case 'addict': return {cur:s.plays, max:50};
    case 'streak3': return {cur:s.bestWinStreak||0, max:3};
    case 'streak5': return {cur:s.bestWinStreak||0, max:5};
    case 'explore': return {cur:Object.keys(s.byGame||{}).length, max:10};
    case 'socialize': return {cur:s.msgs||0, max:10};
    case 'host': return {cur:s.hosted||0, max:1};
    case 'streak7': return {cur:s.bestDayStreak||0, max:7};
    case 'rich': return {cur:p.coins, max:500};
    case 'flash': return {cur:(s.best?.reaction? (s.best.reaction<=250?1:0):0), max:1};
    default: return {cur:unlockedSet().has(a.id)?1:0, max:1};
  }
}

PV.ach = { LIST, META, evaluate, unlockedSet, progressOf };
})();
