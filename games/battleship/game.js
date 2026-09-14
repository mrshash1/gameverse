/* ============ Game: Battleship — نبرد دریایی پرمیوم ============
   • دو گرید 10x10: آب‌های خودی (ناوها پیداست) + آب‌های دشمن (مه جنگی)
   • ناوگان: ناو هواپیمابر ۵ · نبردناو ۴ · رزامیر ۳ · زیردریایی ۳ · ناوشکن ۲
   • چیدمان دستی (سر ناو + جهت) یا خودکار · ممنوعیت تماس/تداخل
   • انیمیشن شلیک (قوس پوکه + آب/آتش/دود) · نوار وضعیت ناوگان دو طرف
   • بات ۳ سطح: آسان تصادفی · متوسط شکار/هدف · سخت parity + نقشه‌ی چگالی احتمال
   • آنلاین host-authoritative: placed → turn → shot/res → over (بدون لو رفتن تخته)
================================================================ */
(function(){
'use strict';
const PV = window.PV, U = PV.u;
const { fmt } = U;

/* --------------------------- local dict --------------------------- */
const lang = (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    myWaters:'🚢 آب‌های من', enWaters:'🌊 آب‌های دشمن',
    'ship.carrier':'ناو هواپیمابر','ship.battleship':'نبردناو','ship.cruiser':'رزامیر','ship.sub':'زیردریایی','ship.destroyer':'ناوشکن',
    pickShip:'یکی از ناوها را از فهرست انتخاب کن', pickBow:'خانه‌ی «سرِ» ناو را روی آب‌های خودت بزن',
    pickDir:'جهت ناو را انتخاب کن (سرِ ناو همان‌جا که زدی می‌ماند)', noRoom:'اینجا جا نیست! یا به ناوی دیگر چسبیده است',
    auto:'🎲 چیدمان خودکار', clear:'🧹 پاک کردن', start:'⚔️ شروع نبرد',
    waitOpp:'⏳ در انتظار چیدمان حریف…', firing:'⏳ در حال شلیک…',
    yourTurn:'🎯 نوبت شما — شلیک کن!', oppTurn:'🔊 دشمن نشانه گرفته…',
    sunkIt:'غرق شد!', lostIt:'ناوی از ناوگان تو غرق شد',
    victory:'🏆 بردی! ناوگان دشمن به قعر دریا رفت', defeat:'💀 باختی — ناوگانت غرق شد',
    endShots:'تعداد شلیک‌ها: {n}', hits:'اصابت', stPlace:'چیدمان ناوها',
    placed:'ناوگان آماده است — شروع کن!', fleetDied:'ناوگان تو نابود شد…',
  },
  en:{
    myWaters:'🚢 My Waters', enWaters:'🌊 Enemy Waters',
    'ship.carrier':'Aircraft Carrier','ship.battleship':'Battleship','ship.cruiser':'Cruiser','ship.sub':'Submarine','ship.destroyer':'Destroyer',
    pickShip:'Pick a ship from the fleet', pickBow:'Tap your waters to set the ship bow',
    pickDir:'Choose the ship direction (bow stays where you tapped)', noRoom:'No room here! It touches another ship or the edge',
    auto:'🎲 Auto-place', clear:'🧹 Clear', start:'⚔️ Start Battle',
    waitOpp:'⏳ Waiting for opponent…', firing:'⏳ Firing…',
    yourTurn:'🎯 Your turn — fire!', oppTurn:'🔊 Enemy is aiming…',
    sunkIt:'Sunk!', lostIt:'One of your ships was sunk',
    victory:'🏆 Victory! Enemy fleet destroyed', defeat:'💀 Defeat — your fleet is gone',
    endShots:'Shots: {n}', hits:'Hits', stPlace:'Place your fleet',
    placed:'Fleet ready — start the battle!', fleetDied:'Your fleet was destroyed…',
  },
};
function tt(k, vars){
  const src = (L[lang] && L[lang][k]!=null) ? L[lang] : L.fa;
  let s = src[k]!=null ? src[k] : (L.fa[k]!=null ? L.fa[k] : k);
  if(vars) for(const key in vars) s = s.split('{'+key+'}').join(vars[key]);
  return s;
}

/* ------------------------------ fleet ------------------------------ */
const FLEET = [
  {id:'carrier',    size:5, col:'#ff5c4d', col2:'#ffb27a'},
  {id:'battleship', size:4, col:'#f0a020', col2:'#ffd37a'},
  {id:'cruiser',    size:3, col:'#00c9bd', col2:'#7ceee6'},
  {id:'sub',        size:3, col:'#3ba9ff', col2:'#9bd4ff'},
  {id:'destroyer',  size:2, col:'#b44dff', col2:'#e0b0ff'},
];
const DIRS = { N:{dx:0,dy:-1}, S:{dx:0,dy:1}, E:{dx:1,dy:0}, W:{dx:-1,dy:0} };
const mk10 = v => Array.from({length:10}, ()=>Array(10).fill(v));

const SHIP_CSS = `
.pvship{--cell:min(calc((min(92vw,470px) - 30px)/10), 40px);position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;padding:4px 0 14px;width:100%}
.pvship-arena{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;width:100%}
.pvship-side{display:flex;flex-direction:column;align-items:center;gap:8px}
.pvship-shead{display:flex;align-items:center;gap:9px;font-weight:900;font-size:.95rem}
.pvship-mini{font-size:.72rem;font-weight:800;color:var(--tx2);background:var(--surface2);border:1px solid var(--border);padding:2px 9px;border-radius:999px}
.pvship-gwrap{position:relative;direction:ltr;border-radius:18px;padding:6px;background:linear-gradient(155deg,#0d3f77,#0a5d95 48%,#0d84b7);box-shadow:inset 0 2px 18px rgba(0,10,40,.5),0 16px 32px -14px rgba(13,63,119,.6)}
.pvship-gwrap::after{content:'';position:absolute;inset:6px;border-radius:13px;pointer-events:none;background:linear-gradient(120deg,transparent 32%,rgba(255,255,255,.14) 50%,transparent 68%);background-size:260% 260%;animation:pvshim 5.5s ease-in-out infinite}
@keyframes pvshim{0%,100%{background-position:0% 0%}50%{background-position:100% 100%}}
.pvship-grid{display:grid;grid-template-columns:repeat(10,var(--cell));grid-auto-rows:var(--cell);gap:2px;position:relative;z-index:1}
.pvship-cell{width:var(--cell);height:var(--cell);border-radius:6px;background:rgba(255,255,255,.13);box-shadow:inset 0 0 0 1px rgba(255,255,255,.11);position:relative;transition:transform .12s,background .2s}
.pvship-grid.live .pvship-cell:hover{background:rgba(255,255,255,.42);transform:scale(1.16);z-index:3;box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 0 0 1.5px rgba(255,255,255,.65);cursor:crosshair}
.pvship-grid.place .pvship-cell{cursor:copy}
.pvship-grid.place .pvship-cell:hover{background:rgba(255,255,255,.35)}
.pvship-cell.ghost{background:rgba(255,255,255,.45)!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.8)}
.pvship-cell.ghost.bad{background:rgba(255,70,70,.5)!important}
.pvship-cell.miss::after{content:'';position:absolute;inset:36%;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 7px rgba(255,255,255,.5)}
.pvship-cell.ehit{background:radial-gradient(circle at 50% 45%,#fff3c4 0%,#ffb020 26%,#ff5c4d 62%,#8c2f1b 100%);box-shadow:inset 0 0 8px rgba(60,10,0,.7);animation:pvhit .3s ease}
@keyframes pvhit{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.pvship-cell.hull{background:linear-gradient(145deg,var(--hc2,#ccc),var(--hc,#999));box-shadow:inset 0 -5px 8px rgba(0,0,0,.3),inset 0 2px 3px rgba(255,255,255,.5),0 2px 5px rgba(0,10,40,.35);border-radius:4px;z-index:2}
.pvship-cell.hull.h-st{background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.15) 0 4px,transparent 4px 10px),linear-gradient(145deg,var(--hc2),var(--hc))}
.pvship-cell.hull.v-st{background-image:repeating-linear-gradient(180deg,rgba(255,255,255,.15) 0 4px,transparent 4px 10px),linear-gradient(145deg,var(--hc2),var(--hc))}
.pvship-cell.bowL{clip-path:polygon(0 50%,30% 0,100% 0,100% 100%,30% 100%);border-radius:0}
.pvship-cell.bowR{clip-path:polygon(0 0,70% 0,100% 50%,70% 100%,0 100%);border-radius:0}
.pvship-cell.bowT{clip-path:polygon(50% 0,100% 30%,100% 100%,0 100%,0 30%);border-radius:0}
.pvship-cell.bowB{clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%);border-radius:0}
.pvship-cell.capL{border-radius:10px 3px 3px 10px}.pvship-cell.capR{border-radius:3px 10px 10px 3px}
.pvship-cell.capT{border-radius:10px 10px 3px 3px}.pvship-cell.capB{border-radius:3px 3px 10px 10px}
.pvship-cell.hull.dmg::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(255,240,180,.95) 0%,rgba(255,140,40,.85) 35%,rgba(200,50,30,.7) 70%,transparent 100%);animation:pvflick 1.1s infinite}
.pvship-cell.hull.sunkd{filter:saturate(.45) brightness(.55)}
.pvship-cell.hull.sunkd::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(255,190,120,.75) 0%,rgba(220,70,40,.6) 45%,transparent 80%);animation:pvflick 1.4s infinite}
@keyframes pvflick{0%,100%{opacity:.85}50%{opacity:.55}}
.pvship-fbar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:calc(var(--cell)*10 + 30px)}
.pvship-fchip{display:flex;align-items:center;gap:7px;padding:4px 9px;border-radius:11px;background:var(--surface);border:1.5px solid var(--border);font-size:.72rem;font-weight:800;transition:.25s}
.pvship-fchip .segs{display:flex;gap:2.5px;direction:ltr}
.pvship-fchip .segs i{width:9px;height:9px;border-radius:3px;background:var(--fc);box-shadow:inset 0 -2px 2px rgba(0,0,0,.25);transition:.2s}
.pvship-fchip .segs i.hit{background:#ff5c4d;box-shadow:0 0 7px rgba(255,92,77,.85)}
.pvship-fchip.dead{opacity:.5;filter:grayscale(.85)}
.pvship-fchip.dead b{text-decoration:line-through}
.pvship-fchip.soft{background:var(--surface2)}
.pvship-place{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
.pvship-fleetrow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pvship-shipbtn{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 10px;border-radius:14px;background:var(--surface);border:1.5px solid var(--border);font-size:.72rem;font-weight:800;transition:.2s;min-width:78px;color:var(--tx)}
.pvship-shipbtn:hover{transform:translateY(-2px);box-shadow:var(--sh-2)}
.pvship-shipbtn.sel{border-color:var(--p1);box-shadow:var(--glow-p);transform:translateY(-2px)}
.pvship-shipbtn.done{opacity:.45}
.pvship-shipbtn .mini{display:flex;gap:2px;direction:ltr}
.pvship-shipbtn .mini i{width:12px;height:12px;border-radius:3px;background:linear-gradient(145deg,var(--hc2),var(--hc));box-shadow:inset 0 -2px 2px rgba(0,0,0,.3)}
.pvship-shipbtn .mini i:first-child{clip-path:polygon(0 50%,30% 0,100% 0,100% 100%,30% 100%)}
.pvship-hint{min-height:22px;font-size:.8rem;font-weight:700;color:var(--tx2);text-align:center;max-width:92vw}
.pvship-pbtns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pvship-btn{padding:8px 16px;border-radius:13px;font-weight:800;font-size:.85rem;background:var(--surface);border:1.5px solid var(--border);transition:.2s;color:var(--tx)}
.pvship-btn:hover{transform:translateY(-1px);box-shadow:var(--sh-1)}
.pvship-btn.primary{background:var(--grad-p);color:#fff;border:none;box-shadow:var(--sh-p)}
.pvship-btn:disabled{opacity:.45;pointer-events:none}
.pvship-dirpad{display:flex;gap:8px;padding:8px;background:var(--surface);border:1.5px solid var(--border);border-radius:16px;box-shadow:var(--sh-2);animation:pvrise .22s ease;align-items:center}
.pvship-dir{width:44px;height:44px;border-radius:12px;background:var(--surface2);border:1.5px solid var(--border);font-size:1.15rem;display:grid;place-items:center;transition:.15s;color:var(--tx)}
.pvship-dir:hover{background:var(--p1);color:#fff;transform:scale(1.08)}
.pvship-dir.bad{animation:pvshake .3s}
.pvship-dirpad .x{color:var(--err)}
.pvship-wait{display:flex;align-items:center;gap:10px;font-weight:800;padding:12px 22px;border-radius:16px;background:var(--surface2);border:1.5px solid var(--border)}
.pvship-wait .spin{width:18px;height:18px;border-radius:50%;border:3px solid var(--border2);border-top-color:var(--p1);animation:pvspin .8s linear infinite}
@keyframes pvspin{to{transform:rotate(360deg)}}
@keyframes pvrise{from{opacity:0;transform:translateY(8px) scale(.94)}to{opacity:1;transform:none}}
@keyframes pvshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.pvship-layer{position:absolute;inset:0;pointer-events:none;z-index:6}
.pvshell{position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px;animation:pvshell-fly var(--dur,.5s) linear forwards;z-index:7}
.pvshell::before{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,#fff,#ffd54f 45%,#ff7043 80%,transparent);box-shadow:0 0 16px 5px rgba(255,180,60,.85);animation:pvshell-arc var(--dur,.5s) ease-in-out forwards}
@keyframes pvshell-fly{from{transform:translate(var(--sx),var(--sy))}to{transform:translate(var(--ex),var(--ey))}}
@keyframes pvshell-arc{0%{transform:translateY(0)}45%{transform:translateY(var(--peak,-80px))}100%{transform:translateY(0)}}
.pvrip{position:absolute;width:var(--cell);height:var(--cell);margin:calc(var(--cell)/-2);pointer-events:none}
.pvrip i{position:absolute;inset:0;border-radius:50%;border:2.5px solid rgba(190,235,255,.9);animation:pvrip .9s ease-out forwards;opacity:0}
.pvrip i:nth-child(2){animation-delay:.18s;border-color:rgba(255,255,255,.75)}
.pvrip::after{content:'💧';position:absolute;inset:0;display:grid;place-items:center;font-size:14px;animation:pvripfade .8s ease-out forwards}
@keyframes pvrip{0%{transform:scale(.25);opacity:1}100%{transform:scale(1.55);opacity:0}}
@keyframes pvripfade{0%{opacity:1}100%{opacity:0;transform:translateY(-9px)}}
.pvboom{position:absolute;width:var(--cell);height:var(--cell);margin:calc(var(--cell)/-2);pointer-events:none}
.pvboom .fl{position:absolute;inset:-12%;border-radius:50%;background:radial-gradient(circle,#fff8d9 0%,#ffd54f 24%,#ff7043 55%,rgba(200,40,20,0) 78%);animation:pvboomf .55s ease-out forwards}
.pvboom .ring{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(255,200,120,.9);animation:pvrip .6s ease-out forwards}
.pvboom .smoke{position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(130,130,145,.6);filter:blur(3px);animation:pvsmoke 1.1s ease-out forwards}
@keyframes pvboomf{0%{transform:scale(.3);opacity:1}100%{transform:scale(1.75);opacity:0}}
@keyframes pvsmoke{0%{transform:translate(0,0) scale(.6);opacity:.9}100%{transform:translate(var(--sdx,8px),-28px) scale(2.2);opacity:0}}
.pvship-sbanner{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%) scale(.55);opacity:0;pointer-events:none;z-index:30;padding:13px 30px;border-radius:20px;background:linear-gradient(135deg,rgba(20,26,60,.94),rgba(70,24,54,.94));color:#fff;font-weight:900;font-size:1.12rem;text-align:center;box-shadow:0 18px 50px -10px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.2);transition:.3s cubic-bezier(.34,1.56,.64,1);max-width:92vw}
.pvship-sbanner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.pvship-sbanner .sm{display:block;font-size:.8rem;font-weight:700;opacity:.9;margin-top:2px}
.pvship-sbanner.good{background:linear-gradient(135deg,#0d7a4d,#12b886)}
.pvship-sbanner.bad{background:linear-gradient(135deg,#8c1f33,#c0392b)}
`;

/* ------------------------------ register ------------------------------ */
PV.registry.register({
  id:'battleship', cats:['board','strategy','classic'], players:[2,2], modes:['solo','online'], weight:91,
  factory: function(ctx){

    const isMP = ctx.mode !== 'solo';
    const players = ctx.players || [];
    const seats = isMP ? players.map(p=>p && p.pid) : ['me','BOT:1'];
    const mySeat  = isMP ? Math.max(0, seats.indexOf(ctx.selfPid)) : 0;
    const oppSeat = 1 - mySeat;
    const myKey  = isMP ? ctx.selfPid : 'me';
    const oppKey = seats[oppSeat] || 'BOT:1';
    const botLevel = ctx.diff==='easy' ? 'easy' : ctx.diff==='hard' ? 'hard' : 'normal';

    /* ------------------------------ dom ------------------------------ */
    const root = document.createElement('div');
    root.className = 'pvship';
    root.innerHTML = `<style>${SHIP_CSS}</style>
      <div class="pvship-arena">
        <section class="pvship-side">
          <header class="pvship-shead"><b>${tt('enWaters')}</b><span class="pvship-mini" id="pvship-miniE"></span></header>
          <div class="pvship-gwrap" id="pvship-wrapE">
            <div class="pvship-grid" id="pvship-gridE"></div>
            <div class="pvship-layer" id="pvship-layerE"></div>
          </div>
          <div class="pvship-fbar" id="pvship-fbarE"></div>
        </section>
        <section class="pvship-side">
          <header class="pvship-shead"><b>${tt('myWaters')}</b><span class="pvship-mini" id="pvship-miniM"></span></header>
          <div class="pvship-gwrap" id="pvship-wrapM">
            <div class="pvship-grid" id="pvship-gridM"></div>
            <div class="pvship-layer" id="pvship-layerM"></div>
          </div>
          <div class="pvship-fbar" id="pvship-fbarM"></div>
        </section>
      </div>
      <div class="pvship-place" id="pvship-place">
        <div class="pvship-fleetrow" id="pvship-fleet"></div>
        <div class="pvship-dirpad hidden" id="pvship-dirpad">
          <button class="pvship-dir" data-dir="N">⬆</button>
          <button class="pvship-dir" data-dir="S">⬇</button>
          <button class="pvship-dir" data-dir="E">➡</button>
          <button class="pvship-dir" data-dir="W">⬅</button>
          <button class="pvship-dir x" id="pvship-dircancel">✖</button>
        </div>
        <div class="pvship-hint" id="pvship-hint"></div>
        <div class="pvship-pbtns">
          <button class="pvship-btn" id="pvship-auto">${tt('auto')}</button>
          <button class="pvship-btn" id="pvship-clear">${tt('clear')}</button>
          <button class="pvship-btn primary" id="pvship-start" disabled>${tt('start')}</button>
        </div>
      </div>
      <div class="pvship-wait hidden" id="pvship-wait"><span class="spin"></span>${tt('waitOpp')}</div>
      <div class="pvship-sbanner" id="pvship-sbanner"></div>`;
    ctx.root.appendChild(root);
    const $ = s => root.querySelector(s);
    const gridE=$('#pvship-gridE'), gridM=$('#pvship-gridM');
    const layerE=$('#pvship-layerE'), layerM=$('#pvship-layerM');
    const wrapE=$('#pvship-wrapE'), wrapM=$('#pvship-wrapM');
    const fleetRow=$('#pvship-fleet'), dirpad=$('#pvship-dirpad'), hintEl=$('#pvship-hint');
    const placeUI=$('#pvship-place'), waitUI=$('#pvship-wait');
    const btnAuto=$('#pvship-auto'), btnClear=$('#pvship-clear'), btnStart=$('#pvship-start');
    const sbanner=$('#pvship-sbanner'), miniE=$('#pvship-miniE'), miniM=$('#pvship-miniM');

    for(let i=0;i<100;i++){
      const ce=document.createElement('div'); ce.className='pvship-cell'; ce.dataset.x=i%10; ce.dataset.y=(i/10)|0;
      gridE.appendChild(ce);
      const cm=ce.cloneNode(); gridM.appendChild(cm);
    }

    /* ----------------------------- state ----------------------------- */
    let phase='place';                 /* place | wait | battle | over */
    let myBoard=mk10(-1);              /* shipIdx | -1 */
    let myShips=Array(5).fill(null);   /* per fleet idx: {fi,size,cells[{x,y}] bow→stern,hits,sunk} */
    let myMark=mk10('u');              /* what the opponent did to me: u|m|h|s */
    let enMark=mk10('u');              /* what I did to the enemy: u|m|h|s */
    let enHull={};                     /* cellKey → hull style (revealed on sink) */
    let botBoard=null, botShips=[];
    let botKnow=mk10('u');             /* bot's fog-of-war view of MY waters */
    let turnSeat=-1, shots=0, botShots=0, myHits=0, oppHits=0;
    let busy=false, finished=false, paused=false;
    let selShip=-1, bow=null, bTimer=0, botTimer=0;
    let ready=[false,false], resCache={};
    let enSunkIdx=new Set(), botSunkIdx=new Set();

    /* --------------------------- placement --------------------------- */
    const placedCount = ()=> myShips.filter(Boolean).length;
    function cellsFor(size, bx, by, dir){
      const d = DIRS[dir]; if(!d) return null;
      const out=[];
      for(let k=0;k<size;k++){
        const x=bx+d.dx*k, y=by+d.dy*k;
        if(x<0||x>9||y<0||y>9) return null;
        out.push({x,y});
      }
      return out;
    }
    function canPlace(cs){
      for(const c of cs){
        if(myBoard[c.y][c.x]>=0) return false;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const x=c.x+dx, y=c.y+dy;
          if(x>=0&&x<10&&y>=0&&y<10&&myBoard[y][x]>=0) return false;
        }
      }
      return true;
    }
    function placeShip(idx, cs){
      const f=FLEET[idx];
      myShips[idx]={fi:idx, size:f.size, cells:cs, hits:0, sunk:false};
      cs.forEach(c=> myBoard[c.y][c.x]=idx);
    }
    function unplace(idx){
      if(!myShips[idx]) return;
      myShips[idx].cells.forEach(c=> myBoard[c.y][c.x]=-1);
      myShips[idx]=null;
      if(selShip<0){ selShip=idx; }
      PV.sound.play('whoosh');
      hint(tt('pickBow'));
      btnStart.disabled=true;
      renderPlace(); renderGridM();
    }
    function clearAll(silent){
      myBoard=mk10(-1); myShips=Array(5).fill(null);
      selShip=-1; bow=null; hideDir();
      btnStart.disabled=true;
      if(!silent){ PV.sound.play('whoosh'); hint(tt('pickShip')); }
      renderPlace(); renderGridM(); clearGhost();
    }
    function autoPlace(){
      clearAll(true);
      for(let i=0;i<FLEET.length;i++){
        const f=FLEET[i];
        for(let t=0;t<500;t++){
          const dir=['N','S','E','W'][(ctx.rng()*4)|0];
          const x=(ctx.rng()*10)|0, y=(ctx.rng()*10)|0;
          const cs=cellsFor(f.size,x,y,dir);
          if(cs && canPlace(cs)){ placeShip(i,cs); break; }
        }
      }
      PV.sound.play('pop'); U.vibrate(12);
      btnStart.disabled = placedCount()!==5;
      hint(placedCount()===5 ? tt('placed') : tt('pickShip'));
      renderPlace(); renderGridM();
    }
    function attemptPlace(dir){
      if(selShip<0 || !bow) return;
      const f=FLEET[selShip];
      const cs=cellsFor(f.size, bow.x, bow.y, dir);
      if(!cs || !canPlace(cs)){
        const b=dirpad.querySelector('[data-dir="'+dir+'"]');
        if(b){ b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
        PV.sound.play('falseStart'); U.vibrate(25);
        hint(tt('noRoom'));
        return;
      }
      placeShip(selShip, cs);
      PV.sound.play('place'); U.vibrate(12);
      selShip=-1; bow=null; hideDir(); clearGhost();
      renderPlace(); renderGridM();
      const done = placedCount()===5;
      btnStart.disabled = !done;
      hint(done ? tt('placed') : tt('pickShip'));
    }
    function showDir(){ dirpad.classList.remove('hidden'); }
    function hideDir(){ dirpad.classList.add('hidden'); }
    function hint(txt){ hintEl.textContent=txt; }
    function clearGhost(){ gridM.querySelectorAll('.ghost').forEach(c=>c.classList.remove('ghost','bad')); }
    function previewGhost(dir){
      clearGhost();
      if(selShip<0||!bow) return;
      const cs=cellsFor(FLEET[selShip].size, bow.x, bow.y, dir);
      const ok=cs && canPlace(cs);
      (cs||[]).forEach(c=>{ const cel=gridM.children[c.y*10+c.x]; cel.classList.add('ghost'); if(!ok) cel.classList.add('bad'); });
    }

    fleetRow.addEventListener('click', e=>{
      const b=e.target.closest('.pvship-shipbtn'); if(!b || phase!=='place') return;
      const i=+b.dataset.i;
      if(myShips[i]){ unplace(i); return; }
      selShip = selShip===i ? -1 : i;
      bow=null; hideDir(); clearGhost();
      PV.sound.play('tap');
      hint(selShip<0 ? tt('pickShip') : tt('pickBow'));
      renderPlace();
    });
    gridM.addEventListener('click', e=>{
      if(phase!=='place') return;
      const cel=e.target.closest('.pvship-cell'); if(!cel) return;
      if(selShip<0){ hint(tt('pickShip')); return; }
      bow={x:+cel.dataset.x, y:+cel.dataset.y};
      showDir(); hint(tt('pickDir')); PV.sound.play('tap');
      previewGhost('E');
    });
    dirpad.addEventListener('click', e=>{
      const b=e.target.closest('.pvship-dir'); if(!b) return;
      if(b.id==='pvship-dircancel'){ selShip=-1; bow=null; hideDir(); clearGhost(); PV.sound.play('tap'); hint(tt('pickShip')); renderPlace(); return; }
      attemptPlace(b.dataset.dir);
    });
    dirpad.addEventListener('mouseover', e=>{ const b=e.target.closest('.pvship-dir'); if(b&&b.dataset.dir) previewGhost(b.dataset.dir); });
    dirpad.addEventListener('mouseout', clearGhost);
    btnAuto.addEventListener('click', ()=>{ if(phase==='place') autoPlace(); });
    btnClear.addEventListener('click', ()=>{ if(phase==='place') clearAll(); });
    btnStart.addEventListener('click', startBattle);

    function renderPlace(){
      fleetRow.innerHTML = FLEET.map((f,i)=>{
        const done=!!myShips[i];
        return `<button class="pvship-shipbtn ${done?'done':''} ${selShip===i?'sel':''}" data-i="${i}" style="--hc:${f.col};--hc2:${f.col2}">
          <span class="mini">${'<i></i>'.repeat(f.size)}</span>
          <b>${tt('ship.'+f.id)}</b><span class="tiny muted">${fmt(f.size)} خانه</span>
        </button>`;
      }).join('');
    }

    /* ------------------------- hull rendering ------------------------ */
    function hullStyle(cells){
      const b=cells[0], s=cells[cells.length-1];
      const dx=Math.sign(s.x-b.x), dy=Math.sign(s.y-b.y);
      const bowCls = dx===1?'bowL':dx===-1?'bowR':dy===1?'bowT':'bowB';
      const capCls = dx===1?'capR':dx===-1?'capL':dy===1?'capB':'capT';
      const stripe = dx!==0 ? 'h-st' : 'v-st';
      return {bowCls,capCls,stripe};
    }
    function renderGridM(){
      const hs = myShips.map(sh=> sh ? hullStyle(sh.cells) : null);
      for(let y=0;y<10;y++) for(let x=0;x<10;x++){
        const cel=gridM.children[y*10+x];
        const idx=myBoard[y][x], mk=myMark[y][x];
        let cls='pvship-cell';
        if(idx>=0){
          const sh=myShips[idx], f=FLEET[sh.fi], st=hs[idx];
          const k=sh.cells.findIndex(c=>c.x===x&&c.y===y);
          cls+=' hull '+st.stripe;
          if(k===0) cls+=' '+st.bowCls;
          if(k===sh.size-1) cls+=' '+st.capCls;
          if(mk==='h') cls+=' dmg';
          if(mk==='s'||sh.sunk) cls+=' sunkd';
          cel.style.setProperty('--hc',f.col); cel.style.setProperty('--hc2',f.col2);
        } else {
          cel.style.removeProperty('--hc'); cel.style.removeProperty('--hc2');
          if(mk==='m') cls+=' miss';
        }
        cel.className=cls;
      }
      miniM.textContent = tt('hits')+': '+fmt(oppHits)+'/'+fmt(17);
    }
    function renderGridE(){
      for(let y=0;y<10;y++) for(let x=0;x<10;x++){
        const cel=gridE.children[y*10+x];
        const v=enMark[y][x];
        let cls='pvship-cell';
        if(v==='m') cls+=' miss';
        else if(v==='h') cls+=' ehit';
        else if(v==='s'){
          const hs=enHull[y*10+x];
          if(hs){
            cls+=' hull esunk '+hs.stripe;
            if(hs.bowCls) cls+=' '+hs.bowCls;
            if(hs.capCls && hs.k===hs.last) cls+=' '+hs.capCls;
            cel.style.setProperty('--hc',hs.col); cel.style.setProperty('--hc2',hs.col2);
          } else cls+=' ehit';
        }
        cel.className=cls;
      }
      miniE.textContent = tt('hits')+': '+fmt(myHits)+'/'+fmt(17);
    }
    function renderFBars(){
      $('#pvship-fbarM').innerHTML = FLEET.map((f,i)=>{
        const sh=myShips[i];
        const hits=sh?sh.hits:0, sunk=sh?sh.sunk:false;
        const segs=Array.from({length:f.size},(_,k)=>`<i class="${k<hits?'hit':''}"></i>`).join('');
        return `<span class="pvship-fchip ${sunk?'dead':''}" style="--fc:${f.col}"><b>${tt('ship.'+f.id)}</b><span class="segs">${segs}</span></span>`;
      }).join('');
      const enemyLeft = 5-enSunkIdx.size;
      $('#pvship-fbarE').innerHTML = `<span class="pvship-fchip soft">${tt('hits')}: ${fmt(myHits)}/۱۷</span>` + FLEET.map((f,i)=>{
        const sunk=enSunkIdx.has(i);
        const segs=Array.from({length:f.size},()=>`<i class="${sunk?'hit':''}"></i>`).join('');
        return `<span class="pvship-fchip ${sunk?'dead':''}" style="--fc:${f.col}"><b>${tt('ship.'+f.id)}</b><span class="segs">${segs}</span></span>`;
      }).join('') + `<span class="pvship-fchip soft">🚢 ${fmt(enemyLeft)}/۵</span>`;
    }

    /* ---------------------------- effects ---------------------------- */
    function cellCenter(grid, x, y){
      const wr=grid.getBoundingClientRect();
      const cr=grid.children[y*10+x].getBoundingClientRect();
      return {x:cr.left-wr.left+cr.width/2, y:cr.top-wr.top+cr.height/2};
    }
    function shellArc(layer, fromEdge, tgt, done){
      const wr=layer.getBoundingClientRect();
      const s=document.createElement('div');
      s.className='pvshell';
      s.style.setProperty('--sx', (wr.width/2)+'px');
      s.style.setProperty('--sy', (fromEdge==='bottom' ? wr.height+18 : -18)+'px');
      s.style.setProperty('--ex', tgt.x+'px');
      s.style.setProperty('--ey', tgt.y+'px');
      s.style.setProperty('--peak', (fromEdge==='bottom' ? -95 : -75)+'px');
      s.style.setProperty('--dur', '.52s');
      layer.appendChild(s);
      setTimeout(()=>{ s.remove(); done && done(); }, 530);
    }
    function fxRipple(layer, tgt){
      const d=document.createElement('div');
      d.className='pvrip'; d.style.left=tgt.x+'px'; d.style.top=tgt.y+'px';
      d.innerHTML='<i></i><i></i>';
      layer.appendChild(d);
      setTimeout(()=>d.remove(), 980);
    }
    function fxBoom(layer, tgt){
      const d=document.createElement('div');
      d.className='pvboom'; d.style.left=tgt.x+'px'; d.style.top=tgt.y+'px';
      d.innerHTML='<span class="fl"></span><span class="ring"></span>'
        +'<span class="smoke" style="left:18%;top:35%;--sdx:-9px"></span>'
        +'<span class="smoke" style="left:48%;top:22%;--sdx:6px;animation-delay:.08s"></span>'
        +'<span class="smoke" style="left:60%;top:52%;--sdx:12px;animation-delay:.16s"></span>';
      layer.appendChild(d);
      setTimeout(()=>d.remove(), 1250);
    }
    function sinkBanner(fi, isEnemy){
      const f=FLEET[fi] || FLEET[0];
      sbanner.innerHTML = `<b>${isEnemy?'💥 '+tt('sunkIt'):'💔 '+tt('lostIt')}</b><span class="sm">${tt('ship.'+f.id)}</span>`;
      sbanner.className='pvship-sbanner show '+(isEnemy?'good':'bad');
      clearTimeout(bTimer);
      bTimer=setTimeout(()=>sbanner.classList.remove('show'), 1700);
    }

    /* ---------------------------- battles ---------------------------- */
    function startBattle(){
      if(phase!=='place' || placedCount()!==5) return;
      selShip=-1; bow=null; hideDir(); clearGhost();
      PV.sound.play('go');
      if(isMP){
        phase='wait';
        placeUI.classList.add('hidden');
        waitUI.classList.remove('hidden');
        ctx.setTurn('⏳ '+tt('waitOpp'));
        if(ctx.amHost){ ready[mySeat]=true; tryStartMP(); }
        else { ctx.send('placed', {}, seats[0]); }
      } else {
        const r=botAutoPlace();
        botBoard=r.board; botShips=r.ships;
        phase='battle';
        placeUI.classList.add('hidden');
        turnSeat=Math.floor(ctx.rng()*2);
        setTurnUI();
        renderFBars();
        if(turnSeat===1) scheduleBot(1300);
      }
    }
    function setTurnUI(){
      gridE.classList.toggle('live', phase==='battle' && turnSeat===mySeat && !busy);
      gridM.classList.toggle('place', phase==='place');
      if(phase==='over') return;
      if(phase==='place'){ ctx.setTurn('🚢 '+tt('stPlace')); return; }
      if(phase==='wait'){ ctx.setTurn('⏳ '+tt('waitOpp')); return; }
      if(turnSeat===mySeat) ctx.setTurn(tt('yourTurn'),'me');
      else ctx.setTurn(tt('oppTurn'),'');
    }
    function applyTurn(s){
      turnSeat=s;
      setTurnUI();
    }

    /* ------------------------- solo: my shot ------------------------- */
    function fireSolo(x,y){
      busy=true; shots++;
      PV.sound.play('whoosh');
      setTurnUI();
      shellArc(layerE,'bottom', cellCenter(gridE,x,y), ()=>{
        const idx=botBoard[y][x];
        const tgt=cellCenter(gridE,x,y);
        if(idx<0){
          enMark[y][x]='m';
          fxRipple(layerE,tgt); PV.sound.play('flip');
          renderGridE();
          busy=false; applyTurn(1); scheduleBot();
        } else {
          const sh=botShips[idx]; sh.hits++; myHits++;
          if(sh.hits>=sh.size){
            sh.sunk=true; botSunkIdx.add(idx);
            sh.cells.forEach(c=> enMark[c.y][c.x]='s');
            const st=hullStyle(sh.cells);
            sh.cells.forEach((c,k)=>{ enHull[c.y*10+c.x]={...st, k, last:sh.size-1, col:FLEET[idx].col, col2:FLEET[idx].col2}; });
            sinkBanner(idx,true); PV.sound.play('ach'); U.vibrate(55);
            renderGridE(); renderFBars();
            busy=false;
            if(botShips.every(s=>s.sunk)){ endMatch(mySeat); return; }
            applyTurn(mySeat);
          } else {
            enMark[y][x]='h';
            fxBoom(layerE,tgt); PV.sound.play('pop'); U.vibrate(38);
            renderGridE();
            busy=false; applyTurn(mySeat);
          }
        }
      });
    }

    /* --------------------- solo: bot places & fires ------------------ */
    function botAutoPlace(){
      const board=mk10(-1), ships=[];
      for(let i=0;i<FLEET.length;i++){
        const f=FLEET[i];
        for(let t=0;t<600;t++){
          const dir=['N','S','E','W'][(Math.random()*4)|0];
          const x=(Math.random()*10)|0, y=(Math.random()*10)|0;
          const cs=cellsFor(f.size,x,y,dir);
          if(!cs) continue;
          let ok=true;
          for(const c of cs){
            if(board[c.y][c.x]>=0){ ok=false; break; }
            for(let dy=-1;dy<=1&&ok;dy++) for(let dx=-1;dx<=1;dx++){
              const xx=c.x+dx, yy=c.y+dy;
              if(xx>=0&&xx<10&&yy>=0&&yy<10&&board[yy][xx]>=0){ ok=false; break; }
            }
            if(!ok) break;
          }
          if(ok){
            ships[i]={fi:i,size:f.size,cells:cs,hits:0,sunk:false};
            cs.forEach(c=> board[c.y][c.x]=i);
            break;
          }
        }
      }
      return {board, ships};
    }
    function scheduleBot(delay){
      if(isMP || phase!=='battle' || turnSeat!==1) return;
      clearTimeout(botTimer);
      botTimer=setTimeout(botMove, delay || (850+Math.random()*550));
    }
    function botMove(){
      if(phase!=='battle' || turnSeat!==1 || paused) return;
      const pick=botPick(); if(!pick) return;
      botShots++;
      PV.sound.play('whoosh');
      shellArc(layerM,'top', cellCenter(gridM,pick.x,pick.y), ()=>{
        if(phase!=='battle') return;
        const idx=myBoard[pick.y][pick.x];
        const tgt=cellCenter(gridM,pick.x,pick.y);
        if(idx<0){
          botKnow[pick.y][pick.x]='m'; myMark[pick.y][pick.x]='m';
          fxRipple(layerM,tgt); PV.sound.play('flip');
          renderGridM();
          applyTurn(0);
        } else {
          const sh=myShips[idx]; sh.hits++; oppHits++;
          botKnow[pick.y][pick.x]='h'; myMark[pick.y][pick.x]='h';
          if(sh.hits>=sh.size){
            sh.sunk=true; botSunkIdx.add(idx);
            sh.cells.forEach(c=>{ myMark[c.y][c.x]='s'; botKnow[c.y][c.x]='s'; });
            sinkBanner(idx,false); PV.sound.play('falseStart'); U.vibrate(70);
            renderGridM(); renderFBars();
            if(myShips.every(s=>s.sunk)){ endMatch(1); return; }
            applyTurn(1); scheduleBot(950);
          } else {
            fxBoom(layerM,tgt); PV.sound.play('pop'); U.vibrate(38);
            renderGridM(); renderFBars();
            applyTurn(1); scheduleBot(900);
          }
        }
      });
    }

    /* ------------------------------ bot AI --------------------------- */
    function botPick(){
      const cand=[];
      for(let y=0;y<10;y++) for(let x=0;x<10;x++) if(botKnow[y][x]==='u') cand.push({x,y});
      if(!cand.length) return null;
      if(botLevel==='easy') return cand[(Math.random()*cand.length)|0];
      const hits=[];
      for(let y=0;y<10;y++) for(let x=0;x<10;x++) if(botKnow[y][x]==='h') hits.push({x,y});
      const remain=FLEET.filter((f,i)=>!botSunkIdx.has(i)).map(f=>f.size);
      if(botLevel==='normal'){
        if(hits.length){
          const t=lineTarget(hits); if(t) return t;
          const t2=adjTarget(hits); if(t2) return t2;
        }
        return cand[(Math.random()*cand.length)|0];
      }
      /* hard: probability density + parity sweep */
      const dens=mk10(0);
      const scan=(sizes, requireHit)=>{
        for(const s of sizes) for(let y=0;y<10;y++) for(let x=0;x<10;x++){
          for(const o of [[1,0],[0,1]]){
            let ok=true, hasHit=false;
            const cs2=[];
            for(let k=0;k<s;k++){
              const xx=x+o[0]*k, yy=y+o[1]*k;
              if(xx>9||yy>9){ ok=false; break; }
              const v=botKnow[yy][xx];
              if(v==='m'||v==='s'){ ok=false; break; }
              if(v==='h') hasHit=true;
              cs2.push([xx,yy]);
            }
            if(!ok || (requireHit && !hasHit)) continue;
            for(const [xx,yy] of cs2) if(botKnow[yy][xx]==='u') dens[yy][xx]++;
          }
        }
      };
      if(hits.length) scan(remain,true); else scan(remain,false);
      const step=Math.max(2, Math.min.apply(null, remain));
      let best=null, bs=-1;
      for(const c of cand){
        let s=dens[c.y][c.x];
        if(!hits.length && (c.x+c.y)%step===0) s*=1.25;
        s+=Math.random()*0.02;
        if(s>bs){ bs=s; best=c; }
      }
      return best || cand[(Math.random()*cand.length)|0];
    }
    function lineTarget(hits){
      for(const a of hits) for(const b of hits){
        if(a===b) continue;
        if(a.y===b.y && Math.abs(a.x-b.x)===1){
          const opts=[{x:Math.min(a.x,b.x)-1,y:a.y},{x:Math.max(a.x,b.x)+1,y:a.y}].filter(c=>c.x>=0&&c.x<10&&botKnow[c.y][c.x]==='u');
          if(opts.length) return opts[(Math.random()*opts.length)|0];
        }
        if(a.x===b.x && Math.abs(a.y-b.y)===1){
          const opts=[{x:a.x,y:Math.min(a.y,b.y)-1},{x:a.x,y:Math.max(a.y,b.y)+1}].filter(c=>c.y>=0&&c.y<10&&botKnow[c.y][c.x]==='u');
          if(opts.length) return opts[(Math.random()*opts.length)|0];
        }
      }
      return null;
    }
    function adjTarget(hits){
      const opts=[];
      for(const h of hits){
        [{x:h.x+1,y:h.y},{x:h.x-1,y:h.y},{x:h.x,y:h.y+1},{x:h.x,y:h.y-1}].forEach(c=>{
          if(c.x>=0&&c.x<10&&c.y>=0&&c.y<10&&botKnow[c.y][c.x]==='u') opts.push(c);
        });
      }
      return opts.length ? opts[(Math.random()*opts.length)|0] : null;
    }

    /* ------------------------- online protocol ----------------------- */
    function tryStartMP(){
      if(!(ready[0]&&ready[1]) || phase!=='wait') return;
      waitUI.classList.add('hidden');
      phase='battle';
      const first=Math.floor(ctx.rng()*2);
      ctx.broadcast('turn', {pid: seats[first]});
      applyTurn(first);
    }
    function fireMP(x,y){
      busy=true; shots++;
      PV.sound.play('whoosh');
      ctx.setTurn('⏳ '+tt('firing'));
      ctx.send('shot', {x,y}, seats[oppSeat]);
    }
    function defendShot(x,y,shooterPid){
      if(x<0||x>9||y<0||y>9) return;
      if(myMark[y][x]!=='u'){
        const c=resCache[y*10+x];
        if(c) ctx.send('res', c, shooterPid);
        return;
      }
      const idx=myBoard[y][x];
      const hit=idx>=0;
      let sunk=false, cellsArr=null, fi=null;
      if(hit){
        const sh=myShips[idx]; sh.hits++; oppHits++;
        sunk = sh.hits>=sh.size;
        if(sunk){
          sh.sunk=true;
          sh.cells.forEach(c=> myMark[c.y][c.x]='s');
          cellsArr=sh.cells; fi=idx;
        } else myMark[y][x]='h';
      } else myMark[y][x]='m';
      const res={x,y,hit,sunk,cells:cellsArr,fi};
      resCache[y*10+x]=res;
      ctx.send('res', res, shooterPid);
      const tgt=cellCenter(gridM,x,y);
      if(hit){
        fxBoom(layerM,tgt); PV.sound.play('pop'); U.vibrate(38);
      } else {
        fxRipple(layerM,tgt); PV.sound.play('flip');
      }
      renderGridM(); renderFBars();
      if(sunk){
        sinkBanner(fi,false); PV.sound.play('falseStart'); U.vibrate(70);
        renderGridM();
      }
      if(myShips.every(s=>s && s.sunk)){
        ctx.broadcast('over', {winnerPid: shooterPid});
        ctx.setTurn('💀 '+tt('fleetDied'),'lose');
        endMatch(seats.indexOf(shooterPid));
        return;
      }
      const nextSeat = hit ? seats.indexOf(shooterPid) : mySeat;
      ctx.broadcast('turn', {pid: seats[nextSeat]});
      applyTurn(nextSeat);
    }
    function applyRes(d){
      busy=false;
      if(!d || d.x==null) return;
      const x=d.x|0, y=d.y|0;
      if(x<0||x>9||y<0||y>9 || enMark[y][x]!=='u') return;
      const tgt=cellCenter(gridE,x,y);
      if(d.hit){
        myHits++;
        if(d.sunk && Array.isArray(d.cells) && d.cells.length){
          d.cells.forEach(c=> enMark[c.y|0][c.x|0]='s');
          const st=hullStyle(d.cells);
          d.cells.forEach((c,k)=>{ enHull[(c.y|0)*10+(c.x|0)]={...st, k, last:d.cells.length-1, col:FLEET[d.fi]!=null?FLEET[d.fi].col:'#888', col2:FLEET[d.fi]!=null?FLEET[d.fi].col2:'#aaa'}; });
          enSunkIdx.add(d.fi);
          sinkBanner(d.fi!=null?d.fi:0, true); PV.sound.play('ach'); U.vibrate(45);
        } else {
          enMark[y][x]='h';
          fxBoom(layerE,tgt); PV.sound.play('pop'); U.vibrate(38);
        }
      } else {
        enMark[y][x]='m';
        fxRipple(layerE,tgt); PV.sound.play('flip');
      }
      renderGridE(); renderFBars();
      if(d.sunk && enSunkIdx.size>=5){
        /* safety net if the loser's 'over' message is lost */
        setTimeout(()=>{ if(phase!=='over') endMatch(mySeat); }, 1600);
        return;
      }
      const expected = d.hit ? mySeat : oppSeat;
      if(turnSeat!==expected){
        setTimeout(()=>{ if(phase==='battle' && turnSeat!==expected) applyTurn(expected); }, 1500);
      }
    }
    if(isMP){
      ctx.on('placed', (d, from)=>{
        if(!ctx.amHost || phase==='over') return;
        const s=seats.indexOf(from);
        if(s>=0) ready[s]=true;
        tryStartMP();
      });
      ctx.on('turn', d=>{
        if(!d || d.pid==null || phase==='over' || phase==='place') return;
        const s=seats.indexOf(d.pid);
        if(s<0) return;
        waitUI.classList.add('hidden');
        if(phase==='wait') phase='battle';
        applyTurn(s);
      });
      ctx.on('shot', (d, from)=>{
        if(phase!=='battle' || !d) return;
        const s=seats.indexOf(from);
        if(s!==oppSeat || s!==turnSeat) return;
        defendShot(d.x|0, d.y|0, from);
      });
      ctx.on('res', (d, from)=>{
        if(phase!=='battle' || !d) return;
        if(seats.indexOf(from)!==oppSeat) return;
        applyRes(d);
      });
      ctx.on('over', d=>{
        if(phase==='over' || !d) return;
        endMatch(seats.indexOf(d.winnerPid));
      });
    }

    /* --------------------------- end / finish ------------------------ */
    function endMatch(winSeat){
      if(phase==='over') return;
      phase='over';
      clearTimeout(botTimer);
      gridE.classList.remove('live');
      const iWon = winSeat===mySeat;
      ctx.setTurn(iWon ? '🏆 '+tt('victory') : '💀 '+tt('defeat'), iWon?'win':'lose');
      if(finished) return;
      finished=true;
      const sc=Math.max(0, 1000-shots);
      setTimeout(()=>{
        ctx.finish({
          res: iWon?'w':'l',
          vsHuman:isMP,
          scores:{ [myKey]: iWon?sc:0, [oppKey]: iWon?0:Math.max(0,1000-botShots) },
          sub: tt('endShots',{n:fmt(shots)}),
        });
      }, 950);
    }

    /* ------------------------- grid clicks --------------------------- */
    gridE.addEventListener('click', e=>{
      const cel=e.target.closest('.pvship-cell'); if(!cel) return;
      const x=+cel.dataset.x, y=+cel.dataset.y;
      if(phase!=='battle' || turnSeat!==mySeat || busy) return;
      if(enMark[y][x]!=='u') return;
      if(isMP) fireMP(x,y); else fireSolo(x,y);
    });

    /* ---------------------------- contract --------------------------- */
    return {
      init(){},
      start(){ setTurnUI(); renderFBars(); },
      pause(){ paused=true; clearTimeout(botTimer); },
      resume(){ paused=false; if(!isMP && phase==='battle' && turnSeat===1) scheduleBot(700); },
      reset(){
        if(isMP) return;
        phase='place'; myBoard=mk10(-1); myShips=Array(5).fill(null);
        myMark=mk10('u'); enMark=mk10('u'); enHull={};
        botKnow=mk10('u'); botBoard=null; botShips=[];
        turnSeat=-1; shots=0; botShots=0; myHits=0; oppHits=0;
        busy=false; finished=false; selShip=-1; bow=null;
        enSunkIdx=new Set(); botSunkIdx=new Set(); resCache={};
        clearTimeout(botTimer);
        placeUI.classList.remove('hidden'); waitUI.classList.add('hidden');
        btnStart.disabled=true; hideDir(); clearGhost();
        hint(tt('pickShip'));
        renderPlace(); renderGridM(); renderGridE(); renderFBars(); setTurnUI();
      },
      getState(){ return {phase, turnSeat, shots, myHits, oppHits, placed:placedCount()}; },
      getScores(){ return { [myKey]: myHits, [oppKey]: oppHits }; },
      getStatus(){
        if(phase==='over') return '';
        if(phase==='place') return tt('stPlace')+' ('+fmt(placedCount())+'/۵)';
        if(phase==='wait') return tt('waitOpp');
        return turnSeat===mySeat ? tt('yourTurn') : tt('oppTurn');
      },
      end(){ phase='over'; clearTimeout(botTimer); clearTimeout(bTimer); },
      destroy(){ phase='over'; clearTimeout(botTimer); clearTimeout(bTimer); root.remove(); },
    };
  }
});
})();
