/* ============ Screen: Profile ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml, levelFromXp, tierIcon, tierOf } = U;

async function render(view){
  const p = PV.store.me();
  if(!p){ location.hash='#/auth'; return; }
  const lv = levelFromXp(p.xp);
  const winRate = p.stats.plays? Math.round(p.stats.wins/p.stats.plays*100):0;
  const badges = PV.ach.LIST.map(a=>({...a, got:p.badges.includes(a.id)}));

  view.innerHTML = `
  <div class="prof-head rise">
    ${avatarHtml(p, 92, {lvl:false})}
    <div style="flex:1;min-width:200px">
      <h1>${esc(p.name)}</h1>
      <div class="sub">
        <span class="row" style="gap:5px">${icon('user',14)} @${esc(p.u)}</span>
        <span>${t('pf.member',{d:new Date(p.created).toLocaleDateString('fa-IR')})}</span>
      </div>
      <div class="xp-card mt-1">
        <div class="row" style="justify-content:space-between;font-size:.8rem;font-weight:800">
          <span>${t('c.lvl')} ${fmt(lv.level)}</span><span class="num">${fmt(lv.into)} / ${fmt(lv.need)} XP</span>
        </div>
        <div class="pbar mt-1" style="background:rgba(0,0,0,.25)"><i style="width:${lv.pct}%"></i></div>
      </div>
    </div>
    <div class="pright">
      <button class="btn sm wt" id="edit">${icon('edit',15)} ${t('pf.edit')}</button>
      <button class="btn sm ot" id="sync">${icon('key',15)} ${t('pf.sync')}</button>
      ${!p.u.startsWith('guest-')?`<button class="btn sm ot" id="out">${icon('logout',15)} ${t('nav.logout')}</button>`:''}
    </div>
  </div>

  <div class="rise rise-1">${PV.ui.sectHead(t('pf.stats'), 'spark')}
    <div class="row wrap" style="gap:11px">
      <div class="stat-tile"><b class="num">${fmt(p.stats.plays)}</b><span class="lbl">${t('pf.games')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.stats.wins)}</b><span class="lbl">${t('pf.wins')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(winRate)}٪</b><span class="lbl">${t('pf.winRate')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.streak.count||0)} 🔥</b><span class="lbl">${t('pf.streak')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(p.coins)}</b><span class="lbl">🪙</span></div>
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

  <div class="rise rise-3">${PV.ui.sectHead(t('pf.hist'), 'clock')}
    <div class="col" style="gap:8px">${(p.history||[]).slice(0,12).map(h=>{
      const g = PV.registry.get(h.g);
      const rc = h.res==='w'?'w':h.res==='l'?'l':'d';
      const rt = h.res==='w'? t('c.win') : h.res==='l'? t('c.lose') : t('c.draw');
      return `<div class="hist-row">
        <span class="res ${rc}">${icon(h.res==='w'?'trophy':h.res==='l'?'x':'dice',18)}</span>
        <span class="av" style="width:32px;height:32px">${g? V.thumb(h.g):''}</span>
        <div style="flex:1"><b class="small">${esc(g? PV.t('g.'+g.id):h.g)}</b>
          <div class="tiny muted">${h.mode==='solo'? t('gd.solo') : t('md.'+(h.mode||'classic'))} · ${U.timeAgo(h.ts)}</div></div>
        ${h.score!=null? `<b class="num">${fmt(h.score)}</b>`:''}
        <span class="badge ${rc==='w'?'ok':rc==='l'?'err':'info'}">${rt}</span>
      </div>`;
    }).join('') || `<div class="empty"><span class="eic">${icon('dice',30)}</span><p>${t('c.none')}</p></div>`}</div>
  </div>`;

  view.querySelector('#edit').onclick = ()=> editModal(p);
  view.querySelector('#sync').onclick = ()=> syncModal(p);
  view.querySelector('#out')?.addEventListener('click', async ()=>{
    if(await PV.ui.confirmDlg(t('nav.logout')+'؟', t('c.ok'))){
      PV.store.logout();
      PV.ui.toast(t('au.bye'),'info');
      location.hash='#/';
      PV.router.render();
    }
  });

  function editModal(p){
    const avatars = V.avatars;
    const m = PV.ui.modal({title:t('pf.edit'), body:`
      <div class="col" style="gap:14px">
        <div class="field"><label>${t('c.name')}</label><input class="inp" id="en" value="${esc(p.name)}" maxlength="18"></div>
        <div class="field"><label>${t('pf.bio')}</label><textarea class="inp" id="eb" maxlength="120" placeholder="${t('pf.bioPh')}">${esc(p.bio||'')}</textarea></div>
        <div>
          <label class="small" style="font-weight:800">${'آواتار'}</label>
          <div class="wrap" style="display:flex;flex-wrap:wrap;gap:9px;margin-top:8px" id="avs"></div>
        </div>
      </div>`,
      actions:[{label:t('c.save'), cls:'', onClick:(root)=>{
        const name = root.querySelector('#en').value.trim() || p.name;
        p.name = name; p.bio = root.querySelector('#eb').value.trim();
        p.avatar = root.dataset.av || p.avatar;
        PV.store.saveProfile(p); PV.cloud.pushProfile();
        PV.ui.toast(t('pf.saved'),'ok','check');
        PV.router.render();
      }}]});
    const box = m.root.querySelector('#avs');
    let selected = p.avatar;
    avatars.forEach(id=>{
      const cost = V.avCost[id] ?? 0;
      const afford = p.coins >= cost;
      const btn = document.createElement('button');
      btn.className = 'av';
      btn.style.cssText = `width:52px;height:52px;cursor:pointer;border:3px solid ${id===selected?'var(--p1)':'transparent'};border-radius:16px;position:relative`;
      btn.innerHTML = V.avatar(id) + (cost>0? `<i class="lvl" style="inset-inline-end:-6px;bottom:-6px">${fmt(cost)}</i>`:'');
      btn.onclick = ()=>{
        if(!afford){ PV.ui.toast('🪙 '+(cost - p.coins)+' کم داری','err','coin'); return; }
        if(cost>0 && !p._ownedAvs?.includes?.(id)){
          /* buy flow */
          p._ownedAvs ||= ['fox','cat','panda','ghost'];
          if(!p._ownedAvs.includes(id)){
            p.coins -= cost; p._ownedAvs.push(id);
            PV.ui.toast('-'+fmt(cost)+' 🪙','gold','coin');
          }
        }
        selected = id; PV.store.saveProfile(p);
        box.querySelectorAll('button').forEach((b,i)=> b.style.borderColor = (avatars[i]===selected?'var(--p1)':'transparent'));
      };
      box.appendChild(btn);
    });
  }
  function syncModal(p){
    /* sync code = base64 of username+pw hash — restore on another device */
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
