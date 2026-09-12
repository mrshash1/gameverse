/* ============ Game: Quiz — timed MCQ, solo & online simultaneous ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const BANK = [
  {q:'بزرگ‌ترین سیاره‌ی منظومه‌ی شمسی؟', o:['زمین','مشتری','زحل','مریخ'], a:1},
  {q:'پایتخت ژاپن کدام است؟', o:['اوساکا','کیوتو','توکیو','سئول'], a:2},
  {q:'تیم ملی فوتبال ایران چند بار قهرمان آسیا شده؟', o:['۱','۲','۳','۴'], a:2},
  {q:'سریع‌ترین حیوان خشکی؟', o:['شیر','یوزپلنگ','اسب','آهو'], a:1},
  {q:'کدام عنصر با نماد O شناخته می‌شود؟', o:['طلا','اکسیژن','نقره','آهن'], a:1},
  {q:'روز زمین در چه ماهی برگزار می‌شود؟', o:['فروردین/آوریل','مرداد/اوت','آبان/نوامبر','دی/ژانویه'], a:0},
  {q:'نزدیک‌ترین ستاره به زمین؟', o:['شباهنگ','خورشید','قطبی','پروکسیما'], a:1},
  {q:'برج ایفل در کدام شهر است؟', o:['لندن','رم','پاریس','برلین'], a:2},
  {q:'چند قاره روی زمین وجود دارد؟', o:['۵','۶','۷','۸'], a:2},
  {q:'کدام بازیگر نقش شرلوک هلمز را در سریال بی‌بی‌سی بازی کرد؟', o:['جودی لا','بنديکت کامبربچ','تام هاردی','هنری کاویل'], a:1},
  {q:'حاصل ۹ × ۷ ؟', o:['۶۳','۵۶','۷۲','۶۷'], a:0},
  {q:'کدام کشور بیشترین جمعیت را دارد؟', o:['چین','هند','آمریکا','اندونزی'], a:1},
  {q:'اقیانوس بزرگ‌ترین جهان؟', o:['اطلس','هند','آرام','منجمد'], a:2},
  {q:'نور خورشید در چند دقیقه به زمین می‌رسد؟', o:['۸','۸.۳','۱۲','۳.۵'], a:1},
  {q:'کدام یک پستاندار است؟', o:['نهنگ آبی','کوسه','هشت‌پا','تمساح'], a:0},
  {q:'واژه‌ی «لپ‌تاپ» به چه معناست؟', o:['رایانه کیفی','گوشی','تبلت','چاپگر'], a:0},
  {q:'قدبلندترین کوه جهان؟', o:['دماوند','اورست','کی۲','فوجی'], a:1},
  {q:'رنگ برگ‌ها بیشتر به دلیل کدام ماده؟', o:['کلروفیل','کراتین','ملانین','هموگلوبین'], a:0},
  {q:'تعداد بازیکن والیبال در زمین؟', o:['۵','۶','۷','۱۱'], a:1},
  {q:'مولد برق جنبشی را به چه تبدیل می‌کند؟', o:['نور','گرما','برق','صدا'], a:2},
  {q:'پایتخت کانادا؟', o:['تورنتو','ونکوور','اتاوا','مونترال'], a:2},
  {q:'کدام خزنده صدای «هیس» دارد؟', o:['مار','قورباغه','لاک‌پشت','سنجاب'], a:0},
];
const NQ = 8, TIME = 15;

PV.registry.register({
  id:'quiz', cats:['brain','family','party'], players:[1,8], modes:['solo','online'],
  weight:80, dynamicScore:true,
  factory: function(ctx){
    const rng = U.mulberry32(ctx.seed ?? 999);
    const qs = U.shuffle(BANK, rng).slice(0, NQ);
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    let idx = 0, myScore = 0, scores = {};
    players.forEach(pl=>scores[pl.pid]=0);
    let locked = false, timer = null, tLeft = TIME;
    let t0 = 0;

    const root = document.createElement('div');
    root.innerHTML = `<div class="quiz">
      <div class="quiz-prog">
        <div class="quiz-timer"><span class="pring"><svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface3)" stroke-width="5"/>
          <circle id="qarc" cx="22" cy="22" r="18" fill="none" stroke="var(--p1)" stroke-width="5" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="0"/></svg>
          <span class="v tiny num" id="qt">۱۵</span></span></div>
        <div class="pbar" style="flex:1"><i id="qprog"></i></div>
        <b class="num" id="qidx"></b>
      </div>
      <div class="quiz-q" id="qq"></div>
      <div class="quiz-opts" id="qo"></div>
      <div class="gmsg" id="qm"></div>
    </div>`;
    ctx.root.appendChild(root);
    const $ = s=>root.querySelector(s);

    function show(){
      if(idx>=qs.length){ endMatch(); return; }
      locked=false; tLeft=TIME; t0=Date.now();
      const q = qs[idx];
      $('#qq').textContent = q.q;
      $('#qidx').textContent = fmt(idx+1)+'/'+fmt(NQ);
      $('#qprog').style.width = (idx/NQ*100)+'%';
      $('#qm').textContent='';
      const order = U.shuffle([0,1,2,3], U.mulberry32(ctx.seed+idx));
      $('#qo').innerHTML='';
      order.forEach((oi, pos)=>{
        const b = document.createElement('button');
        b.className='quiz-opt';
        b.dataset.oi = String(oi);
        b.innerHTML = `<span class="ol">${['آ','ب','ج','د'][pos]}</span><span>${esc(q.o[oi])}</span>`;
        b.onclick = ()=>answer(oi, b);
        $('#qo').appendChild(b);
      });
      clearInterval(timer);
      timer = setInterval(tick, 1000); tick();
    }
    function tick(){
      tLeft--;
      $('#qt').textContent = fmt(Math.max(0,tLeft));
      const off = 113*(1-Math.max(0,tLeft)/TIME);
      $('#qarc').style.strokeDashoffset = off;
      $('#qarc').style.stroke = tLeft<=5? 'var(--err)':'var(--p1)';
      if(tLeft<=5 && tLeft>0) PV.sound.play('tick');
      if(tLeft<=0){ answer(-1, null); }
    }
    function answer(oi, btn){
      if(locked) return;
      locked = true;
      clearInterval(timer);
      const q = qs[idx];
      const correct = oi===q.a;
      const ms = Date.now()-t0;
      root.querySelectorAll('.quiz-opt').forEach(b2=>{
        b2.disabled = true;
        if(b2.dataset.oi===String(q.a)) b2.classList.add('correct');
        else if(btn && b2===btn) b2.classList.add('wrong');
      });
      if(correct){ myScore += 1 + (ms<4000?1:0); PV.sound.play('coin'); } else PV.sound.play('falseStart');
      if(isMP){
        ctx.broadcast('ans', {idx, ok:correct, ms});
        scores[ctx.selfPid] = myScore;
        setTimeout(next, 1600);
      } else {
        setTimeout(next, 1200);
      }
      ctx.setStatus(t('lb.pts')+': '+fmt(myScore));
    }
    function next(){
      idx++;
      show();
    }
    function endMatch(){
      let res='d';
      if(isMP){
        const others = Object.entries(scores).filter(([pid])=>pid!==ctx.selfPid).map(([,v])=>v);
        const best = Math.max(...others, -1);
        res = myScore>best? 'w' : myScore===best? 'd':'l';
      } else res = 'w';
      ctx.finish({res, vsHuman:isMP, scores:{...scores, [ctx.selfPid]:myScore}, stats:{correct:myScore},
        sub: t('lb.pts')+': '+fmt(myScore)+'/'+fmt(NQ*2)});
    }
    if(isMP){
      ctx.on('ans', (d, from)=>{
        if(scores[from]==null) scores[from]=0;
        if(d.ok) scores[from]+= 1 + (d.ms<4000?1:0);
      });
    }
    show();
    return {
      init(){}, start(){},
      reset(){ idx=0; myScore=0; players.forEach(pl=>scores[pl.pid]=0); show(); },
      getState(){ return {idx}; }, end(){ clearInterval(timer); }, destroy(){ root.remove(); clearInterval(timer); },
      getScores(){ return {...scores, [ctx.selfPid]:myScore}; },
      getStatus(){ return t('lb.pts')+': '+fmt(myScore); },
    };
  }
});
})();
