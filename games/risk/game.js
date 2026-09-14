/* ============ Game: Risk — classic world conquest (solo vs bots) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, { el, esc, fmt, clamp } = U;

/* ---------- locale ---------- */
const FA = (document.documentElement.getAttribute('lang')||'fa').startsWith('fa');
const L = FA ? {
 deploy:'استقرار', attack:'حمله', fortify:'جابجایی', end:'پایان نوبت',
 cards:'کارت‌های من', auto:'توزیع خودکار', endAtk:'اتمام حمله', skipFort:'رد شدن',
 you:'شما', pool:'ارتش مانده', logT:'گزارش رویداد',
 stDeploy:'روی سرزمین‌های خودت بزن تا ارتش اضافه شود', stAtkSrc:'سرزمین مبدأ را انتخاب کن (حداقل ۲ ارتش)',
 stAtkTgt:'حالا سرزمین دشمنِ همسایه را هدف بگیر', stFortSrc:'سرزمین مبدأ جابجایی را انتخاب کن (حداقل ۲ ارتش)',
 stFortTgt:'سرزمین مقصد (متصل از راه خاک خودت) را انتخاب کن', stBot:'ربات در حال حرکت است…',
 diceT:'نبرد', attacker:'مهاجم', defender:'مدافع', roll:'حمله!', again:'حملهٔ مجدد', close:'بستن',
 capT:'سرزمین تصرف شد!', moveQ:'چند ارتش منتقل شود؟', ok:'تأیید',
 cardsT:'کارت‌های من', inf:'سرباز', cav:'سوار', art:'توپخانه', wild:'جوکر',
 trade:'معاملهٔ سِت', need3:'۳ کارت انتخاب کن', badSet:'این ترکیب سِت معتبر نیست',
 onlyDeploy:'معامله فقط در فاز استقرارِ نوبت خودت', forced:'۵ کارت یا بیشتر داری — باید یک سِت معامله کنی!',
 empty:'دسته‌ات خالی است', vic:'پیروزی! نقشهٔ جهان از آنِ توست', def:'شکست — {p} جهان را گرفت',
 logDeal:'سرزمین‌ها تقسیم شد', logAtk:'{a} از {f} به {t} حمله کرد',
 logCap:'{p} سرزمین {t} را تصرف کرد', logElim:'{p} کاملاً از نقشه حذف شد!',
 logTrade:'{p} سِت کارت معامله کرد (+{n} ارتش)', logFort:'{p} {n} ارتش از {f} به {t} جابجا کرد',
 logCont:'{p} قارهٔ {c} را یکجا کرد!', logTurn:'— نوبت {p} —',
 conts:{nam:'امریکای شمالی',sam:'امریکای جنوبی',eur:'اروپا',afr:'آفریقا',asi:'آسیا',oce:'اقیانوسیه'},
} : {
 deploy:'Deploy', attack:'Attack', fortify:'Fortify', end:'End turn',
 cards:'My cards', auto:'Auto-place', endAtk:'End attack', skipFort:'Skip',
 you:'You', pool:'armies left', logT:'Event log',
 stDeploy:'Tap your territories to place armies', stAtkSrc:'Pick an attacker (2+ armies)',
 stAtkTgt:'Now tap an adjacent enemy territory', stFortSrc:'Pick a source to move from (2+ armies)',
 stFortTgt:'Pick a destination connected through your land', stBot:'Bot is thinking…',
 diceT:'Battle', attacker:'Attacker', defender:'Defender', roll:'Attack!', again:'Attack again', close:'Close',
 capT:'Territory captured!', moveQ:'How many armies to move?', ok:'OK',
 cardsT:'My cards', inf:'Infantry', cav:'Cavalry', art:'Artillery', wild:'Wild',
 trade:'Trade set', need3:'Select 3 cards', badSet:'Not a valid set',
 onlyDeploy:'Trading only during your deploy phase', forced:'You hold 5+ cards — you must trade a set!',
 empty:'Your hand is empty', vic:'Victory! The world map is yours', def:'Defeat — {p} took the world',
 logDeal:'Territories dealt', logAtk:'{a} attacked {t} from {f}',
 logCap:'{p} captured {t}', logElim:'{p} was wiped off the map!',
 logTrade:'{p} traded a set (+{n} armies)', logFort:'{p} moved {n} armies from {f} to {t}',
 logCont:'{p} completed {c}!', logTurn:'— {p}\'s turn —',
 conts:{nam:'N. America',sam:'S. America',eur:'Europe',afr:'Africa',asi:'Asia',oce:'Oceania'},
};
const tt = (k,v)=>{ let s=k.split('.').reduce((o,p)=>o&&o[p], L); s=(s==null?k:s); if(v) for(const x in v) s=String(s).replace('{'+x+'}', v[x]); return s; };

/* ---------- board data (real Risk layout, Alaska↔Kamchatka link) ---------- */
/* [id, fa, en, continent, x, y, r, adj] */
const TD = [
['alaska','آلاسکا','Alaska','nam',64,88,26,'nwTerr alberta kamchatka'],
['nwTerr','قلمرو شمال‌غرب','N-West Territory','nam',150,80,30,'alaska alberta ontario greenland'],
['greenland','گرینلند','Greenland','nam',262,52,26,'nwTerr ontario quebec iceland'],
['alberta','آلبرتا','Alberta','nam',118,150,26,'alaska nwTerr ontario westUS'],
['ontario','اونتاریو','Ontario','nam',185,148,28,'nwTerr alberta greenland quebec westUS eastUS'],
['quebec','کبک','Quebec','nam',248,128,24,'greenland ontario eastUS'],
['westUS','غرب آمریکا','W. United States','nam',122,215,26,'alberta ontario eastUS centAm'],
['eastUS','شرق آمریکا','E. United States','nam',192,212,26,'westUS ontario quebec centAm'],
['centAm','آمریکای مرکزی','Central America','nam',165,288,22,'westUS eastUS venezuela'],
['venezuela','ونزوئلا','Venezuela','sam',196,360,22,'centAm peru brazil'],
['peru','پرو','Peru','sam',172,448,22,'venezuela brazil argentina'],
['brazil','برزیل','Brazil','sam',248,432,26,'venezuela peru argentina nAfr'],
['argentina','آرژانتین','Argentina','sam',208,532,22,'peru brazil'],
['iceland','ایسلند','Iceland','eur',398,86,18,'greenland britain scand'],
['britain','بریتانیا','Great Britain','eur',402,158,20,'iceland scand nEurope wEurope'],
['scand','اسکاندیناوی','Scandinavia','eur',478,64,24,'iceland britain nEurope ukraine'],
['nEurope','شمال اروپا','N. Europe','eur',474,140,24,'britain scand ukraine wEurope sEurope'],
['wEurope','غرب اروپا','W. Europe','eur',428,200,24,'britain nEurope sEurope nAfr'],
['sEurope','جنوب اروپا','S. Europe','eur',492,206,24,'wEurope nEurope ukraine midEast egypt nAfr'],
['ukraine','اوکراین','Ukraine','eur',552,116,28,'scand nEurope sEurope midEast afgh ural'],
['nAfr','شمال آفریقا','N. Africa','afr',432,306,30,'brazil wEurope sEurope egypt eAfr cAfr'],
['egypt','مصر','Egypt','afr',508,294,22,'nAfr sEurope midEast eAfr'],
['eAfr','شرق آفریقا','E. Africa','afr',522,382,26,'egypt nAfr cAfr sAfr madag midEast'],
['cAfr','مرکز آفریقا','C. Africa','afr',458,378,26,'nAfr eAfr sAfr'],
['sAfr','جنوب آفریقا','S. Africa','afr',482,468,24,'cAfr eAfr madag'],
['madag','ماداگاسکار','Madagascar','afr',552,462,18,'sAfr eAfr'],
['ural','اورال','Ural','asi',612,112,26,'ukraine siberia china afgh'],
['siberia','سیبری','Siberia','asi',692,88,32,'ural yakutsk irkutsk mongolia china afgh'],
['yakutsk','یاقوتستا','Yakutsk','asi',792,62,24,'siberia irkutsk kamchatka'],
['kamchatka','کامچاتکا','Kamchatka','asi',886,92,26,'yakutsk irkutsk mongolia japan alaska'],
['irkutsk','ایرکوتسک','Irkutsk','asi',796,136,24,'siberia yakutsk kamchatka mongolia'],
['mongolia','مغولستان','Mongolia','asi',838,186,26,'siberia irkutsk kamchatka japan china'],
['japan','ژاپن','Japan','asi',930,190,20,'kamchatka mongolia'],
['afgh','افغانستان','Afghanistan','asi',636,196,26,'ukraine ural siberia china midEast india'],
['china','چین','China','asi',764,244,30,'ural siberia mongolia afgh india siam'],
['midEast','خاورمیانه','Middle East','asi',596,262,26,'ukraine sEurope egypt eAfr afgh india'],
['india','هندوستان','India','asi',700,288,24,'midEast afgh china siam'],
['siam','سیام','Siam','asi',796,306,22,'india china indonesia'],
['indonesia','اندونزی','Indonesia','oce',806,396,22,'siam newGuinea wAus'],
['newGuinea','گینهٔ نو','New Guinea','oce',906,428,22,'indonesia wAus eAus'],
['wAus','غرب استرالیا','W. Australia','oce',836,516,24,'indonesia newGuinea eAus'],
['eAus','شرق استرالیا','E. Australia','oce',916,506,24,'newGuinea wAus'],
];
const TERR = TD.map((a,i)=>({id:a[0],fa:a[1],en:a[2],cont:a[3],x:a[4],y:a[5],r:a[6],adj:a[7].split(' ')}));
const byId = {}; TERR.forEach(t=>byId[t.id]=t);
const CONT = {
 nam:{b:5,c:'#3ba9ff'}, sam:{b:2,c:'#ff9f43'}, eur:{b:5,c:'#8b6cff'},
 afr:{b:3,c:'#e8a013'}, asi:{b:7,c:'#ff6b6b'}, oce:{b:2,c:'#12c9b4'},
};
const tname = t => FA? t.fa : t.en;
const PC = ['#7c5cff','#00c9bd','#ff5c9d','#ffb020'];
const PIPS = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const CEMO = {inf:'🪖',cav:'🐎',art:'💥',wild:'🌟'};
const CTYPE = ['inf','cav','art'];

/* organic blob around a point */
function blobPath(x,y,r,seed){
 const f = v => v - Math.floor(v);
 const pts=[];
 for(let i=0;i<8;i++){
  const a=Math.PI*2*i/8, rr=r*(0.82+0.36*f(Math.sin(seed*12.9898+i*78.233)*43758.5453));
  pts.push([x+Math.cos(a)*rr*1.1, y+Math.sin(a)*rr*0.9]);
 }
 let d='';
 for(let i=0;i<8;i++){
  const p=pts[i], q=pts[(i+1)%8], m=[(p[0]+q[0])/2,(p[1]+q[1])/2];
  d+=(i?'':'M'+m[0].toFixed(1)+' '+m[1].toFixed(1))+' Q'+p[0].toFixed(1)+' '+p[1].toFixed(1)+' '+m[0].toFixed(1)+' '+m[1].toFixed(1);
 }
 return d+'Z';
}

const CSS = `
.pvrisk{direction:rtl;position:relative;display:flex;flex-direction:column;gap:10px;color:var(--tx);width:100%}
.pvrisk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.pvrisk-phases{display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:999px;padding:4px}
.pvrisk-ph{font-size:11px;padding:3px 9px;border-radius:999px;color:var(--tx3);font-weight:700}
.pvrisk-ph.on{background:var(--grad-p);color:#fff;box-shadow:var(--sh-p)}
.pvrisk-ph.done{color:var(--ok)}
.pvrisk-topbtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pvrisk-pool{font-size:12px;font-weight:800;color:var(--p1);background:var(--surface2);border:1px dashed var(--p1);padding:4px 10px;border-radius:999px}
.pvrisk-btn{border:1px solid var(--border);background:var(--surface);color:var(--tx);border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.pvrisk-btn.ok{background:var(--grad-green);color:#fff;border:none}
.pvrisk-btn:disabled{opacity:.45;cursor:default}
.pvrisk-main{display:flex;flex-direction:column;gap:10px}
.pvrisk-mapwrap{position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-m);overflow:hidden}
.pvrisk-mapwrap svg{display:block;width:100%;height:auto}
.pvrisk-zoom{position:absolute;top:8px;inset-inline-start:8px;display:flex;flex-direction:column;gap:4px}
.pvrisk-zoom button{width:30px;height:30px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--tx);font-weight:800;cursor:pointer}
.pvrisk-terr{transition:fill .25s,stroke .15s;stroke-width:2.5;cursor:default}
.pvrisk-terr.act{cursor:pointer;animation:pvriskPulse 1.5s ease-in-out infinite}
.pvrisk-terr.sel{stroke:#22c55e!important;stroke-width:5}
.pvrisk-terr.tgt{stroke:#ef4467!important;stroke-width:5}
@keyframes pvriskPulse{0%,100%{filter:drop-shadow(0 0 1px rgba(255,255,255,.15))}50%{filter:drop-shadow(0 0 8px rgba(255,255,255,.9))}}
.pvrisk-badge{pointer-events:none}
.pvrisk-badge circle{fill:#fff;stroke:rgba(20,25,60,.4);stroke-width:1.5}
.pvrisk-badge text{font-size:14px;font-weight:800;fill:#1c2044;text-anchor:middle;dominant-baseline:central}
.pvrisk-side{display:grid;grid-template-columns:1fr;gap:8px}
.pvrisk-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-m);padding:10px}
.pvrisk-h{font-size:11px;font-weight:800;color:var(--tx3);margin-bottom:5px}
.pvrisk-prow{display:flex;align-items:center;gap:6px;font-size:13px;padding:2px 0}
.pvrisk-prow.cur{font-weight:800}
.pvrisk-dot{width:10px;height:10px;border-radius:50%;flex:none}
.pvrisk-dead{opacity:.4;text-decoration:line-through}
.pvrisk-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;border:1.5px solid var(--border);margin:2px;color:var(--tx2)}
.pvrisk-chip.full{color:#fff;border:none}
.pvrisk-log{font-size:12px;color:var(--tx2);line-height:1.9;min-height:64px}
.pvrisk-ov{position:absolute;inset:0;background:rgba(12,14,34,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:30;padding:14px}
.pvrisk-mo{background:var(--surface);border-radius:var(--r-l);padding:16px;width:min(430px,94vw);max-height:86vh;overflow:auto;box-shadow:var(--sh-3);text-align:center}
.pvrisk-mo h3{margin:0 0 8px;font-size:16px}
.pvrisk-vs{display:flex;justify-content:center;gap:10px;font-weight:800;font-size:13px;margin:4px 0 2px}
.pvrisk-dice{display:flex;justify-content:center;gap:12px;margin:8px 0;min-height:48px}
.pvrisk-die{width:46px;height:46px;border-radius:12px;background:#fff;color:#16204a;display:grid;place-items:center;font-size:30px;line-height:1;box-shadow:0 3px 10px rgba(0,0,0,.25)}
.pvrisk-die.d{background:var(--err);color:#fff}
.pvrisk-die.roll{animation:pvriskShake .14s linear infinite}
@keyframes pvriskShake{0%{transform:rotate(-9deg)}50%{transform:rotate(9deg) translateY(-3px)}100%{transform:rotate(-9deg)}}
.pvrisk-chips{display:flex;gap:6px;justify-content:center;margin:8px 0}
.pvrisk-chips button{min-width:40px;height:34px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);font-weight:800;cursor:pointer;color:var(--tx);font:inherit;font-size:14px}
.pvrisk-chips button.on{border-color:var(--p1);background:var(--p1);color:#fff}
.pvrisk-res{font-size:13px;font-weight:700;margin:6px 0;min-height:20px}
.pvrisk-res.bad{color:var(--err)} .pvrisk-res.good{color:var(--ok)}
.pvrisk-slider{width:100%;margin:10px 0;accent-color:var(--p1)}
.pvrisk-cardgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.pvrisk-card{border:2px solid var(--border);border-radius:10px;padding:6px 4px;font-size:11px;cursor:pointer;background:var(--surface2);color:var(--tx)}
.pvrisk-card.on{border-color:var(--gold);background:rgba(255,176,32,.15)}
.pvrisk-card b{display:block;font-size:15px}
.pvrisk-mvrow{display:flex;align-items:center;justify-content:center;gap:10px}
@media(min-width:820px){.pvrisk-main{flex-direction:row}.pvrisk-mapwrap{flex:1}.pvrisk-side{width:252px;flex:none;display:flex;flex-direction:column}}`;

PV.registry.register({
 id:'risk', cats:['strategy','board','classic'], players:[2,4], modes:['solo'], weight:86,
 factory(ctx){
  const rng = ctx.rng || Math.random;
  let players=[], terr={}, turn=0, phase='deploy', pool=0, deck=[], discard=[], sets=0,
      conquered=false, fortified=false, over=false, paused=false, finished=false, busy=false,
      sel=null, fortReach=null, logs=[], zoom=1;
  const mePid = ()=> players[0]?.pid || 'me';
  const me = ()=> players[0];
  const cur = ()=> players[turn];
  const pBy = pid => players.find(p=>p.pid===pid);

  /* ---------- DOM ---------- */
  const rootEl = el(`<div class="pvrisk"><style>${CSS}</style>
   <div class="pvrisk-top">
    <div class="pvrisk-phases" id="rk-phases"></div>
    <div class="pvrisk-topbtns">
     <span class="pvrisk-pool" id="rk-pool"></span>
     <button class="pvrisk-btn" id="rk-cards">🃏</button>
     <button class="pvrisk-btn ok" id="rk-act"></button>
    </div>
   </div>
   <div class="pvrisk-main">
    <div class="pvrisk-mapwrap">
     <svg id="rk-map" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg"></svg>
     <div class="pvrisk-zoom"><button id="rk-zi">＋</button><button id="rk-zo">－</button></div>
    </div>
    <div class="pvrisk-side">
     <div class="pvrisk-box" id="rk-players"></div>
     <div class="pvrisk-box" id="rk-conts"></div>
     <div class="pvrisk-box" id="rk-log"></div>
    </div>
   </div></div>`);
  ctx.root.appendChild(rootEl);
  const svg = rootEl.querySelector('#rk-map');
  const phasesEl = rootEl.querySelector('#rk-phases'), poolEl = rootEl.querySelector('#rk-pool');
  const btnCards = rootEl.querySelector('#rk-cards'), btnAct = rootEl.querySelector('#rk-act');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = tag => document.createElementNS(NS, tag);

  /* build map: dashed links, tinted blobs, white army badges */
  const pathEls={}, badgeEls={};
  (function buildMap(){
   const gl = mk('g');
   gl.setAttribute('stroke','rgba(120,128,175,.55)');
   gl.setAttribute('stroke-dasharray','4 6'); gl.setAttribute('stroke-width','1.6');
   gl.setAttribute('fill','none');
   for(const t of TERR) for(const n of t.adj) if(t.id<n){
    const ln=mk('line'), b=byId[n];
    ln.setAttribute('x1',t.x); ln.setAttribute('y1',t.y);
    ln.setAttribute('x2',b.x); ln.setAttribute('y2',b.y);
    gl.appendChild(ln);
   }
   svg.appendChild(gl);
   const land = mk('g');
   for(const t of TERR){
    const g = mk('g'); g.setAttribute('data-id', t.id);
    const p = mk('path');
    p.setAttribute('d', blobPath(t.x,t.y,t.r,t.seed=TERR.indexOf(t)+1));
    p.setAttribute('class','pvrisk-terr');
    p.setAttribute('stroke', CONT[t.cont].c);
    g.appendChild(p);
    const bg = mk('g'); bg.setAttribute('class','pvrisk-badge');
    const c = mk('circle'); c.setAttribute('cx',t.x); c.setAttribute('cy',t.y); c.setAttribute('r',12.5);
    const tx = mk('text'); tx.setAttribute('x',t.x); tx.setAttribute('y',t.y);
    bg.appendChild(c); bg.appendChild(tx);
    g.appendChild(bg);
    land.appendChild(g);
    pathEls[t.id]=p; badgeEls[t.id]=tx;
   }
   svg.appendChild(land);
  })();
  function applyVB(){ const z=zoom; svg.setAttribute('viewBox', `${500-500/z} ${320-320/z} ${1000/z} ${640/z}`); }
  rootEl.querySelector('#rk-zi').onclick=()=>{ zoom=clamp(zoom+.25,1,2.4); applyVB(); PV.sound.play('tap'); };
  rootEl.querySelector('#rk-zo').onclick=()=>{ zoom=clamp(zoom-.25,1,2.4); applyVB(); PV.sound.play('tap'); };
  svg.addEventListener('click', e=>{ const g=e.target.closest && e.target.closest('g[data-id]'); if(g) onTerr(g.getAttribute('data-id')); });

  /* ---------- helpers ---------- */
  const owned = pid => TERR.filter(t=>terr[t.id].owner===pid);
  const threat = (id,pid)=> byId[id].adj.reduce((s,n)=> s + (terr[n].owner!==pid? terr[n].armies:0), 0);
  function reach(src,pid){ const seen=new Set([src]), q=[src];
   while(q.length){ const x=q.shift(); for(const n of byId[x].adj) if(!seen.has(n)&&terr[n].owner===pid){ seen.add(n); q.push(n);} }
   return seen; }
  function contsOf(pid){ const o=[]; for(const c in CONT){ if(TERR.filter(t=>t.cont===c).every(t=>terr[t.id].owner===pid)) o.push(c); } return o; }
  function contRatio(pid,c){ const cs=TERR.filter(t=>t.cont===c); return cs.filter(t=>terr[t.id].owner===pid).length/cs.length; }
  function reinforce(p){ return Math.max(3, Math.floor(owned(p.pid).length/3)) + contsOf(p.pid).reduce((s,c)=>s+CONT[c].b,0); }
  function log(html){ logs.unshift(html); if(logs.length>5) logs.length=5; renderLog(); }
  async function nap(ms){ await U.sleep(ms); while(paused && !over) await U.sleep(120); }

  /* dice: sort desc, pair-compare, tie → defender */
  function rollRound(nA,nD){
   const R=()=>1+Math.floor(rng()*6);
   const a=[...Array(nA)].map(R).sort((x,y)=>y-x), d=[...Array(nD)].map(R).sort((x,y)=>y-x);
   let la=0, ld=0;
   for(let i=0;i<Math.min(nA,nD);i++){ if(a[i]>d[i]) ld++; else la++; }
   return {a,d,la,ld};
  }
  const OM={};
  function odds(A,D){ const k=A+'v'+D; if(OM[k]!=null) return OM[k];
   let w=0; for(let i=0;i<140;i++){ let a=A,d=D;
    while(a>1&&d>0){ const r=rollRound(Math.min(3,a-1),Math.min(2,d)); a-=r.la; d-=r.ld; }
    if(d<=0) w++; }
   return OM[k]=w/140; }

  /* ---------- cards ---------- */
  function drawCard(){ if(!deck.length){ deck=U.shuffle(discard,rng); discard=[]; } return deck.pop()||null; }
  function setOK(cs){ const n=cs.filter(c=>c.type!=='wild').map(c=>c.type);
   if(n.length<3) return true;
   return n.every(x=>x===n[0]) || new Set(n).size===3; }
  function findSet(hand){ for(let i=0;i<hand.length;i++) for(let j=i+1;j<hand.length;j++) for(let k=j+1;k<hand.length;k++)
   if(setOK([hand[i],hand[j],hand[k]])) return [i,j,k];
   return null; }
  function tradeSet(p, idxs){
   const cs = idxs.map(i=>p.cards[i]).filter(Boolean);
   p.cards = p.cards.filter((c,i)=>!idxs.includes(i));
   discard.push(...cs);
   const v = [4,6,8,10,12,15][Math.min(sets,5)] + (sets>5? (sets-5)*5 : 0);
   sets++; pool += v;
   let b=0; cs.forEach(c=>{ if(c.terr && terr[c.terr] && terr[c.terr].owner===p.pid){ terr[c.terr].armies+=2; b++; } });
   log(tt('logTrade',{p:esc(p.name),n:fmt(v)}) + (b? ` <b style="color:var(--ok)">+${fmt(b*2)} ${FA?'روی سرزمین خودت':''}</b>`:''));
  }

  /* ---------- conquest bookkeeping ---------- */
  function afterCapture(pid, tId, prev){
   const p = pBy(pid);
   if(!conquered){ conquered=true; const c=drawCard(); if(c) p.cards.push(c); }
   U.vibrate(28); PV.sound.play('pop');
   log(tt('logCap',{p:esc(p.name),t:esc(tname(byId[tId]))}));
   const dp = pBy(prev);
   if(dp && dp.alive && owned(dp.pid).length===0){
    dp.alive=false; log('<b style="color:var(--err)">'+tt('logElim',{p:esc(dp.name)})+'</b>');
    p.cards.push(...dp.cards); dp.cards=[];
    if(!dp.bot){ gameOver(p); return; }
   }
   const before = p._conts||[], now = contsOf(pid);
   for(const c of now) if(!before.includes(c)) log('<b style="color:var(--gold)">'+tt('logCont',{p:esc(p.name),c:tt('conts.'+c)})+'</b>');
   p._conts = now;
   if(owned(pid).length===42) gameOver(p);
   else if(players.filter(x=>x.alive).length===1) gameOver(p);
  }

  /* ---------- battle modal (human interactive / bot auto) ---------- */
  function openBattle(fId, tId, botMode){
   return new Promise(resolve=>{
    const F=terr[fId], T=terr[tId];
    const attP=pBy(F.owner), defP=pBy(T.owner);
    let aA=F.armies, aD=T.armies, used=Math.min(3,aA-1), doneR=false;
    const ov = el(`<div class="pvrisk-ov"><div class="pvrisk-mo"></div></div>`);
    rootEl.appendChild(ov);
    const box = ov.firstElementChild;
    box.innerHTML = `<h3>⚔ ${esc(tname(byId[fId]))} ⟶ ${esc(tname(byId[tId]))}</h3>
     <div class="pvrisk-vs"><span id="rk-va" style="color:${attP.color}">${esc(attP.name)} · ${fmt(aA)}</span><b>⚔</b><span id="rk-vd" style="color:${defP.color}">${esc(defP.name)} · ${fmt(aD)}</span></div>
     <div id="rk-da"></div><div id="rk-dd"></div>
     <div class="pvrisk-res" id="rk-res"></div><div id="rk-ctl"></div>`;
    const resEl=box.querySelector('#rk-res'), ctl=box.querySelector('#rk-ctl');
    const dieRow=(cls,n)=>`<div class="pvrisk-dice">${[...Array(n)].map(()=>`<div class="pvrisk-die ${cls}">${PIPS[Math.floor(rng()*6)]}</div>`).join('')}</div>`;
    const setDice=(na,nd)=>{ box.querySelector('#rk-da').innerHTML=dieRow('a',na); box.querySelector('#rk-dd').innerHTML=dieRow('d',nd); };
    async function anim(cls,rolls){
     const ds=[...box.querySelectorAll('.pvrisk-die.'+cls)];
     ds.forEach(d=>d.classList.add('roll'));
     const iv=setInterval(()=>ds.forEach(d=>d.textContent=PIPS[Math.floor(rng()*6)]),90);
     await U.sleep(760); clearInterval(iv);
     ds.forEach((d,i)=>{ d.classList.remove('roll'); d.textContent=PIPS[rolls[i]-1]; });
    }
    function sync(){ F.armies=aA; T.armies=aD;
     const va=box.querySelector('#rk-va'), vd=box.querySelector('#rk-vd');
     if(va) va.textContent=`${esc(attP.name)} · ${fmt(aA)}`;
     if(vd) vd.textContent=`${esc(defP.name)} · ${fmt(aD)}`;
     renderMap(); }
    function finish(){
     if(doneR) return; doneR=true; ov.remove();
     resolve({captured: T.owner===attP.pid});
    }
    function finishCapture(mv){
     T.owner=attP.pid; T.armies=mv; F.armies=aA-mv;
     afterCapture(attP.pid, tId, defP.pid);
     renderAll(); finish();
    }
    function hSelect(msg){
     const mx=Math.max(1,Math.min(3,aA-1)); used=clamp(used,1,mx);
     setDice(used, Math.min(2,aD));
     resEl.textContent=msg||''; resEl.className='pvrisk-res';
     ctl.innerHTML=`<div class="pvrisk-chips">${[1,2,3].filter(n=>n<=mx).map(n=>`<button data-n="${n}" class="${n===used?'on':''}">${fmt(n)}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;justify-content:center">
       <button class="pvrisk-btn ok" id="rk-go">${tt('roll')}</button>
       <button class="pvrisk-btn" id="rk-close">${tt('close')}</button></div>`;
     ctl.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ used=+b.dataset.n; hSelect(); });
     ctl.querySelector('#rk-go').onclick=hRoll;
     ctl.querySelector('#rk-close').onclick=finish;
    }
    async function hRoll(){
     const nD=Math.min(2,aD), nA=used, r=rollRound(nA,nD);
     ctl.innerHTML=''; setDice(nA,nD); PV.sound.play('flip');
     await Promise.all([anim('a',r.a), anim('d',r.d)]);
     aA-=r.la; aD-=r.ld; sync();
     if(aD<=0){
      const mn=Math.min(used, Math.max(1,aA-1)), mx=Math.max(1,aA-1);
      resEl.textContent=tt('capT'); resEl.className='pvrisk-res good';
      ctl.innerHTML=`<div class="pvrisk-mvrow"><span>${tt('moveQ')}</span><b id="rk-slv" style="font-size:19px">${fmt(mx)}</b></div>
       <input type="range" class="pvrisk-slider" id="rk-sl" min="${mn}" max="${mx}" value="${mx}">
       <button class="pvrisk-btn ok" id="rk-mv">${tt('ok')}</button>`;
      const sl=ctl.querySelector('#rk-sl');
      sl.oninput=()=>ctl.querySelector('#rk-slv').textContent=fmt(+sl.value);
      ctl.querySelector('#rk-mv').onclick=()=>finishCapture(+sl.value);
     } else {
      resEl.innerHTML=`−${fmt(r.la)} ${tt('attacker')} · −${fmt(r.ld)} ${tt('defender')}`;
      if(aA<=1){ ctl.innerHTML=`<button class="pvrisk-btn" id="rk-close">${tt('close')}</button>`; }
      else ctl.innerHTML=`<div style="display:flex;gap:8px;justify-content:center">
       <button class="pvrisk-btn ok" id="rk-again">${tt('again')}</button>
       <button class="pvrisk-btn" id="rk-close">${tt('close')}</button></div>`;
      ctl.querySelector('#rk-close').onclick=finish;
      const ag=ctl.querySelector('#rk-again'); if(ag) ag.onclick=()=>{ used=clamp(used,1,Math.min(3,aA-1)); hSelect(); };
     }
    }
    async function botFlow(){
     log(tt('logAtk',{a:esc(attP.name),f:esc(tname(byId[fId])),t:esc(tname(byId[tId]))}));
     for(let g=0; g<8 && aD>0 && aA>1 && !over; g++){
      await nap(680); if(over) break;
      used=Math.min(3,aA-1);
      const r=rollRound(used, Math.min(2,aD));
      setDice(used, Math.min(2,aD)); PV.sound.play('flip');
      await Promise.all([anim('a',r.a), anim('d',r.d)]);
      aA-=r.la; aD-=r.ld; sync();
     }
     await nap(420);
     if(aD<=0 && !over) finishCapture(Math.max(1,aA-1));
     else finish();
    }
    if(botMode) botFlow(); else { log(tt('logAtk',{a:esc(attP.name),f:esc(tname(byId[fId])),t:esc(tname(byId[tId]))})); hSelect(); }
   });
  }

  /* ---------- small modal: fortify slider ---------- */
  function openMove(title, mn, mx){
   return new Promise(res=>{
    const ov=el(`<div class="pvrisk-ov"><div class="pvrisk-mo"><h3>${esc(title)}</h3>
     <b id="rk-mvv" style="font-size:20px">${fmt(mx)}</b>
     <input type="range" class="pvrisk-slider" id="rk-sl" min="${mn}" max="${mx}" value="${mx}">
     <div style="display:flex;gap:8px;justify-content:center">
      <button class="pvrisk-btn ok" id="rk-ok">${tt('ok')}</button>
      <button class="pvrisk-btn" id="rk-no">${tt('close')}</button></div></div></div>`);
    rootEl.appendChild(ov);
    const sl=ov.querySelector('#rk-sl');
    sl.oninput=()=>ov.querySelector('#rk-mvv').textContent=fmt(+sl.value);
    ov.querySelector('#rk-ok').onclick=()=>{ ov.remove(); res(+sl.value); };
    ov.querySelector('#rk-no').onclick=()=>{ ov.remove(); res(null); };
   });
  }

  /* ---------- cards drawer ---------- */
  function openCards(forced){
   return new Promise(resolve=>{
    const ov=el(`<div class="pvrisk-ov"><div class="pvrisk-mo"></div></div>`);
    rootEl.appendChild(ov);
    const box=ov.firstElementChild, selset=new Set();
    function info(m){ box.querySelector('#rk-cinfo').textContent=m; }
    function draw(){
     const h=me().cards;
     box.innerHTML=`<h3>🃏 ${tt('cardsT')}</h3>
      ${forced&&h.length>=5?`<div class="pvrisk-res bad">${tt('forced')}</div>`:''}
      ${h.length?`<div class="pvrisk-cardgrid">${h.map((c,i)=>`<div class="pvrisk-card ${selset.has(i)?'on':''}" data-i="${i}"><b>${CEMO[c.type]}</b>${c.terr?esc(tname(byId[c.terr])):tt('wild')}<span>${tt(c.type)}</span></div>`).join('')}</div>`
       :`<div class="pvrisk-res">${tt('empty')}</div>`}
      <div class="pvrisk-res" id="rk-cinfo"></div>
      <div style="display:flex;gap:8px;justify-content:center">
       <button class="pvrisk-btn ok" id="rk-trade" ${h.length<3?'disabled':''}>${tt('trade')}</button>
       <button class="pvrisk-btn" id="rk-cclose" ${forced&&h.length>=5?'disabled':''}>${tt('close')}</button>
      </div>`;
     box.querySelectorAll('.pvrisk-card').forEach(d=>d.onclick=()=>{
      const i=+d.dataset.i;
      if(selset.has(i)) selset.delete(i); else if(selset.size<3) selset.add(i);
      draw();
     });
     box.querySelector('#rk-trade').onclick=()=>{
      if(phase!=='deploy'||cur().bot){ info(tt('onlyDeploy')); return; }
      if(selset.size!==3){ info(tt('need3')); return; }
      if(!setOK([...selset].map(i=>me().cards[i]))) { info(tt('badSet')); return; }
      tradeSet(me(),[...selset]); selset.clear(); PV.sound.play('coin');
      renderAll();
      if(forced && me().cards.length>=5) draw(); else { ov.remove(); resolve(); }
     };
     box.querySelector('#rk-cclose').onclick=()=>{ ov.remove(); resolve(); };
    }
    draw();
   });
  }

  /* ---------- rendering ---------- */
  function actionable(id){
   if(over || cur().bot) return false;
   const t=terr[id], mp=mePid();
   if(phase==='deploy') return pool>0 && t.owner===mp;
   if(phase==='attack') return !sel
    ? (t.owner===mp && t.armies>=2)
    : (id===sel || (t.owner!==mp && byId[sel].adj.includes(id)));
   if(phase==='fortify') return (!fortified && !sel)
    ? (t.owner===mp && t.armies>=2)
    : (!fortified && sel && fortReach && fortReach.has(id));
   return false;
  }
  function renderMap(){
   for(const t of TERR){
    const st=terr[t.id], p=pBy(st.owner), path=pathEls[t.id];
    path.setAttribute('fill', p? p.color : '#9aa0b8');
    path.setAttribute('fill-opacity', p? .82 : .4);
    path.classList.toggle('act', actionable(t.id));
    path.classList.toggle('sel', sel===t.id);
    path.classList.toggle('tgt', !!(sel && phase==='attack' && t.id!==sel && t.owner!==mePid() && byId[sel].adj.includes(t.id)));
    badgeEls[t.id].textContent = fmt(st.armies);
   }
  }
  function renderTop(){
   const idx={deploy:0,attack:1,fortify:2}[phase];
   const pi = idx==null? 3 : (phase==='fortify'&&fortified? 3 : idx);
   phasesEl.innerHTML=['deploy','attack','fortify','end'].map((k,i)=>
    `<span class="pvrisk-ph ${i===pi?'on':''} ${i<pi?'done':''}">${tt(k)}</span>`).join('');
   poolEl.textContent = (phase==='deploy'&&pool>0)? `${tt('pool')}: ${fmt(pool)}` : '';
   btnCards.textContent = `🃏 ${fmt(me()? me().cards.length:0)}`;
   btnAct.style.display='none'; btnAct.onclick=null;
   if(over || !me() || cur().bot) return;
   if(phase==='deploy' && pool>0){ btnAct.textContent='⚡ '+tt('auto'); btnAct.style.display=''; btnAct.onclick=autoPlace; }
   else if(phase==='attack'){ btnAct.textContent=tt('endAtk'); btnAct.style.display=''; btnAct.onclick=()=>{ phase='fortify'; sel=null; fortReach=null; renderAll(); }; }
   else if(phase==='fortify' && !fortified){ btnAct.textContent=tt('skipFort'); btnAct.style.display=''; btnAct.onclick=endTurn; }
  }
  function renderSide(){
   rootEl.querySelector('#rk-players').innerHTML = `<div class="pvrisk-h">${FA?'بازیکنان':'Players'}</div>` +
    players.map((p,i)=>`<div class="pvrisk-prow ${i===turn&&!over?'cur':''} ${p.alive?'':'pvrisk-dead'}">
     <span class="pvrisk-dot" style="background:${p.color}"></span>
     <span style="color:${p.color}">${esc(p.name)}${p.bot?'':' ('+tt('you')+')'}</span>
     <span style="margin-inline-start:auto">⚑ ${fmt(owned(p.pid).length)} · 🪖 ${fmt(owned(p.pid).reduce((s,t)=>s+terr[t.id].armies,0))} · 🃏 ${fmt(p.cards.length)}</span>
    </div>`).join('');
   rootEl.querySelector('#rk-conts').innerHTML = `<div class="pvrisk-h">${FA?'قاره‌ها (+ارتش جایزه)':'Continents (+bonus)'}</div>` +
    Object.keys(CONT).map(c=>{
     const tot=TERR.filter(t=>t.cont===c).length;
     const owner=players.find(p=>p.alive && contsOf(p.pid).includes(c));
     return `<span class="pvrisk-chip ${owner?'full':''}" style="${owner?`background:${owner.color}`:`border-color:${CONT[c].c}`}">
      <span class="pvrisk-dot" style="background:${CONT[c].c};${owner?'background:#fff':''}"></span>
      ${tt('conts.'+c)} +${CONT[c].b} ${owner?'':'<span style="opacity:.6">('+fmt(TERR.filter(t=>t.cont===c&&terr[t.id].owner).length)+'/'+fmt(tot)+')</span>'}
     </span>`;
    }).join('');
  }
  function renderLog(){
   rootEl.querySelector('#rk-log').innerHTML = `<div class="pvrisk-h">${tt('logT')}</div><div class="pvrisk-log">${logs.join('<br>')}</div>`;
  }
  function hints(){
   if(over||!players.length) return;
   if(cur().bot){ ctx.setStatus(tt('stBot')); return; }
   if(phase==='deploy') ctx.setStatus(pool>0? tt('stDeploy') : tt('stAtkSrc'));
   else if(phase==='attack') ctx.setStatus(sel? tt('stAtkTgt') : tt('stAtkSrc'));
   else if(phase==='fortify') ctx.setStatus(fortified? tt('stFortTgt') : (sel? tt('stFortTgt') : tt('stFortSrc')));
   else ctx.setStatus('');
  }
  function banner(){
   if(over) return;
   const p=cur();
   if(!p) return;
   const ph=tt(phase==='fortify'&&fortified? 'end':phase);
   if(p.bot) ctx.setTurn(`🤖 ${esc(p.name)} — ${ph}`);
   else ctx.setTurn(`🛡 ${tt('you')} — ${ph}${phase==='deploy'&&pool>0? ' ('+fmt(pool)+')':''}`, 'me');
  }
  function renderAll(){ renderMap(); renderTop(); renderSide(); renderLog(); hints(); banner(); }

  /* ---------- human input ---------- */
  async function onTerr(id){
   if(over||busy||!players.length||cur().bot) return;
   const t=terr[id], mp=mePid();
   if(phase==='deploy'){
    if(pool>0 && t.owner===mp){ t.armies++; pool--; PV.sound.play('place');
     if(pool===0){ phase='attack'; sel=null; }
     renderAll(); }
    return;
   }
   if(phase==='attack'){
    if(t.owner===mp && t.armies>=2){ sel=(sel===id? null:id); PV.sound.play('tap'); renderAll(); return; }
    if(sel && t.owner!==mp && byId[sel].adj.includes(id)){
     busy=true;
     await openBattle(sel,id,false);
     busy=false; sel=null; renderAll();
    }
    return;
   }
   if(phase==='fortify' && !fortified){
    if(sel && fortReach && fortReach.has(id)){
     busy=true;
     const mv=await openMove(tt('moveQ'), 1, terr[sel].armies-1);
     busy=false;
     if(mv){ terr[sel].armies-=mv; terr[id].armies+=mv; fortified=true;
      log(tt('logFort',{p:esc(me().name),n:fmt(mv),f:esc(tname(byId[sel])),t:esc(tname(byId[id]))}));
      PV.sound.play('place'); }
     sel=null; fortReach=null; renderAll();
     if(mv) endTurn();
     return;
    }
    if(t.owner===mp && t.armies>=2 && id!==sel){
     sel=id; fortReach=reach(id,mp); fortReach.delete(id);
     PV.sound.play('tap'); renderAll(); return;
    }
    if(id===sel){ sel=null; fortReach=null; renderAll(); }
   }
  }
  function autoPlace(){
   if(phase!=='deploy'||pool<=0) return;
   while(pool>0){
    const own=owned(mePid()).sort((a,b)=>threat(b.id,mePid())-threat(a.id,mePid()));
    for(const t of own){ if(pool<=0) break; terr[t.id].armies++; pool--; }
   }
   PV.sound.play('place'); phase='attack'; sel=null; renderAll();
  }

  /* ---------- setup ---------- */
  function setup(){
   const hp = (ctx.players&&ctx.players[0]) || {};
   players=[{ pid: hp.pid||ctx.selfPid||'me', name: hp.name||(FA?'شما':'You'), bot:false, color:PC[0], alive:true, cards:[], _conts:[] }];
   const bn = FA? ['آریو','رستم','سودابه'] : ['Ario','Rostam','Sudabeh'];
   for(let i=1;i<4;i++) players.push({ pid:'BOT:'+i, name:bn[i-1], bot:true, color:PC[i], alive:true, cards:[], _conts:[] });
   const per={2:40,3:35,4:30}[players.length]||30;
   terr={}; TERR.forEach(t=>terr[t.id]={owner:null,armies:0});
   const order=U.shuffle(TERR.map(t=>t.id), rng);
   order.forEach((id,i)=>{ const p=players[i%players.length]; terr[id]={owner:p.pid,armies:1}; });
   players.forEach(p=>{ p.left = per - order.filter((_,i2)=>players[i2%players.length]===p).length; });
   deck=U.shuffle(TERR.map((t,i)=>({terr:t.id,type:CTYPE[i%3]})), rng);
   deck.push({terr:null,type:'wild'},{terr:null,type:'wild'});
   discard=[]; sets=0; turn=0; phase='deploy'; over=false; finished=false;
   conquered=false; fortified=false; busy=false; sel=null; fortReach=null; logs=[]; zoom=1; applyVB();
  }

  /* ---------- turn engine ---------- */
  async function startTurn(i){
   if(over) return;
   turn=i; const p=cur();
   conquered=false; fortified=false; sel=null; fortReach=null; phase='deploy';
   pool = (p.left!=null)? p.left : reinforce(p);
   p.left=null;
   log('<b>'+tt('logTurn',{p:esc(p.name)})+'</b>');
   renderAll();
   if(!p.bot && p.cards.length>=5) await openCards(true);
   if(over) return;
   if(p.bot){ busy=true; renderAll(); await aiTurn(p); busy=false; }
   else renderAll();
  }
  async function endTurn(){
   if(over) return;
   phase='end'; renderAll(); await nap(350);
   if(over) return;
   let i=turn;
   do{ i=(i+1)%players.length; }while(!players[i].alive);
   startTurn(i);
  }

  /* ---------- AI ---------- */
  async function aiDeploy(p){
   while(!over){ const s=findSet(p.cards); if(!s) break; tradeSet(p,s); renderAll(); await nap(560); }
   let guard=0;
   while(pool>0 && !over && guard++<300){
    const mine=owned(p.pid);
    const hard=ctx.diff==='hard', easy=ctx.diff==='easy';
    const ws=mine.map(t=>{
     let w=1+threat(t.id,p.pid);
     if(!easy){ const r=contRatio(p.pid,t.cont);
      if(r>=.5) w*=1.8; else if(hard && r>=.34) w*=1.35; }
     return w;
    });
    let r=rng()*ws.reduce((a,b)=>a+b,0), k=0;
    for(;k<ws.length-1;k++){ r-=ws[k]; if(r<=0) break; }
    terr[mine[k].id].armies++; pool--; PV.sound.play('place');
    if(pool%3===0){ renderAll(); await nap(260); }
   }
   renderAll();
  }
  async function aiAttacks(p){
   const df=ctx.diff;
   const weak = players.filter(x=>x.alive&&x.pid!==p.pid).sort((a,b)=>owned(a.pid).length-owned(b.pid).length)[0];
   for(let g=0; g<14 && !over; g++){
    const cands=[];
    for(const t of owned(p.pid)) if(terr[t.id].armies>=2)
     for(const n of byId[t.id].adj) if(terr[n].owner!==p.pid) cands.push({f:t.id,t:n});
    if(!cands.length) break;
    let pick=null, best=-9;
    for(const c of cands){
     const A=terr[c.f].armies, D=terr[c.t].armies;
     let s=odds(A,D);
     if(df==='easy') s += rng()*0.5-0.15;
     if(df==='hard'){
      if(weak && terr[c.t].owner===weak.pid) s+=.08;
      if(contRatio(p.pid,byId[c.t].cont)>=.5) s+=.12;
      if(contRatio(p.pid,byId[c.f].cont)===1 && A<=3) s-=.35;
     }
     if(s>best){ best=s; pick=c; }
    }
    const thr = df==='easy'? .3 : df==='normal'? .6 : .58;
    if(!pick || best<thr) break;
    if(df==='easy' && rng()<.35) break;
    await openBattle(pick.f, pick.t, true);
    renderAll(); await nap(430);
   }
  }
  async function aiFortify(p){
   if(ctx.diff==='easy' && rng()<.6) return;
   const mine=owned(p.pid);
   let srcs=mine.filter(t=>terr[t.id].armies>=2 && byId[t.id].adj.every(n=>terr[n].owner===p.pid))
    .sort((a,b)=>terr[b.id].armies-terr[a.id].armies);
   if(!srcs.length) srcs=mine.filter(t=>terr[t.id].armies>=4).sort((a,b)=>terr[b.id].armies-terr[a.id].armies);
   for(const s of srcs){
    const R=reach(s.id,p.pid); R.delete(s.id);
    let bt=null, bv=-1;
    for(const id of R){ const v=threat(id,p.pid); if(v>bv){ bv=v; bt=id; } }
    if(bt && bv>0){
     const mv=terr[s.id].armies-1;
     terr[s.id].armies-=mv; terr[bt].armies+=mv; fortified=true;
     log(tt('logFort',{p:esc(p.name),n:fmt(mv),f:esc(tname(byId[s.id])),t:esc(tname(byId[bt]))}));
     PV.sound.play('place'); renderAll(); await nap(620);
    }
    break;
   }
  }
  async function aiTurn(p){
   await nap(700); if(over) return;
   await aiDeploy(p); if(over) return;
   phase='attack'; renderAll(); await nap(400); if(over) return;
   await aiAttacks(p); if(over) return;
   phase='fortify'; renderAll(); await nap(300); if(over) return;
   await aiFortify(p); if(over) return;
   endTurn();
  }

  /* ---------- game over ---------- */
  function gameOver(w){
   if(over) return;
   over=true;
   const myWin = w.pid===mePid();
   const scores={}; players.forEach(p=>scores[p.pid]=owned(p.pid).length);
   ctx.setTurn(myWin? '🏆 '+tt('vic') : tt('def',{p:esc(w.name)}), myWin?'win':'lose');
   ctx.setStatus('');
   PV.sound.play(myWin?'win':'lose');
   setTimeout(()=>{
    if(finished) return; finished=true;
    ctx.finish({ res:myWin?'w':'l', scores, vsHuman:false,
     sub: myWin? '' : w.name,
     stats:{ territories:owned(mePid()).length, continents:contsOf(mePid()).length } });
   }, 800);
  }

  /* ---------- lifecycle ---------- */
  btnCards.onclick=()=>{ if(!busy && !cur().bot && me()) openCards(false); };
  return {
   init(){},
   start(){ setup(); renderAll(); log(tt('logDeal')); startTurn(0); },
   pause(){ paused=true; },
   resume(){ paused=false; },
   end(){ over=true; },
   reset(){ setup(); renderAll(); log(tt('logDeal')); startTurn(0); },
   getState(){ return { turn, phase, pool, players:players.map(p=>({pid:p.pid,alive:p.alive})) }; },
   getScores(){ const s={}; players.forEach(p=>s[p.pid]=owned(p.pid).length); return s; },
   getStatus(){ return over? '' : (phase==='deploy'? tt('deploy') : phase==='attack'? tt('attack') : tt('fortify')); },
   destroy(){ over=true; rootEl.remove(); },
  };
 }
});
})();
