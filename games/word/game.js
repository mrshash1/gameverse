/* ============ Game: Word Guess — Persian Wordle, 6 tries, shared secret ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

/* 5-letter Persian words (letter-count verified) */
const WORDS = [
  'باران','گلدان','سلامت','پنجره','شیرین','ستاره','آسمان','پرنده','گنجشک','شاهین',
  'زندگی','کیهان','پرواز','صندلی','مدرسه','دوستی','کوهست','دیروز','امروز','شبانه',
  'تاریک','گلبرگ','شکوفه','چمدان','کیفیت','توانا','مهتاب','شاپرک','زنبور','مورچه',
  'سنجاب','خرگوش','روباه','میمون','دلفین','خرچنگ','مرجان','ناخدا','ملوان','مسافر',
  'نانوا','آلوچه','انگور','صورتی','غمگین','دلتنگ','پهلوی','دستور','سخنور','آبادی',
  'تاریخ','ریاضی','فیزیک','پیروز','حماسه','ترانه','آهنگر','نقاشی','عکاسی','کتابی',
  'دونده','شناگر',
].filter(w=>w.length===5);

const FA_LETTERS = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآ';

PV.registry.register({
  id:'word', cats:['word','brain'], players:[1,2], modes:['solo','online'],
  weight:72, dynamicScore:true,
  factory: function(ctx){
    const rng = U.mulberry32(ctx.seed ?? 777);
    const secret = WORDS[Math.floor(rng()*WORDS.length)] || 'سلامت';
    const MAX = 6;
    let rows = [];          /* guessed words */
    let current = '';
    let done = false;
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const opPid = ()=> players.find(pl=>pl.pid!==ctx.selfPid)?.pid || 'BOT:1';
    let botTryTO = null;

    const root = document.createElement('div');
    root.innerHTML = `<div class="word">
      <div class="wgrid" id="wg"></div>
      <div class="gmsg" id="wgmsg">${isMP? t('g.waitP'):''}</div>
      <div class="wkb" id="wk"></div>
    </div>`;
    ctx.root.appendChild(root);
    const $ = s=>root.querySelector(s);

    const KB = [
      [...'ضصثقفغعهخحجچ'.slice(0,12)],
      [...'شسیبلاتنمکگ'.slice(0,12)],
      [...'ظطژذدزرو'.slice(0,8)],
    ];

    function draw(){
      /* grid */
      const g = $('#wg');
      g.innerHTML='';
      for(let r=0;r<MAX;r++){
        const rowEl = document.createElement('div');
        rowEl.className='wrow';
        for(let c=0;c<5;c++){
          const cell = document.createElement('span');
          cell.className='wcell';
          const guess = rows[r];
          if(guess){
            cell.textContent = guess.word[c];
            cell.classList.add(guess.marks[c]);
            if(c===4) cell.classList.add('fill');
          } else if(r===rows.length){
            cell.textContent = current[c]||'';
            if(current[c]) cell.classList.add('fill');
          }
          rowEl.appendChild(cell);
        }
        g.appendChild(rowEl);
      }
      /* keyboard */
      const kb = $('#wk');
      kb.innerHTML='';
      KB.forEach((rowChars, ri)=>{
        const rEl = document.createElement('div');
        rEl.className='wr2'+(ri===1?' mid':'');
        if(ri===2){
          const enter = document.createElement('button');
          enter.className='wkey'; enter.textContent='↵'; enter.onclick=submit;
          rEl.appendChild(enter);
        }
        rowChars.forEach(ch=>{
          const b = document.createElement('button');
          b.className='wkey'; b.textContent=ch;
          /* color used letters */
          const known = markOf(ch);
          if(known) b.style.background = known==='ok'? 'var(--grad-green)': known==='mid'? 'var(--grad-gold)':'var(--surface3)';
          if(known==='bad') b.style.color='var(--tx3)';
          b.onclick = ()=>{ if(!done && current.length<5 && rows.length<MAX){ current+=ch; PV.sound.play('tap'); draw(); } };
          rEl.appendChild(b);
        });
        if(ri===2){
          const back = document.createElement('button');
          back.className='wkey'; back.textContent='⌫';
          back.onclick = ()=>{ current=current.slice(0,-1); draw(); };
          rEl.appendChild(back);
        }
        kb.appendChild(rEl);
      });
    }
    function markOf(ch){
      for(const r of rows){ const i = r.word.indexOf(ch); if(i<0){ if(!r.word.includes(ch)) continue; } }
      /* simple: check best mark across rows */
      let m = null;
      for(const r of rows){
        r.word.split('').forEach((c2,i)=>{
          if(c2!==ch) return;
          const mk = r.marks[i];
          if(mk==='ok') m='ok'; else if(mk==='mid' && m!=='ok') m='mid'; else if(!m) m='bad';
        });
      }
      return m;
    }
    function submit(){
      if(done || current.length!==5){ $('#wgmsg').textContent = t('g.wguess'); PV.sound.play('falseStart'); return; }
      if(!WORDS.includes(current)){ $('#wgmsg').textContent = t('g.wordnot'); return; }
      const marks = Array(5).fill('bad');
      const remain = {};
      secret.split('').forEach((c2,i)=>{
        if(current[i]===c2) marks[i]='ok';
        else remain[c2]=(remain[c2]||0)+1;
      });
      current.split('').forEach((c2,i)=>{
        if(marks[i]==='ok') return;
        if(remain[c2]>0){ marks[i]='mid'; remain[c2]--; }
      });
      rows.push({word:current, marks});
      PV.sound.play('pop'); U.vibrate();
      current='';
      draw();
      if(marks.every(m=>m==='ok')){ end(true); return; }
      if(rows.length>=MAX){ end(false); return; }
      $('#wgmsg').textContent='';
      if(isMP) ctx.broadcast('try', {w: rows[rows.length-1].word});
      scheduleBot();
    }
    function end(win){
      done=true;
      const tries = rows.length;
      let res = 'w';
      if(!win) res='l';
      if(isMP){
        /* both play same secret; fewer tries wins; report after both done */
        ctx.broadcast('done', {win, tries});
        $('#wgmsg').textContent = win? '🎉 '+secret : '😖 '+secret;
        setTimeout(()=>ctx.finish({res, vsHuman:true, scores:{[ctx.selfPid]: win? MAX-tries+1:0, [opPid()]:0}, stats:{tries}, sub:secret}), 900);
      } else {
        $('#wgmsg').textContent = win? '🎉 '+secret : '😖 '+secret;
        ctx.finish({res: win?'w':'l', vsHuman:false, scores:{[ctx.selfPid]: win? Math.max(1, MAX-tries+2):0}, stats:{tries}, sub:secret});
      }
    }
    function scheduleBot(){
      if(!isMP) return;
      clearTimeout(botTryTO);
      if(rows.length>=MAX) return;
      botTryTO = setTimeout(()=>{
        if(done) return;
        /* bot makes plausible random guess from list */
        const w = WORDS[Math.floor(Math.random()*WORDS.length)];
        /* simulate marks like a player */
        const marks = Array(5).fill('bad');
        const remain = {};
        secret.split('').forEach((c2,i)=>{ if(w[i]===c2) marks[i]='ok'; else remain[c2]=(remain[c2]||0)+1; });
        w.split('').forEach((c2,i)=>{ if(marks[i]==='ok') return; if(remain[c2]>0){ marks[i]='mid'; remain[c2]--; } });
        rows.push({word:w, marks});
        draw();
        if(marks.every(m=>m==='ok')){ end(false); }   /* bot won → I lose */
        else if(rows.length>=MAX){ end(rows.some(r=>r.marks.every(m=>m==='ok'))); }
        else scheduleBot();
      }, 5200+Math.random()*3000);
    }
    if(isMP){
      ctx.on('try', d=>{ /* opponent progress shown as count only */ $('#wgmsg').textContent = '🧠 '+fmt(rows.length+1); });
      ctx.on('done', d=>{
        if(done) return;
        done=true;
        const theirScore = d.win? Math.max(1, MAX-d.tries+1):0;
        const myWin = d.win? false : true;
        setTimeout(()=>ctx.finish({res: myWin?'w':'l', vsHuman:true, scores:{[ctx.selfPid]:0, [opPid()]:theirScore}, sub:secret}), 700);
      });
    }
    draw();
    return {
      init(){}, start(){ scheduleBot(); },
      reset(){ rows=[]; current=''; done=false; draw(); },
      getState(){ return {rows}; }, end(){ done=true; clearTimeout(botTryTO); }, destroy(){ root.remove(); clearTimeout(botTryTO); },
      getScores(){ return {[ctx.selfPid]: rows.some(r=>r.marks.every(m=>m==='ok'))? MAX-rows.length+1:0}; },
      getStatus(){ return fmt(rows.length)+'/۶'; },
    };
  }
});
})();
