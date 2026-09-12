/* ============ Screen: Rewards (daily streak + missions) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon, fmt } = U;

const DAY_REWARDS = [15,20,25,30,40,50,100];

async function render(view){
  const p = PV.store.me();
  if(!p){ view.innerHTML = `<div class="empty"><span class="eic">${icon('gift',30)}</span><p>${t('pf.loginFirst')}</p><a class="btn" href="#/auth">${t('nav.login')}</a></div>`; return; }
  const streak = p.streak.count||0;
  const dayIdx = Math.min(6, (streak-1+7)%7);
  const claimedToday = p.streak.last===U.todayKey();
  const todayReward = DAY_REWARDS[Math.min(6, streak%7===0&&streak>0? 6: streak%7)];
  const missions = PV.missions.today();

  view.innerHTML = `
  <div class="rise">${PV.ui.pageHead(t('mi.title'), 'gift')}</div>

  <div class="card glass rise rise-1" style="margin-bottom:18px">
    <div class="row wrap" style="justify-content:space-between;margin-bottom:12px">
      <b>${t('mi.streakT')}</b>
      <span class="badge gold">${icon('fire',13)} ${fmt(streak)} ${t('pf.streak')}</span>
    </div>
    <div class="streak-grid">
      ${DAY_REWARDS.map((r,i)=>{
        const done = i < Math.min(streak,7) && (streak>=7 || i<=dayIdx) && claimedToday? (i<=dayIdx):(i<Math.min(streak,7));
        const isToday = i === (streak%7===0&&streak>0?6:streak%7) && !claimedToday? true : (i===Math.min(streak-1,6)&&claimedToday&&streak<=7);
        return `<div class="streak-day ${done?'done':''} ${isToday?'today':''}">
          <span>${fmt(i+1)}</span>
          <span class="rd">${done?'✓':'🪙'}</span>
          <span class="tiny">${fmt(r)}</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn gold mt-3" id="claimDay" ${claimedToday?'disabled':''}>
      ${icon('coin',17)} ${claimedToday? t('mi.claimed') : t('mi.claim')+' — '+fmt(todayReward)+' 🪙'}
    </button>
  </div>

  <div class="rise rise-2">${PV.ui.sectHead(t('mi.title'), 'target')}
    <div class="col" style="gap:10px">
      ${missions.map(m=>{
        const def = PV.missions.defs().find(d=>d.id===m.id);
        if(!def) return '';
        const pct = Math.min(100, Math.round(m.prog/def.goal*100));
        return `<div class="mission-mini" style="min-width:100%">
          <span class="mic" style="background:rgba(124,92,255,.12);color:var(--p1)">${icon(def.ic,22)}</span>
          <div class="mt"><b>${esc(t(PV.missions.META[m.id]))}</b>
            <div class="pbar mt-1"><i style="width:${pct}%"></i></div>
            <div class="row tiny muted" style="justify-content:space-between;margin-top:4px">
              <span class="num">${fmt(Math.min(m.prog,def.goal))}/${fmt(def.goal)}</span>
              <span>+${fmt(def.rw.xp||0)} XP · +${fmt(def.rw.coins||0)} 🪙</span>
            </div>
          </div>
          ${m.claimed? `<span class="badge ok">${t('mi.claimed')}</span>` : m.done? `<button class="btn sm gold" data-claim="${m.id}">${t('mi.claim')}</button>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`;

  view.querySelector('#claimDay').onclick = ()=>{
    if(claimedToday) return;
    const r = DAY_REWARDS[Math.min(6, (streak%7===0&&streak>0)?6:streak%7)];
    p.coins += r; PV.store.saveProfile(p);
    PV.ui.toast('+'+fmt(r)+' 🪙','gold','coin');
    PV.sound.play('coin');
    PV.missions.track({event:'streakDay', n:streak});
    PV.ach.evaluate({event:'streakDay', n:streak, p});
    PV.cloud.pushProfile();
    PV.router.render();
  };
  view.querySelectorAll('[data-claim]').forEach(b=> b.onclick = ()=>{
    const rw = PV.missions.claim(b.dataset.claim);
    if(rw){ PV.sound.play('coin'); PV.ui.toast('+'+fmt(rw.xp||0)+' XP +'+fmt(rw.coins||0)+' 🪙','gold','coin'); PV.cloud.pushProfile(); PV.router.render(); }
  });
}
PV.screens = PV.screens||{};
PV.screens.rewards = {render};
})();
