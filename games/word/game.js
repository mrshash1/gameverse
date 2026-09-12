/* ============ Game: Word Guess — Persian Wordle, 6 tries, shared secret ============
   v3: NO phantom bot (was polluting online boards and stealing wins), full
   keyboard (پ/آ were missing → some rounds were unwinnable), honest MP protocol:
   first to solve wins; if both fail it's a draw, never a mutual win. */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { fmt } = U;

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
    let concluding = false;
    let waitTO = null;
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const opPid = ()=> players.find(pl=>pl.pid!==ctx.selfPid)?.pid || 'BOT:1';
    let opTries = 0;

    const root = document.createElement('div');
    root.innerHTML = `<div class="word">
      <div class="wgrid" id="wg"></div>
      <div class="gmsg" id="wgmsg">${isMP? t('g.winFin'):''}</div>
      <div class="wkb" id="wk"></div>
    </div>`;
    ctx.root.appendChild(root);
    const $ = s=>root.querySelector(s);

    /* full Persian keyboard — پ and آ included (were missing → unwinnable rounds) */
    const KB = [
      [...'ضصثقفغعهخحجچ'],
      [...'شسیبلاتنمکگپ'],
      [...'ظطژذدزروآ'],
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
            cell.classList.add(guess.marks[c], 'reveal');
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
          enter.className='wkey accent'; enter.textContent='↵'; enter.onclick=submit;
          rEl.appendChild(enter);
        }
        rowChars.forEach(ch=>{
          const b = document.createElement('button');
          b.className='wkey'; b.textContent=ch;
          const known = markOf(ch);
          if(known) b.classList.add('k-'+known);
          b.onclick = ()=>{ if(!done && !concluding && current.length<5 && rows.length<MAX){ current+=ch; PV.sound.play('tap'); draw(); } };
          rEl.appendChild(b);
        });
        if(ri===2){
          const back = document.createElement('button');
          back.className='wkey'; back.textContent='⌫';
          back.onclick = ()=>{ if(!done && !concluding){ current=current.slice(0,-1); draw(); } };
          rEl.appendChild(back);
        }
        kb.appendChild(rEl);
      });
    }
    function markOf(ch){
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
    function scoreFor(win, tries){ return win? Math.max(1, MAX-tries+2) : 0; }
    function submit(){
      if(done || concluding) return;
      if(current.length!==5){ $('#wgmsg').textContent = t('g.wguess'); PV.sound.play('falseStart'); return; }
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
      const tries = rows.length;
      if(marks.every(m=>m==='ok')){ end(true, tries); return; }
      if(tries>=MAX){ end(false, tries); return; }
      $('#wgmsg').textContent='';
      if(isMP) ctx.broadcast('try', {n: tries});
    }
    /* ---------- endings ----------
       WIN  → announce 'done{win:true}' and finish as winner right away.
       FAIL → announce 'done{win:false}' and WAIT for the rival:
              rival wins → I lose; rival also fails → DRAW (no mutual win). */
    function end(win, tries){
      if(done || concluding) return;
      done = true;
      $('#wgmsg').textContent = win? '🎉 '+secret : '😖 '+secret;
      if(isMP){
        concluding = true;
        ctx.broadcast('done', {win, tries});
        if(win){
          setTimeout(()=>ctx.finish({res:'w', vsHuman:true,
            scores:{[ctx.selfPid]: scoreFor(true,tries), [opPid()]:0}, stats:{tries}, sub:secret}), 900);
        } else {
          $('#wgmsg').textContent = t('g.okFin');
          ctx.setStatus(t('g.waitFin'));
          waitTO = setTimeout(()=>concludeDraw(tries), 20000);
        }
      } else {
        ctx.finish({res: win?'w':'l', vsHuman:false, scores:{[ctx.selfPid]: scoreFor(win,tries)}, stats:{tries}, sub:secret});
      }
    }
    function concludeDraw(tries){
      clearTimeout(waitTO);
      concluding = false;
      ctx.finish({res:'d', vsHuman:true, scores:{[ctx.selfPid]:0, [opPid()]:0}, stats:{tries}, sub:secret});
    }
    if(isMP){
      ctx.on('try', d=>{ opTries = d.n|0; $('#wgmsg').textContent = '🧠 '+t('g.oppTry',{n:fmt(opTries)}); });
      ctx.on('done', d=>{
        if(done){
          /* I already ended: if I failed and the rival now wins, update honestly */
          if(concluding){
            clearTimeout(waitTO); concluding = false;
            if(d.win){ ctx.finish({res:'l', vsHuman:true, scores:{[ctx.selfPid]:0, [opPid()]:scoreFor(true,d.tries|0)}, stats:{tries:rows.length}, sub:secret}); }
            else { concludeDraw(rows.length); }
          }
          return;
        }
        /* rival finished while I'm still playing */
        done = true;
        if(d.win){
          $('#wgmsg').textContent = '😖 '+secret;
          setTimeout(()=>ctx.finish({res:'l', vsHuman:true, scores:{[ctx.selfPid]:0, [opPid()]:scoreFor(true,d.tries|0)}, stats:{tries:rows.length}, sub:secret}), 800);
        } else {
          /* rival failed → keep playing; if I solve it I win, else draw */
          opTries = d.tries|0;
          $('#wgmsg').textContent = '🧠 '+t('g.oppTry',{n:fmt(opTries)})+' — '+t('g.winFin');
          done = false;
        }
      });
    }
    draw();
    return {
      init(){}, start(){},
      reset(){ rows=[]; current=''; done=false; concluding=false; clearTimeout(waitTO); draw(); },
      getState(){ return {rows}; },
      end(){ done=true; clearTimeout(waitTO); }, destroy(){ done=true; root.remove(); clearTimeout(waitTO); },
      getScores(){ return {[ctx.selfPid]: rows.some(r=>r.marks.every(m=>m==='ok'))? MAX-rows.length+2:0}; },
      getStatus(){ return fmt(rows.length)+'/۶'; },
    };
  }
});
})();
