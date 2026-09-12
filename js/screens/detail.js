/* ============ Screen: Game detail / lobby ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt } = U;

async function render(view, m){
  const id = m[1];
  const g = PV.registry.get(id);
  if(!g){ view.innerHTML = `<div class="empty"><p>404</p></div>`; return; }
  await PV.registry.ensureLoaded(id);

  const p = PV.store.me();
  const best = p?.stats?.best?.[id];
  const bg = p?.stats?.byGame?.[id] || {plays:0, wins:0};
  const rating = p ? PV.store.rating(id) : 1000;
  const diff = U.LS.get('diff:'+id, 'normal');

  view.innerHTML = `
  <a class="btn sm ghost rise" href="#/discover" style="margin-bottom:14px">${icon('back',16)} ${t('c.back')}</a>
  <div class="gd-hero rise rise-1">
    <div class="gd-art">${V.thumb(id)}</div>
    <div class="gd-info">
      <div class="row wrap" style="gap:6px">${(g.cats||[]).map(c=>`<span class="badge pp">${esc(PV.registry.catLabel(c))}</span>`).join('')}</div>
      <h1>${esc(PV.t('g.'+id))}</h1>
      <p class="muted">${esc(PV.t('g.'+id+'.d'))}</p>
      <div class="mode-grid">
        <div class="mode-card c2" id="m-bot">
          <div class="mic2">${icon('user',22)}</div>
          <b>${t('gd.solo')}</b><span>${t('gd.soloD')}</span>
        </div>
        <div class="mode-card" id="m-online">
          <div class="mic2">${icon('wifi',22)}</div>
          <b>${t('gd.online')}</b><span>${t('gd.onlineD')}</span>
        </div>
        <div class="mode-card c3" id="m-quick">
          <div class="mic2">${icon('zap',22)}</div>
          <b>${t('home.quick')}</b><span>${t('mm.sub')}</span>
        </div>
      </div>
      <div class="card mt-2" style="padding:14px 16px">
        <div class="row wrap" style="gap:14px">
          <span class="small" style="font-weight:800">${t('gd.diff')}:</span>
          <div class="seg" id="diffseg" style="flex:1;max-width:280px">
            <button data-d="easy" class="${diff==='easy'?'on':''}">${t('gd.easy')}</button>
            <button data-d="normal" class="${diff==='normal'?'on':''}">${t('gd.normal')}</button>
            <button data-d="hard" class="${diff==='hard'?'on':''}">${t('gd.hard')}</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="rise rise-2">${PV.ui.sectHead(t('gd.how'), 'info')}
    <div class="card glass" style="font-size:.92rem">${esc(PV.t('g.'+id+'.h'))}</div>
  </div>

  <div class="rise rise-3">${PV.ui.sectHead(t('gd.stats'), 'spark')}
    <div class="row wrap" style="gap:11px">
      <div class="stat-tile"><b class="num">${fmt(best??'—')}</b><span class="lbl">${t('gd.best')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(bg.plays)}</b><span class="lbl">${t('gd.plays')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(bg.wins)}</b><span class="lbl">${t('pf.wins')}</span></div>
      <div class="stat-tile"><b class="num">${fmt(rating)}</b><span class="lbl">${t('pf.global')}</span></div>
    </div>
  </div>

  <div class="rise rise-4">${PV.ui.sectHead(t('gd.lb'), 'trophy', '#/boards')}
    <div class="col" style="gap:8px" id="glb"><div class="row" style="justify-content:center;padding:20px"><div class="spinner"></div></div></div>
  </div>`;

  view.querySelectorAll('#diffseg [data-d]').forEach(b=> b.onclick = ()=>{
    U.LS.set('diff:'+id, b.dataset.d);
    view.querySelectorAll('#diffseg button').forEach(x=>x.classList.toggle('on', x===b));
  });
  view.querySelector('#m-bot').onclick = ()=> PV.sdk.launch({gameId:id, mode:'solo', diff: U.LS.get('diff:'+id,'normal')});
  view.querySelector('#m-quick').onclick = ()=> PV.homeQuick.quickPlay ? PV.homeQuick.quickPlay() : PV.sdk.launch({gameId:id, mode:'solo'});
  view.querySelector('#m-online').onclick = ()=>{
    /* go to room with game preselected */
    sessionStorage.setItem('pv:presetGame', id);
    location.hash = '#/room';
  };

  /* leaderboard async */
  PV.cloud.topScores(id).then(rows=>{
    const box = view.querySelector('#glb'); if(!box) return;
    box.innerHTML = PV.ui.lbList((rows||[]).slice(0,8), p?.name);
  });
}
PV.screens = PV.screens||{};
PV.screens.detail = {render};
})();
