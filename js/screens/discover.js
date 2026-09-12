/* ============ Screen: Discover ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon, fmt } = U;

let state = {cat:'all', q:'', sort:'pop'};

async function render(view){
  const cats = await PV.registry.allCats();
  view.innerHTML = `
  <div class="disc-head rise">
    <div style="flex:1;min-width:200px">${PV.ui.pageHead(t('disc.title'), 'compass')}</div>
    <button class="btn pink" id="surprise">${t('disc.surprise')}</button>
  </div>
  <div class="rise rise-1">
    <div class="search-box">${icon('search',19)}<input class="inp" id="dq" placeholder="${t('c.search')}" value="${esc(state.q)}"></div>
  </div>
  <div class="catscroll rise rise-1" id="catrow"></div>
  <div class="row rise rise-2" style="gap:8px;margin-bottom:14px">
    <button class="chip ${state.sort==='pop'?'on':''}" data-sort="pop">${t('disc.pop')}</button>
    <button class="chip ${state.sort==='new'?'on':''}" data-sort="new">${t('disc.new')}</button>
    <button class="chip ${state.sort==='mp'?'on':''}" data-sort="mp">${t('disc.mp')}</button>
    <span class="spacer"></span><span class="tiny muted" id="count"></span>
  </div>
  <div class="ggrid" id="grid"></div>`;

  const catrow = view.querySelector('#catrow');
  function drawCats(){
    catrow.innerHTML = [`<button class="chip ${state.cat==='all'?'on':''}" data-cat="all">${t('c.all')}</button>`,
      `<button class="chip ${state.cat==='fav'?'on':''}" data-cat="fav">${t('disc.favs')}</button>`,
      ...cats.map(c=>`<button class="chip ${state.cat===c?'on':''}" data-cat="${esc(c)}">${esc(PV.registry.catLabel(c))}</button>`)
    ].join('');
    catrow.querySelectorAll('[data-cat]').forEach(b=> b.onclick = ()=>{ state.cat=b.dataset.cat; drawCats(); drawGrid(); PV.sound.play('tap'); });
  }
  function list(){
    let games = PV.registry.all().filter(g=>PV.registry.enabled(g.id));
    if(state.cat==='fav') games = games.filter(g=>(PV.store.settings.favs||[]).includes(g.id));
    else if(state.cat!=='all') games = games.filter(g=>(g.cats||[]).includes(state.cat));
    if(state.sort==='mp') games = games.filter(g=>g.modes.includes('online'));
    if(state.q){ const q=state.q.toLowerCase(); games = games.filter(g=> (PV.t('g.'+g.id)+' '+PV.t('g.'+g.id+'.d')+' '+(g.cats||[]).join(' ')).toLowerCase().includes(q)); }
    if(state.sort==='pop') games.sort((a,b)=>b.plays-a.plays);
    return games;
  }
  function drawGrid(){
    const grid = view.querySelector('#grid');
    const games = list();
    grid.innerHTML='';
    view.querySelector('#count').textContent = fmt(games.length)+' '+t('disc.results');
    if(!games.length){
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="eic">${icon('search',30)}</span><p>${t('c.none')}</p></div>`;
      return;
    }
    games.forEach(g=> grid.appendChild(PV.ui.gameCard(g)));
  }
  view.querySelectorAll('[data-sort]').forEach(b=> b.onclick = ()=>{ state.sort=b.dataset.sort; view.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('on', x===b)); drawGrid(); });
  view.querySelector('#dq').oninput = U.debounce(e=>{ state.q = e.target.value; drawGrid(); }, 150);
  view.querySelector('#surprise').onclick = ()=>{
    const games = PV.registry.all().filter(g=>PV.registry.enabled(g.id));
    const g = games[Math.floor(Math.random()*games.length)];
    PV.sound.play('pop');
    location.hash = '#/game/'+g.id;
  };
  drawCats(); drawGrid();
}
PV.screens = PV.screens||{};
PV.screens.discover = {render};
})();
