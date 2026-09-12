/* ============ Screen: Settings ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon } = U;

async function render(view){
  const s = PV.store.settings;
  view.innerHTML = `
  <div class="rise">${PV.ui.pageHead(t('st.title'), 'gear')}</div>
  <div style="max-width:640px">
    <div class="set-row rise rise-1">
      <span class="si">${icon('globe',20)}</span>
      <div class="st2"><b>${t('st.lang')}</b><span>fa · en · ar</span></div>
      <div class="seg" id="langs">${PV.i18n.langs.map(l=>`<button data-l="${l}" class="${PV.i18n.lang===l?'on':''}">${PV.i18n.langNames[l]}</button>`).join('')}</div>
    </div>
    <div class="set-row rise rise-1">
      <span class="si">${icon('sun',20)}</span>
      <div class="st2"><b>${t('st.theme')}</b><span>${t('st.title')}</span></div>
      <div class="theme-pick">
        <button class="tl ${s.theme==='light'?'on':''}" data-t="light" title="Light"></button>
        <button class="td ${s.theme==='dark'?'on':''}" data-t="dark" title="Dark"></button>
      </div>
    </div>
    <div class="set-row rise rise-2">
      <span class="si">${icon('vol',20)}</span>
      <div class="st2"><b>${t('st.sound')}</b><span>${t('st.vol')}</span></div>
      <input type="range" min="0" max="100" value="${Math.round((s.vol??.8)*100)}" id="vol" style="width:110px;accent-color:var(--p1)">
      <label class="sw"><input type="checkbox" id="snd" ${s.sound!==false?'checked':''}><i></i></label>
    </div>
    <div class="set-row rise rise-2">
      <span class="si">${icon('spark',20)}</span>
      <div class="st2"><b>${t('st.motion')}</b><span>${t('st.motionD')}</span></div>
      <label class="sw"><input type="checkbox" id="motion" ${s.motion!==false?'checked':''}><i></i></label>
    </div>
    <div class="set-row rise rise-3">
      <span class="si">${icon('wifi',20)}</span>
      <div class="st2"><b>${t('st.server')}</b><span>${t('st.serverD')}</span>
        <div class="row mt-1 wrap" style="gap:8px">
          <input class="inp" id="svurl" dir="ltr" placeholder="${t('st.serverPh')}" value="${esc(PV.store.settings.serverUrl||'')}" style="flex:1;min-width:200px">
          <button class="btn sm" id="svtest">${t('sv.test')}</button>
        </div>
        <div class="tiny mt-1" id="svstat" style="font-weight:700"></div>
      </div>
    </div>
    <div class="set-row rise rise-3">
      <span class="si">${icon('cloud' in {} ?'wifi':'wifi',20)}</span>
      <div class="st2"><b>${t('st.cloud')}</b><span>${t('au.cloudOn')} / ${t('au.cloudOff')}</span></div>
      <span class="badge ${PV.cloud.state==='ok'?'ok':'warn'}" id="cloudstat">${PV.cloud.state==='ok'? t('c.on') : t('c.off')}</span>
    </div>
    <div class="set-row rise rise-3">
      <span class="si">${icon('shield',20)}</span>
      <div class="st2"><b>${t('nav.admin')}</b><span>${t('ad.title')}</span></div>
      <a class="btn sm ghost" href="#/admin">${t('c.start')}</a>
    </div>
    <div class="set-row rise rise-4">
      <span class="si" style="color:var(--err)">${icon('trash',20)}</span>
      <div class="st2"><b>${t('st.clear')}</b><span>${t('st.clearC')}</span></div>
      <button class="btn sm danger" id="wipe">${t('st.clear')}</button>
    </div>
    <div class="card rise rise-4 center" style="margin-top:16px;padding:22px">
      <div style="width:60px;margin:0 auto 8px">${PV.visuals.logo}</div>
      <b>پلی‌ورس — PlayVerse</b>
      <div class="tiny muted">${t('st.ver')} ${PV.ver||'2.0'} · ${t('st.open')}</div>
      <div class="tiny muted mt-1">10 games · WebRTC P2P · Real server accounts · GitHub Pages</div>
    </div>
  </div>`;

  view.querySelectorAll('#langs [data-l]').forEach(b=> b.onclick = ()=>{
    PV.i18n.setLang(b.dataset.l);
    PV.ui.toast(PV.i18n.langNames[b.dataset.l],'ok','globe');
    PV.router.render();
  });
  view.querySelectorAll('.theme-pick [data-t]').forEach(b=> b.onclick = ()=>{
    PV.store.saveSettings({theme:b.dataset.t});
    view.querySelectorAll('.theme-pick button').forEach(x=>x.classList.toggle('on', x===b));
  });
  view.querySelector('#vol').oninput = e=> PV.store.saveSettings({vol: e.target.value/100});
  view.querySelector('#snd').onchange = e=>{ PV.store.saveSettings({sound:e.target.checked}); PV.sound.play('pop'); };
  view.querySelector('#motion').onchange = e=> PV.store.saveSettings({motion:e.target.checked});
  /* ---- game server ---- */
  const svstat = view.querySelector('#svstat');
  const svShow = (ok, txt)=>{ svstat.textContent = txt; svstat.style.color = ok? 'var(--ok)':'var(--err)'; };
  if(PV.sapi && PV.sapi.configured() && PV.sapi.getState()==='ok'){ svShow(true, t('sv.ok')); }
  view.querySelector('#svtest').onclick = async ()=>{
    const url = view.querySelector('#svurl').value.trim();
    PV.store.saveSettings({serverUrl:url});
    if(!url){ svShow(false, t('c.off')+' — '+t('sv.hint')); return; }
    svShow(true, t('sv.testing'));
    const ok = await PV.sapi.probe(true);
    svShow(ok, ok? t('sv.ok')+' '+t('sv.online',{n:PV.sapi.onlineNow()}) : t('sv.fail'));
    if(ok) PV.cloud.syncNow();
  };
  view.querySelector('#svurl').onkeydown = e=>{ if(e.key==='Enter') view.querySelector('#svtest').click(); };
  view.querySelector('#wipe').onclick = async ()=>{
    if(await PV.ui.confirmDlg(t('st.clearC'))){
      const keep = ['pv:settings'];
      Object.keys(localStorage).filter(k=>k.startsWith('pv:')).forEach(k=>{ if(!keep.includes(k)) localStorage.removeItem(k); });
      location.hash='#/'; location.reload();
    }
  };
}
PV.screens = PV.screens||{};
PV.screens.settings = {render};
})();
