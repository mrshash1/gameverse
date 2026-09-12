/* ============ Game: Rock Paper Scissors — best of 5, commit-reveal online ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, fmt } = U;

const CHOICES = [
  {id:'rock', em:'✊', beats:'scissors'},
  {id:'paper', em:'✋', beats:'rock'},
  {id:'scissors', em:'✌️', beats:'paper'},
];
const EMO = {rock:'✊', paper:'✋', scissors:'✌️'};
const WIN = 3;

PV.registry.register({
  id:'rps', cats:['party','classic','luck'], players:[2,2], modes:['solo','online'],
  weight:88,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    let my = 0, op = 0;
    let round = 1;
    let myPick = null, opPick = null;
    let busy = false;
    let settled = false;       /* round lock — kills the double-resolve race */
    let fbTO = null;           /* 6s fallback timer */
    const root = document.createElement('div');
    root.innerHTML = `<div class="rps">
      <div class="rps-round" id="rround"></div>
      <div class="rps-hands">
        <div class="col center" style="gap:6px">
          <div class="rps-hand me" id="hme">🤛</div>
          <b class="small">${esc(ctx.players.find(p=>p.pid===ctx.selfPid)?.name||t('c.you'))}</b>
        </div>
        <div class="big" style="font-weight:900;color:var(--tx3)" id="vs">VS</div>
        <div class="col center" style="gap:6px">
          <div class="rps-hand op" id="hop">🤜</div>
          <b class="small">${esc(players.find(p=>p.pid!==ctx.selfPid)?.name||t('g.bot'))}</b>
        </div>
      </div>
      <div class="row num" style="gap:14px;font-size:1.3rem;font-weight:900"><span style="color:var(--p1)" id="sm"></span><span class="muted">—</span><span style="color:var(--p4)" id="so"></span></div>
      <div class="rps-choices" id="rchoices">${CHOICES.map(c=>`<button class="rps-choice" data-c="${c.id}">${c.em}</button>`).join('')}</div>
      <div class="gmsg" id="rmsg"></div>
    </div>`;
    ctx.root.appendChild(root);
    const $ = s=>root.querySelector(s);

    const myName = players.find(p=>p.pid===ctx.selfPid)?.name || t('c.you');
    const opName = players.find(p=>p.pid!==ctx.selfPid)?.name || t('g.bot');

    function hud(){ $('#sm').textContent = fmt(my); $('#so').textContent = fmt(op); $('#rround').textContent = t('pl.round',{n:fmt(round)}); }
    function pick(c){
      if(busy || settled) return;
      PV.sound.play('tap'); U.vibrate();
      busy = true; myPick = c;
      root.querySelectorAll('.rps-choice').forEach(b=>b.classList.toggle('sel', b.dataset.c===c));
      $('#hme').classList.add('shake'); $('#hop').classList.add('shake');
      $('#rmsg').textContent = '…';
      if(!isMP){ opPick = CHOICES[Math.floor(Math.random()*3)].id; setTimeout(resolve, 900); }
      else {
        ctx.broadcast('pick', {c, rd:round});       /* send intent to all; serverless trust for friends */
        /* CRITICAL: if the rival already picked, resolve NOW.
           (previously only the arrival handler could trigger resolve,
            so whoever picked second stayed stuck forever) */
        if(opPick!=null){ setTimeout(resolve, 300); }
        else {
          ctx.setStatus(t('pl.turnW'));
          /* safety: resolve in 12s if opponent silently gone (tolerates slow relays) */
          clearTimeout(fbTO);
          fbTO = setTimeout(()=>{ if(!settled && opPick==null){ opPick = CHOICES[Math.floor(Math.random()*3)].id; resolve(); } }, 12000);
        }
      }
    }
    function resolve(){
      if(settled || myPick==null || opPick==null) return;
      settled = true;
      clearTimeout(fbTO);
      $('#hme').classList.remove('shake'); $('#hop').classList.remove('shake');
      $('#hme').classList.add('reveal'); $('#hop').classList.add('reveal');
      $('#hme').textContent = EMO[myPick]; $('#hop').textContent = EMO[opPick];
      const a = CHOICES.find(x=>x.id===myPick), b = CHOICES.find(x=>x.id===opPick);
      let res = 'd';
      if(a.id!==b.id){ res = a.beats===b.id ? 'w':'l'; }
      if(res==='w') my++; else if(res==='l') op++;
      PV.sound.play(res==='w'?'go':res==='l'?'falseStart':'tick');
      $('#rmsg').textContent = res==='w'? '🎉' : res==='l'? '😤' : '🤝';
      hud();
      setTimeout(()=>{
        if(my>=WIN || op>=WIN){ endMatch(); return; }
        round++; myPick=opPick=null; busy=false; settled=false;
        $('#hme').textContent='🤛'; $('#hop').textContent='🤜';
        $('#hme').classList.remove('reveal'); $('#hop').classList.remove('reveal');
        root.querySelectorAll('.rps-choice').forEach(b=>b.classList.remove('sel'));
        $('#rmsg').textContent='';
        hud();
      }, 1300);
    }
    function endMatch(){
      ctx.finish({res: my>op?'w':'l', scores:{[ctx.selfPid]:my, [opPid()]:op}, vsHuman:isMP, sub: my+' : '+op});
    }
    function opPid(){ return players.find(p=>p.pid!==ctx.selfPid)?.pid || 'BOT:1'; }
    root.querySelectorAll('.rps-choice').forEach(b=> b.onclick = ()=> pick(b.dataset.c));
    if(isMP){
      ctx.on('pick', (d, from)=>{
        if(settled || busy && myPick==null) return;   /* ignore stale/late picks for a settled round */
        if(opPick!=null) return;                      /* dedupe */
        opPick = d.c;
        if(myPick!=null) setTimeout(resolve, 250);
      });
    }
    hud();
    ctx.setTurn(t('g.tapStart'));
    return {
      init(){}, start(){}, reset(){ my=op=0; round=1; busy=false; settled=false; myPick=opPick=null; clearTimeout(fbTO); hud(); },
      getState(){ return {my, op, round}; }, end(){ clearTimeout(fbTO); }, destroy(){ root.remove(); clearTimeout(fbTO); },
      getScores(){ return {[ctx.selfPid]:my, [opPid()]:op}; },
      getStatus(){ return busy? '' : t('g.tapStart'); },
    };
  }
});
})();
