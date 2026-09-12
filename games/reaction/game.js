/* ============ Game: Reaction — solo avg of 5 / online duel best-of-5 ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

PV.registry.register({
  id:'reaction', cats:['speed','party'], players:[1,8], modes:['solo','online'],
  weight:76, dynamicScore:true,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const ROUNDS = 5;
    let round = 1, times = [], winsMe=0, winsOp=0;
    let phase = 'idle';   /* idle | wait | go | done */
    let goAt = 0, waitTO = null, myMs = null;
    let opReported = {};
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
      $('#rres').innerHTML = times.map((ms,i)=>`<span class="react-chip ${ms<=250?'best':''}">${fmt(ms)}ms</span>`).join('');
    }
    function startRound(){
      phase='wait'; myMs=null;
      const pad = $('#pad');
      pad.className='react-pad wait off';
      $('#ptxt').textContent = t('pl.pause');
      $('#psub').textContent = isMP? t('pl.turnW') : '…';
      const delay = 1200+Math.random()*2600;
      waitTO = setTimeout(()=>{
        if(phase!=='wait') return;
        phase='go'; goAt = Date.now()+Math.random()*60;
        pad.className='react-pad go';
        $('#ptxt').textContent = '⚡';
        $('#psub').textContent = '';
        PV.sound.play('go');
      }, delay);
    }
    function tap(){
      const pad = $('#pad');
      if(phase==='wait'){ /* false start */
        clearTimeout(waitTO);
        phase='done';
        pad.className='react-pad off';
        $('#ptxt').textContent = t('g.false');
        PV.sound.play('falseStart'); U.vibrate(60);
        if(isMP){ ctx.broadcast('res', {ms:-1}); settle(-1); }
        else { times.push(999); settle(999); }
        return;
      }
      if(phase==='go'){
        const ms = Date.now()-goAt;
        phase='done';
        pad.className='react-pad off';
        $('#ptxt').textContent = fmt(ms)+'ms';
        PV.sound.play(ms<300?'coin':'pop'); U.vibrate();
        times.push(ms);
        if(isMP){ ctx.broadcast('res', {ms}); settle(ms); }
        else { settle(ms); }
      }
    }
    function settle(my){
      /* bot */
      if(!isMP){
        const botMs = 220+Math.random()*260;
        const meWin = my<botMs;
        $('#psub').textContent = t('g.bot')+': '+fmt(Math.round(botMs))+'ms — '+(meWin?'🏆':'🤖');
        nextRound(meWin);
        return;
      }
      /* MP: wait for opponent report */
      $('#psub').textContent = t('pl.turnW');
      const check = setInterval(()=>{
        const op = opReported;
        if(op!=null){
          clearInterval(check);
          const meWin = (my===-1)? false : (op===-1? true : my<op);
          $('#psub').textContent = (op===-1? t('g.false') : fmt(Math.round(op))+'ms');
          nextRound(meWin);
        }
      }, 120);
      setTimeout(()=>clearInterval(check), 8000);
    }
    function nextRound(meWin){
      if(isMP){ if(meWin) winsMe++; else winsOp++; }
      hud();
      setTimeout(()=>{
        if(!isMP && round>=ROUNDS){ endSolo(); return; }
        if(isMP && (winsMe>=3 || winsOp>=3 || round>=ROUNDS)){ endDuel(); return; }
        round++;
        phase='idle';
        $('#pad').className='react-pad';
        $('#ptxt').textContent = t('g.tapStart');
        $('#psub').textContent = '';
        hud();
      }, 1500);
    }
    function endSolo(){
      const valid = times.filter(x=>x!==999);
      const avg = valid.length? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 999;
      ctx.finish({res:'w', scores:{[ctx.selfPid]:Math.max(1, Math.round(1200-avg))}, stats:{best:Math.min(...valid, 9999)}, vsHuman:false,
        sub:'Ø '+fmt(avg)+'ms'});
    }
    function endDuel(){
      const res = winsMe>winsOp? 'w': winsMe<winsOp? 'l':'d';
      const valid = times.filter(x=>x>0);
      ctx.finish({res, vsHuman:true, scores:{[ctx.selfPid]:winsMe, [opPid()]:winsOp},
        stats: valid.length? {best:Math.min(...valid)}:undefined, sub: winsMe+' : '+winsOp});
    }
    $('#pad').onclick = ()=>{ if(phase==='idle'){ startRound(); } else tap(); };
    if(isMP){
      ctx.on('res', (d, from)=>{ if(from!==ctx.selfPid) opReported = d.ms; });
    }
    hud();
    return {
      init(){}, start(){},
      reset(){ round=1; times=[]; winsMe=winsOp=0; phase='idle'; hud(); },
      getState(){ return {round, times}; }, end(){ clearTimeout(waitTO); }, destroy(){ root.remove(); clearTimeout(waitTO); },
      getScores(){ return {[ctx.selfPid]: isMP? winsMe : Math.max(0,Math.round(1200-(times.filter(x=>x>0).reduce((a,b)=>a+b,0)/(times.filter(x=>x>0).length||1))))}; },
      getStatus(){ return t('pl.round',{n:fmt(round)}); },
    };
  }
});
})();
