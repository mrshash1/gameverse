/* ============ Screen: Profile v2 — hero + avatar shop + stats + security ============
   Task 3-g: rich account page.
   • Hero: big avatar (click → avatar shop w/ coins), inline name edit ✏️,
     @username, level + XP progress bar, cloud badge, tier badge, member since.
   • Stats grid: plays / wins / win-rate% / best daily streak / coins / total XP.
   • Badges wall + match history (kept from v1).
   • Security card: collapsible «تغییر رمز عبور» (PV.cloud.changePassword)
     + danger zone «پاک کردن پیشرفت محلی» (double-confirm).
   • Logout button → PV.logoutFlow() (shared with the navbar menu).
==================================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml, levelFromXp, tierOf, LS } = U;

function ownedAvs(p){ p._ownedAvs ||= V.avatars.filter(id=>(V.avCost[id]??0)===0); return p._ownedAvs; }
function bestRating(p){ const v = Object.values(p.ratings||{}); return v.length? Math.max(...v) : null; }
function locale(){ return {fa:'fa-IR', en:'en-US', ar:'ar'}[PV.i18n.lang] || 'fa-IR'; }
/* local time-ago (util.timeAgo references an undefined t() for <60s rows and
   crashes the render — this scoped version is i18n-safe) */
function ago(ts){
  const s = Math.max(1,(Date.now()-ts)/1000);
  if(s<60) return t('c.now');
  const m=s/60; if(m<60) return t('c.minAgo',{n:fmt(Math.floor(m))});
  const h=m/60; if(h<24) return t('c.hourAgo',{n:fmt(Math.floor(h))});
  const d=h/24; if(d<30) return t('c.dayAgo',{n:fmt(Math.floor(d))});
  return new Date(ts).toLocaleDateString(locale());
}

async function render(view){
  const p = PV.store.me();
  if(!p){ location.hash='#/auth'; return; }
  const guest = PV.store.isGuest();
  const lv = levelFromXp(p.xp);
  const winRate = p.stats.plays? Math.round(p.stats.wins/p.stats.plays*100) : 0;
  const badges = PV.ach.LIST.map(a=>({...a, got:p.badges.includes(a.id)}));
  const tier = bestRating(p)!=null ? tierOf(bestRating(p)) : null;
  const hasLocal = (p.history||[]).length>0 || p.stats.plays>0 || Object.keys(p.ratings||{}).length>0;
  const dateStr = new Date(p.created||Date.now()).toLocaleDateString(locale());

  view.innerHTML = `
  <div class="prof-head rise">
    <button id="avBtn" title="${t('pf.tapAv')}" style="position:relative;border:none;background:none;padding:0;cursor:pointer;border-radius:50%;flex-shrink:0">
      <span class="av av-pop" style="width:92px;height:92px;border:4px solid rgba(255,255,255,.7);box-shadow:0 10px 26px rgba(0,0,0,.28)">${V.avatar(p.avatar)}</span>
      <span style="position:absolute;bottom:-2px;inset-inline-end:-2px;width:27px;height:27px;border-radius:50%;background:var(--grad-p);color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)">${icon('edit',13)}</span>
    </button>
    <div style="flex:1;min-width:220px">
      <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
        <h1 id="pfNameTxt" style="cursor:default">${esc(p.name)}</h1>
        <button id="nameEdit" title="${t('pf.edit')}" style="width:30px;height:30px;border-radius:10px;border:none;background:rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s">${icon('edit',14)}</button>
      </div>
      <div class="sub">
        <span class="row" style="gap:5px">${icon('user',14)} <span dir="ltr">@${esc(p.u)}</span></span>
        <span>${t('pf.member',{d:dateStr})}</span>
        <span class="badge" style="background:rgba(255,255,255,.18);color:#fff">${p.cloud? t('pf.onCloud') : t('pf.onLocal')}</span>
        ${tier?`<span class="badge" style="background:rgba(255,255,255,.18);color:#fff;display:inline-flex;align-items:center;gap:5px">${U.tierIcon(tier,15)} ${t(tier)}</span>`:''}
      </div>
      <div class="xp-card mt-1">
        <div class="row" style="justify-content:space-between;font-size:.8rem;font-weight:800">
          <span>${t('c.lvl')} ${fmt(lv.level)}</span><span class="num">${fmt(lv.into)} / ${fmt(lv.need)} XP</span>
        </div>
        <div class="pbar mt-1" style="background:rgba(0,0,0,.25)"><i id="xpFill" style="width:0%"></i></div>
      </div>
    </div>
    <div class="pright">
      ${guest? `<a class="btn sm" href="#/auth" style="background:var(--grad-p2)">${icon('user',15)} ${t('nav.loginUp')}</a>`
              : `<button class="btn sm wt" id="edit">${icon('edit',15)} ${t('pf.edit')}</button>`}
      <button class="btn sm ot" id="sync">${icon('key',15)} ${t('pf.sync')}</button>
      ${!guest? `<button class="btn sm ot" id="out" style="background:rgba(239,68,103,.32);border-color:rgba(255,255,255,.55)">${icon('logout',15)} ${t('nav.logoutFull')}</button>`:''}
    </div>
  </div>

  <div class="rise rise-1">${PV.ui.sectHead(t('pf.stats'), 'spark')}
    <div class="row wrap" style="gap:11px">
      <div class="stat-tile"><b class="num">${fmt(p.stats.plays)}</b><span class="lbl">${t('pf.games')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.stats.wins)}</b><span class="lbl">${t('pf.wins')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(winRate)}٪</b><span class="lbl">${t('pf.winRate')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.stats.bestDayStreak||0)} 🔥</b><span class="lbl">${t('pf.bestStreak')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.coins)}</b><span class="lbl">${t('pf.coinsL')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.xp)}</b><span class="lbl">${t('pf.xpTotal')}</span></div>
    </div>
  </div>

  <div class="rise rise-2">${PV.ui.sectHead(t('pf.badges'), 'medal', '#/achievements')}
    <div class="badge-wall">${badges.map(b=>`
      <div class="badge-tile ${b.got?'got':'locked'}">
        <span style="color:${b.got?'var(--gold)':'var(--tx3)'}">${icon(b.ic,26)}</span>
        <b>${esc(t(PV.ach.META[b.id]))}</b>
      </div>`).join('')}
    </div>
  </div>

  <div class="rise rise-3">${PV.ui.sectHead(t('pf.security'), 'lock')}
    <div class="card" style="padding:0;overflow:hidden">
      <button id="secToggle" style="width:100%;display:flex;align-items:center;gap:12px;padding:15px 18px;background:none;border:none;font-weight:800;font-size:.95rem;color:var(--tx);cursor:pointer;text-align:start">
        <span style="width:38px;height:38px;border-radius:12px;background:var(--surface3);color:var(--p1);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('key',19)}</span>
        <span style="flex:1;text-align:start">${t('au.pwTitle')}</span>
        <span id="secChev" style="color:var(--tx2);display:flex;transition:transform .25s">${icon('down',18)}</span>
      </button>
      <div id="secBody" style="display:none;padding:16px 18px 18px;border-top:1.5px solid var(--border)">
        ${guest? `
          <p class="muted small">${t('au.pwGuest')}</p>
          <a class="btn sm" href="#/auth" style="margin-top:10px">${icon('user',15)} ${t('nav.loginUp')}</a>`
        : `
          <div class="col" style="gap:12px;max-width:430px">
            <div class="field"><label>${t('au.pwOld')}</label><input class="inp" id="pw0" type="password" dir="ltr" autocomplete="current-password" placeholder="••••••"></div>
            <div class="field"><label>${t('au.pwNew')}</label><input class="inp" id="pw1" type="password" dir="ltr" autocomplete="new-password" placeholder="••••••"></div>
            <div class="field"><label>${t('au.pwNew2')}</label><input class="inp" id="pw2" type="password" dir="ltr" autocomplete="new-password" placeholder="••••••"></div>
            <div><button class="btn sm" id="pwGo">${icon('shield',15)} ${t('au.pwBtn')}</button></div>
          </div>`}
      </div>
      ${hasLocal? `
      <div style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-top:1.5px solid var(--border);background:rgba(239,68,103,.05);flex-wrap:wrap">
        <span style="width:38px;height:38px;border-radius:12px;background:rgba(239,68,103,.12);color:var(--err);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('trash',19)}</span>
        <div style="flex:1;min-width:180px"><b style="font-size:.9rem">${t('pf.wipe')}</b><div class="tiny muted">${t('pf.wipeD')}</div></div>
        <button class="btn sm danger" id="wipe">${t('pf.wipe')}</button>
      </div>`:''}
    </div>
  </div>

  <div class="rise rise-4">${PV.ui.sectHead(t('pf.hist'), 'clock')}
    <div class="col" style="gap:8px">${(p.history||[]).slice(0,12).map(h=>{
      const g = PV.registry.get(h.g);
      const rc = h.res==='w'?'w':h.res==='l'?'l':'d';
      const rt = h.res==='w'? t('c.win') : h.res==='l'? t('c.lose') : t('c.draw');
      return `<div class="hist-row">
        <span class="res ${rc}">${icon(h.res==='w'?'trophy':h.res==='l'?'x':'dice',18)}</span>
        <span class="av" style="width:32px;height:32px">${g? V.thumb(h.g):''}</span>
        <div style="flex:1"><b class="small">${esc(g? PV.t('g.'+g.id):h.g)}</b>
          <div class="tiny muted">${h.mode==='solo'? t('gd.solo') : t('md.'+(h.mode||'classic'))} · ${ago(h.ts)}</div></div>
        ${h.score!=null? `<b class="num">${fmt(h.score)}</b>`:''}
        <span class="badge ${rc==='w'?'ok':rc==='l'?'err':'info'}">${rt}</span>
      </div>`;
    }).join('') || `<div class="empty"><span class="eic">${icon('dice',30)}</span><p>${t('c.none')}</p></div>`}</div>
  </div>`;

  /* ---- interactions ---- */

  /* XP progress bar fill animation */
  const fill = view.querySelector('#xpFill');
  if(fill) requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width = lv.pct+'%'; }));

  /* avatar pop on load */
  view.querySelector('.av-pop')?.animate([{transform:'scale(.5)',opacity:0},{transform:'scale(1.12)'},{transform:'scale(1)',opacity:1}], {duration:480, easing:'cubic-bezier(.2,.9,.3,1.4)'});

  view.querySelector('#avBtn').onclick = ()=> avatarShop(p);

  /* inline display-name edit */
  view.querySelector('#nameEdit').onclick = startNameEdit;

  const editBtn = view.querySelector('#edit');
  if(editBtn) editBtn.onclick = ()=> editModal(p);
  view.querySelector('#sync').onclick = ()=> syncModal(p);
  const outBtn = view.querySelector('#out');
  if(outBtn) outBtn.onclick = ()=> PV.logoutFlow();

  /* collapsible security section */
  const secToggle = view.querySelector('#secToggle'), secBody = view.querySelector('#secBody'), secChev = view.querySelector('#secChev');
  if(secToggle) secToggle.onclick = ()=>{
    const open = secBody.style.display !== 'none';
    secBody.style.display = open? 'none':'block';
    secChev.style.transform = open? '' : 'rotate(180deg)';
    if(!open){
      secBody.animate([{opacity:0, transform:'translateY(-7px)'},{opacity:1, transform:'none'}], {duration:260, easing:'cubic-bezier(.2,.8,.3,1)'});
      view.querySelector('#pw0')?.focus();
    }
  };

  /* change password */
  const pwGo = view.querySelector('#pwGo');
  if(pwGo) pwGo.onclick = async ()=>{
    const o = view.querySelector('#pw0').value;
    const n1 = view.querySelector('#pw1').value;
    const n2 = view.querySelector('#pw2').value;
    if(n1.length<6){ PV.ui.toast(t('au.pwShort'),'err'); return; }
    if(n1!==n2){ PV.ui.toast(t('au.pwMatch'),'err'); return; }
    pwGo.disabled = true; pwGo.innerHTML = '<span class="spin"></span>';
    try{
      const r = await PV.cloud.changePassword(p.u, o, n1);
      if(r && r.ok){
        PV.ui.toast(t('au.pwOk'),'ok','check');
        if(r.localOnly) PV.ui.toast(t('au.pwLocal'),'info','info');
        PV.sound.play('ach');
        view.querySelector('#pw0').value = view.querySelector('#pw1').value = view.querySelector('#pw2').value = '';
      }
      else if(r && r.why==='pw') PV.ui.toast(t('au.pwWrong'),'err');
      else if(r && r.why==='nopw') PV.ui.toast(t('au.pwServer'),'info','info');
      else PV.ui.toast(t('au.pwWrong'),'err');
    } finally {
      pwGo.disabled = false; pwGo.innerHTML = icon('shield',15)+' '+t('au.pwBtn');
    }
  };

  /* danger zone: wipe local progress (double-confirm) */
  const wipeBtn = view.querySelector('#wipe');
  if(wipeBtn) wipeBtn.onclick = async ()=>{
    if(!await PV.ui.confirmDlg(t('pf.wipeC1'), t('pf.wipe'))) return;
    if(!await PV.ui.confirmDlg(t('pf.wipeC2'), t('pf.wipe'))) return;
    PV.store.update(x=>{
      x.history = []; x.ratings = {}; x.claims = {};
      Object.assign(x.stats, {plays:0, wins:0, losses:0, draws:0, msgs:0, hosted:0, bestDayStreak:0, byGame:{}, best:{}});
    });
    for(const g of PV.registry.all()) LS.del('board:'+g.id);
    PV.ui.toast(t('pf.wiped'),'ok','check');
    PV.router.render();
  };

  /* ---------- inline name edit ---------- */
  function startNameEdit(){
    const h = view.querySelector('#pfNameTxt');
    if(!h || view.querySelector('#nameInp')) return;
    const commit = ()=>{
      if(done) return; done = true;
      const v = inp.value.trim();
      if(v && v!==p.name){
        p.name = v; PV.store.saveProfile(p); PV.cloud.pushProfile();
        PV.ui.toast(t('pf.saved'),'ok','check');
      }
      PV.router.render();
    };
    let done = false;
    const inp = U.el(`<input id="nameInp" class="inp" maxlength="18" value="${esc(p.name)}" style="max-width:240px;padding:8px 13px;font-weight:900;font-size:1.05rem">`);
    h.replaceWith(inp);
    inp.focus(); inp.select();
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape'){ done=true; PV.router.render(); } });
    inp.addEventListener('blur', commit);
  }

  /* ---------- edit modal (name + bio; avatar lives in the shop) ---------- */
  function editModal(p){
    const m = PV.ui.modal({title:t('pf.edit'), body:`
      <div class="col" style="gap:14px">
        <div class="field"><label>${t('c.name')}</label><input class="inp" id="en" value="${esc(p.name)}" maxlength="18"></div>
        <div class="field"><label>${t('pf.bio')}</label><textarea class="inp" id="eb" maxlength="120" placeholder="${t('pf.bioPh')}">${esc(p.bio||'')}</textarea></div>
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:13px 15px;cursor:pointer" id="toShop">
          <span class="av" style="width:44px;height:44px">${V.avatar(p.avatar)}</span>
          <div style="flex:1"><b class="small">${t('pf.avShop')}</b><div class="tiny muted">${t('pf.tapAv')}</div></div>
          ${icon('next',17)}
        </div>
      </div>`,
      actions:[{label:t('c.save'), cls:'', onClick:(root)=>{
        const name = root.querySelector('#en').value.trim() || p.name;
        p.name = name; p.bio = root.querySelector('#eb').value.trim();
        PV.store.saveProfile(p); PV.cloud.pushProfile();
        PV.ui.toast(t('pf.saved'),'ok','check');
        PV.router.render();
      }}]});
    m.root.querySelector('#toShop').onclick = ()=>{ m.close(); avatarShop(p); };
  }

  /* ---------- avatar shop (buy + equip with coins) ---------- */
  function avatarShop(p){
    const m = PV.ui.modal({title:t('pf.avShop'), lg:true, body:`
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:13px">
        <span class="badge gold" id="shopCoins" style="font-size:.85rem">${icon('coin',15)} ${fmt(p.coins)}</span>
        <span class="tiny muted">${t('pf.tapAv')}</span>
      </div>
      <div id="avGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:11px"></div>`,
      actions:[]});
    const grid = m.root.querySelector('#avGrid');
    const draw = ()=>{
      grid.innerHTML = '';
      const own = ownedAvs(p);
      V.avatars.forEach(id=>{
        const cost = V.avCost[id] ?? 0;
        const isOwn = own.includes(id);
        const sel = p.avatar===id;
        const b = document.createElement('button');
        b.style.cssText = `position:relative;border:2.5px solid ${sel?'var(--p1)':'var(--border)'};border-radius:18px;background:var(--surface2);padding:10px 6px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:transform .18s,border-color .18s,box-shadow .18s${sel?';box-shadow:var(--glow-p)':''}`;
        b.innerHTML = `<span style="width:52px;height:52px;display:block">${V.avatar(id)}</span>
          <span class="tiny" style="font-weight:800;display:inline-flex;align-items:center;gap:3px;color:${sel?'var(--p1)':isOwn?'var(--tx2)':'#d97706'}">${sel? icon('check',13)+' '+t('c.on') : isOwn? t('pf.owned') : icon('coin',12)+' '+fmt(cost)}</span>`;
        b.onmouseenter = ()=>{ if(!sel) b.style.transform='translateY(-3px)'; };
        b.onmouseleave = ()=>{ b.style.transform=''; };
        b.onclick = ()=>{
          if(sel) return;
          if(!isOwn){
            if(p.coins < cost){
              PV.ui.toast(t('pf.noCoins'),'err','coin');
              b.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:280});
              return;
            }
            p.coins -= cost; own.push(id);
            PV.ui.toast(t('pf.bought')+' (−'+fmt(cost)+' 🪙)','gold','coin');
            PV.sound.play('coin');
          }
          p.avatar = id;
          PV.store.saveProfile(p); PV.cloud.pushProfile();
          PV.ui.toast(t('pf.equipped'),'ok','check');
          PV.sound.play('pop');
          b.animate([{transform:'scale(.72)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:360, easing:'cubic-bezier(.2,.9,.3,1.4)'});
          draw();
          /* live-refresh hero avatar + coin badge + navbar chip */
          const heroAv = view.querySelector('#avBtn .av');
          if(heroAv) heroAv.innerHTML = V.avatar(p.avatar);
          const sc = m.root.querySelector('#shopCoins');
          if(sc) sc.innerHTML = icon('coin',15)+' '+fmt(p.coins);
          PV.ui.renderNav();
        };
        grid.appendChild(b);
      });
    };
    draw();
  }

  /* ---------- sync code (kept from v1) ---------- */
  function syncModal(p){
    const codeData = btoa(unescape(encodeURIComponent(JSON.stringify({u:p.u, n:p.name}))));
    PV.ui.modal({title:t('pf.sync'), body:`
      <p class="muted small">${t('pf.syncInfo')}</p>
      <div class="card center mt-2" style="font-weight:900;letter-spacing:2px;direction:ltr;user-select:all;font-size:1.1rem">${esc(codeData.slice(0,44))}</div>
      <button class="btn mt-2" id="cp">${icon('copy',16)} ${t('c.copy')}</button>
      <hr class="divider">
      <div class="field"><label>${t('pf.import')}</label><input class="inp" id="ic" dir="ltr"></div>
      <button class="btn ghost mt-2" id="imp">${t('pf.import')}</button>`,
      actions:[]});
    const root = document.getElementById('modal-root');
    root.querySelector('#cp').onclick = ()=>{ U.copyText(codeData).then(()=>PV.ui.toast(t('c.copied'),'ok','check')); };
    root.querySelector('#imp').onclick = ()=>{
      try{
        const data = JSON.parse(decodeURIComponent(escape(atob(root.querySelector('#ic').value.trim()))));
        const prof = PV.store.loadProfile(data.u);
        if(prof){ PV.store.login(data.u, prof.name); PV.ui.toast(t('pf.imported'),'ok','check'); root.querySelector('.x').click(); PV.router.render(); }
        else PV.ui.toast(t('pf.badCode'),'err');
      }catch(e){ PV.ui.toast(t('pf.badCode'),'err'); }
    };
  }
}
PV.screens = PV.screens||{};
PV.screens.profile = {render};
})();
