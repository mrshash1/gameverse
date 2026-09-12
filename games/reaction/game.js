/* ============ Game: Reaction — solo avg of 5 / online duel best-of-5 ============
   v3: per-round report matching (no cross-round contamination), no stuck states,
   exact timing, both-false-start replay, opponent-timeout = round win. */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { fmt } = U;

PV.registry.register({
  id:'reaction', cats:['speed','party'], players:[1,8], modes:['solo','online'],
  weight:76, dynamicScore:true,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const ROUNDS = 5, WIN_AT = 3, REPORT_TIMEOUT = 8000;
    let round = 1, times = [], winsMe=0, winsOp=0;
    let phase = 'idle';   /* idle | wait | go | done | settle */
    let goAt = 0, waitTO = null, settleTO = null, settleIv = null;
    let opReport = null;  /* opponent's ms for THIS round only */
    let finished = false;
    const opPid = ()=> players.find(pl=>pl.pid!==ctx.selfPid)?.pid || 'BOT:1';

    const root = document.createElement('div');
    root.innerHTML = `<div class="react">
      <div class="rps-round" id="rr"></div>
      <button class="react-pad" id="pad"><span id="ptxt">${t('g.tapStart')}</span><span class="small" id="psub"></span></button>
      <div class="react-res" id="rres"></div>
    </div>`;
    ctx.root.appendChild(root);
    const $ = s=>root.querySelector(s);

    function hud(){
      $('#rr').textContent = isMP? t('pl.round',{n:fmt(round)})+' — '+fmt(winsMe)+':'+fmt(winsOp) : t('pl.round',{n:fmt(round)})+'/۵';
      $('#rres').innerHTML = times.map((ms,i)=>{
        if(ms===-1) return `<span class="react-chip false">✕</span>`;
        const best = Math.min(...times.filter(x=>x>0), Infinity);
        return `<span class="react-chip ${ms===best&&ms<=250?'best':''}">${fmt(ms)}ms</span>`;
      }).join('');
    }
    function clearTimers(){ clearTimeout(waitTO); clearTimeout(settleTO); clearInterval(settleIv); }

    function startRound(){
      clearTimers();
      phase='wait'; myRoundMs=null; opReport=null;
      const pad = $('#pad');
      pad.className='react-pad wait off';
      $('#ptxt').textContent = t('pl.pause');
      $('#psub').textContent = isMP? t('pl.turnW') : '…';
      const delay = 1200+Math.random()*2600;
      waitTO = setTimeout(()=>{
        if(phase!=='wait') return;
        phase='go'; goAt = Date.now();          /* exact reference — no artificial jitter */
        pad.className='react-pad go';
        $('#ptxt').textContent = '⚡';
        $('#psub').textContent = '';
        PV.sound.play('go');
      }, delay);
    }
    let myRoundMs = null;
    function tap(){
      const pad = $('#pad');
      if(phase==='wait'){ /* false start */
        clearTimeout(waitTO);
        phase='done';
        pad.className='react-pad off';
        $('#ptxt').textContent = t('g.false');
        PV.sound.play('falseStart'); U.vibrate(60);
        times.push(-1);
        if(isMP){ ctx.broadcast('res', {rd:round, ms:-1}); settle(-1); }
        else settle(999);
        return;
      }
      if(phase==='go'){
        const ms = Date.now()-goAt;
        phase='done';
        pad.className='react-pad off';
        $('#ptxt').textContent = fmt(ms)+'ms';
        PV.sound.play(ms<300?'coin':'pop'); U.vibrate();
        times.push(ms);
        if(isMP){ ctx.broadcast('res', {rd:round, ms}); settle(ms); }
        else settle(ms);
      }
    }
    function settle(my){
      /* --- solo: bot answers instantly --- */
      if(!isMP){
        const botMs = 220+Math.random()*260;
        const meWin = my<botMs;
        $('#psub').textContent = t('g.bot')+': '+fmt(Math.round(botMs))+'ms — '+(meWin?'🏆':'🤖');
        nextRound(meWin);
        return;
      }
      /* --- MP: wait for THIS round's opponent report (guarded, never stale) --- */
      phase='settle';
      $('#psub').textContent = t('pl.turnW');
      settleIv = setInterval(()=>{
        if(opReport==null) return;
        clearInterval(settleIv); settleTO && clearTimeout(settleTO);
        const op = opReport;
        if(my===-1 && op===-1){ /* both false-started → replay the round fairly */
          $('#psub').textContent = t('g.bothFalse');
          times.pop(); times.pop();       /* drop this round's chips */
          replayRound();
          return;
        }
        const meWin = (my===-1)? false : (op===-1? true : my<op);
        $('#psub').textContent = (op===-1? t('g.false') : fmt(Math.round(op))+'ms');
        nextRound(meWin);
      }, 100);
      settleTO = setTimeout(()=>{   /* opponent never reported → they forfeit the round */
        if(phase!=='settle') return;
        clearInterval(settleIv);
        if(my===-1){ replayRound(); return; }
        $('#psub').textContent = '⏱';
        nextRound(true);
      }, REPORT_TIMEOUT);
    }
    function replayRound(){
      phase='idle';
      setTimeout(()=>{
        $('#pad').className='react-pad';
        $('#ptxt').textContent = t('g.tapStart');
        $('#psub').textContent = '';
        hud();
      }, 1200);
    }
    function nextRound(meWin){
      phase='done';
      if(isMP){ if(meWin) winsMe++; else winsOp++; }
      hud();
      setTimeout(()=>{
        if(finished) return;
        if(!isMP && round>=ROUNDS){ endSolo(); return; }
        if(isMP && (winsMe>=WIN_AT || winsOp>=WIN_AT || round>=ROUNDS)){ endDuel(); return; }
        round++;
        startRound();
      }, 1500);
    }
    function endSolo(){
      finished = true; clearTimers();
      const valid = times.filter(x=>x>0);
      const avg = valid.length? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 999;
      ctx.finish({res:'w', scores:{[ctx.selfPid]:Math.max(1, Math.round(1200-avg))}, stats:{best:valid.length?Math.min(...valid):9999}, vsHuman:false,
        sub:'Ø '+fmt(avg)+'ms'});
    }
    function endDuel(){
      finished = true; clearTimers();
      const res = winsMe>winsOp? 'w': winsMe<winsOp? 'l':'d';
      const valid = times.filter(x=>x>0);
      ctx.finish({res, vsHuman:true, scores:{[ctx.selfPid]:winsMe, [opPid()]:winsOp},
        stats: valid.length? {best:Math.min(...valid)}:undefined, sub: winsMe+' : '+winsOp});
    }
    $('#pad').onclick = ()=>{ if(phase==='idle'){ startRound(); } else if(phase==='wait'||phase==='go'){ tap(); } };
    if(isMP){
      ctx.on('res', (d, from)=>{
        if(from===ctx.selfPid) return;
        if(d?.rd!==round) return;            /* ignore reports from any other round */
        opReport = d.ms;
      });
    }
    hud();
    return {
      init(){}, start(){},
      reset(){ round=1; times=[]; winsMe=winsOp=0; finished=false; clearTimers(); phase='idle'; $('#pad').className='react-pad'; $('#ptxt').textContent=t('g.tapStart'); $('#psub').textContent=''; hud(); },
      getState(){ return {round, times}; },
      end(){ finished=true; clearTimers(); },
      destroy(){ finished=true; clearTimers(); root.remove(); },
      getScores(){ return {[ctx.selfPid]: isMP? winsMe : Math.max(0,Math.round(1200-(times.filter(x=>x>0).reduce((a,b)=>a+b,0)/(times.filter(x=>x>0).length||1))))}; },
      getStatus(){ return t('pl.round',{n:fmt(round)}); },
    };
  }
});
})();
