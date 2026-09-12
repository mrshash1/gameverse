/* ============ Screen: Leaderboards ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml, tierIcon, tierOf } = U;

let tab = 'global', gameId = null;

async function render(view){
  const p = PV.store.me();
  const games = PV.registry.all().filter(g=>PV.registry.enabled(g.id));
  if(!gameId || !PV.registry.get(gameId)) gameId = games[0]?.id;

  const myRatingRows = games.map(g=>({g, r: p? PV.store.rating(g.id):1000})).sort((a,b)=>b.r-a.r).slice(0,4);

  view.innerHTML = `
  <div class="rise">${PV.ui.pageHead(t('lb.title'), 'trophy', p? undefined:t('pf.loginFirst'))}</div>
  <div class="rise rise-1" style="margin-bottom:14px">
    ${PV.ui.tabsHtml([
      {id:'global', label:t('lb.global')},
      {id:'game', label:t('lb.game')},
      {id:'friends', label:t('lb.fr')},
      {id:'mine', label:t('pf.global')},
    ], tab)}
  </div>
  <div id="lb-body"></div>`;

  view.querySelectorAll('.tabs [data-tab]').forEach(b=> b.onclick = ()=>{ tab=b.dataset.tab; render(view); });

  const body = view.querySelector('#lb-body');
  if(tab==='global'){
    body.innerHTML = spinner();
    const rows = await PV.cloud.globalBoard();
    body.innerHTML = `<div class="col" style="gap:8px">${PV.ui.lbList(rows, p?.name)}</div>`;
  }
  else if(tab==='game'){
    body.innerHTML = `
      <div class="catscroll" style="margin-bottom:12px">${games.map(g=>`<button class="chip ${g.id===gameId?'on':''}" data-g="${g.id}">${esc(PV.t('g.'+g.id))}</button>`).join('')}</div>
      <div class="col" id="glb" style="gap:8px">${spinner()}</div>`;
    body.querySelectorAll('[data-g]').forEach(b=> b.onclick = ()=>{ gameId=b.dataset.g; render(view); });
    const rows = await PV.cloud.topScores(gameId);
    body.querySelector('#glb').innerHTML = PV.ui.lbList(rows, p?.name);
  }
  else if(tab==='friends'){
    const fr = p? (p.friends||[]) : [];
    const rows = fr.map(f=>{ const prof = PV.store.loadProfile(String(f).toLowerCase()); return prof && {u:prof.name, av:prof.avatar, xp:prof.xp, lvl:U.levelFromXp(prof.xp).level}; }).filter(Boolean);
    if(p){ rows.push({u:p.name, av:p.avatar, xp:p.xp, lvl:U.levelFromXp(p.xp).level}); }
    rows.sort((a,b)=>b.xp-a.xp);
    body.innerHTML = `<div class="col" style="gap:8px">${PV.ui.lbList(rows, p?.name)}</div>
      ${!fr.length? `<div class="empty"><span class="eic">${icon('users',28)}</span><p>${t('fr.empty')}</p></div>`:''}`;
  }
  else {
    body.innerHTML = `<div class="ggrid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
      ${games.map(g=>{
        const r = p? PV.store.rating(g.id) : 1000;
        const tier = tierOf(r);
        return `<div class="card hover">
          <div class="row" style="gap:12px">
            <span class="av" style="width:52px;height:52px;border-radius:16px;overflow:hidden">${V.thumb(g.id)}</span>
            <div style="flex:1"><b>${esc(PV.t('g.'+g.id))}</b>
              <div class="row tiny muted" style="gap:5px">${tierIcon(tier,15)} ${t(tier)}</div>
            </div>
          </div>
          <div class="row mt-2" style="justify-content:space-between">
            <b style="font-size:1.3rem" class="num">${fmt(r)}</b>
            <a class="btn sm ghost" href="#/game/${g.id}">${t('c.start')}</a>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
}
function spinner(){ return `<div class="row" style="justify-content:center;padding:24px"><div class="spinner"></div></div>`; }
PV.screens = PV.screens||{};
PV.screens.boards = {render};
})();
