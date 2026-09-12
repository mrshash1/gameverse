/* ============ Screen: Notifications ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon } = U;

async function render(view){
  const p = PV.store.me();
  if(!p){ view.innerHTML = `<div class="empty"><span class="eic">${icon('bell',30)}</span><p>${t('pf.loginFirst')}</p><a class="btn" href="#/auth">${t('nav.login')}</a></div>`; return; }
  let notifs = U.LS.get('notifs:'+p.u, []);
  notifs = notifs.map(n=>({...n, read:true}));
  U.LS.set('notifs:'+p.u, notifs);

  view.innerHTML = `
  <div class="rise row">${PV.ui.pageHead(t('nt.title'), 'bell')}
    <span class="spacer"></span>${notifs.length? `<button class="btn sm ghost" id="clear">${icon('trash',14)} ${t('nt.markAll')}</button>`:''}
  </div>
  <div class="col" style="gap:9px">
    ${notifs.length? notifs.map(n=>PV.ui.notifRow({...n, read:true})).join('')
      : `<div class="empty"><span class="eic">${icon('bell',30)}</span><p>${t('nt.empty')}</p></div>`}
  </div>`;
  view.querySelector('#clear')?.addEventListener('click', ()=>{
    U.LS.set('notifs:'+p.u, []);
    PV.router.render();
  });
}
PV.screens = PV.screens||{};
PV.screens.notifs = {render};
})();
