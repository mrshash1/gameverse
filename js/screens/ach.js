/* ============ Screen: Achievements ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon, fmt } = U;

async function render(view){
  const p = PV.store.me();
  const got = p? p.badges.length : 0;
  view.innerHTML = `
  <div class="rise">${PV.ui.pageHead(t('ach.title'), 'medal', p? fmt(got)+' / '+fmt(PV.ach.LIST.length) : t('pf.loginFirst'))}</div>
  <div class="pbar rise rise-1" style="max-width:280px;margin-bottom:20px"><i style="width:${p? Math.round(got/PV.ach.LIST.length*100):0}%"></i></div>
  <div class="ach-grid">
    ${PV.ach.LIST.map(a=>{
      const has = p? p.badges.includes(a.id):false;
      const pr = p? PV.ach.progressOf(a):{cur:0,max:1};
      const pct = pr.max>0? Math.min(100, Math.round(pr.cur/pr.max*100)) : 0;
      return `<div class="ach-tile ${has?'got':''}">
        <span class="aic">${icon(a.ic,28)}</span>
        <b>${esc(t(PV.ach.META[a.id]))}</b>
        <span class="d">${esc(t(PV.ach.META[a.id]+'D'))}</span>
        ${!has? `<div class="pbar"><i style="width:${pct}%"></i></div><span class="tiny muted num">${fmt(Math.min(pr.cur,pr.max))}/${fmt(pr.max)}</span>`:''}
        ${has? `<span class="badge gold">${t('ach.got')} ${a.rw? '+'+fmt(a.rw)+' 🪙':''}</span>`:`<span class="tiny muted">${t('ach.reward',{r:a.rw? fmt(a.rw)+' 🪙':'✦'})}</span>`}
      </div>`;
    }).join('')}
  </div>`;
}
PV.screens = PV.screens||{};
PV.screens.ach = {render};
})();
