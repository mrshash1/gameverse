/* ============ PlayVerse UI kit ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, el, fmt, levelFromXp } = U;
const icon = PV.visuals.icon;

/* ---------- Toast ---------- */
function toast(msg, type='info', ic){
  const box = document.getElementById('toasts');
  const icName = ic || {ok:'check', err:'x', info:'info', pp:'spark', gold:'coin'}[type] || 'info';
  const n = el(`<div class="toast ${type}"><span class="ic">${icon(icName,18)}</span><span>${msg}</span></div>`);
  box.appendChild(n);
  setTimeout(()=>{ n.classList.add('out'); setTimeout(()=>n.remove(), 320); }, 3400);
}

/* ---------- Modal ---------- */
function modal({title, body, actions=[], onOpen, lg=false}){
  const root = document.getElementById('modal-root');
  const m = el(`<div class="modal ${lg?'lg':''}">
    <button class="x" aria-label="close">${icon('x',18)}</button>
    ${title?`<h2>${title}</h2>`:''}
    <div class="mbody">${body||''}</div>
    <div class="row mt-3 wrap" style="justify-content:flex-end;gap:9px" id="macts"></div>
  </div>`);
  const bg = el('<div class="modal-bg"></div>');
  root.innerHTML=''; root.classList.add('open');
  root.append(bg, m);
  const close = ()=>{ root.classList.remove('open'); root.innerHTML=''; };
  bg.onclick = close;
  m.querySelector('.x').onclick = close;
  const actsBox = m.querySelector('#macts');
  actions.forEach(a=>{
    const b = el(`<button class="btn ${a.cls||''}">${a.label}</button>`);
    b.onclick = ()=>{ const r = a.onClick && a.onClick(m); if(r!==false) close(); };
    actsBox.appendChild(b);
  });
  if(onOpen) onOpen(m);
  return {close, root:m};
}
function confirmDlg(msg, okLabel){
  return new Promise(res=>{
    modal({
      title: t('c.confirm'), body:`<p class="muted">${msg}</p>`,
      actions:[
        {label:t('c.cancel'), cls:'ghost'},
        {label:okLabel||t('c.ok'), cls:'danger', onClick:()=>res(true)},
      ]
    });
    setTimeout(()=>{},0);
    const root=document.getElementById('modal-root');
    const obs = new MutationObserver(()=>{ if(!root.classList.contains('open')){ obs.disconnect(); res(false); } });
    obs.observe(root, {attributes:true});
  });
}

/* ---------- Avatar ---------- */
function avatarHtml(p, size=44, opts={}){
  const av = V.avatar(p?.avatar || 'fox');
  const lvl = p? levelFromXp(p.xp).level : 1;
  return `<span class="av ${opts.ring?'ring':''}" style="width:${size}px;height:${size}px">${av}${opts.lvl?`<i class="lvl">${fmt(lvl)}</i>`:''}${opts.dot?'<i class="on-dot"></i>':''}</span>`;
}

/* ---------- Game card ---------- */
function gameCard(g){
  const d = document.createElement('article');
  d.className = 'gcard';
  const favs = PV.store.settings.favs||[];
  const isFav = favs.includes(g.id);
  d.innerHTML = `
    <div class="thumb">
      ${V.thumb(g.id)}
      <div class="glow"></div>
      <div class="cats">${(g.cats||[]).slice(0,2).map(c=>`<span class="badge">${esc(PV.registry.catLabel(c))}</span>`).join('')}</div>
      <button class="fav ${isFav?'on':''}" aria-label="fav">${icon('heart',16)}</button>
      <span class="online-live"><i></i>${fmt(g.plays||0)}</span>
    </div>
    <div class="meta">
      <h3>${esc(PV.t('g.'+g.id))}</h3>
      <div class="d">${esc(PV.t('g.'+g.id+'.d'))}</div>
      <div class="foot">
        <span class="row" style="gap:4px">${icon('users',13)} ${g.players[0]}${g.players[1]>g.players[0]? '-'+g.players[1]:''}</span>
        <span class="spacer"></span>
        <span class="row" style="gap:4px">${g.modes.includes('online')?icon('wifi',13):icon('user',13)}</span>
      </div>
    </div>`;
  d.querySelector('.fav').onclick = e=>{
    e.stopPropagation();
    const list = PV.store.settings.favs||[];
    const i = list.indexOf(g.id);
    if(i>=0) list.splice(i,1); else list.push(g.id);
    PV.store.saveSettings({favs:list});
    e.currentTarget.classList.toggle('on');
    PV.sound.play('pop');
  };
  d.onclick = ()=>{ PV.sound.play('tap'); location.hash = '#/game/'+g.id; };
  return d;
}

/* ---------- Section header ---------- */
function sectHead(title, ic, moreHref){
  return `<div class="sect-h rise"><h2>${ic?icon(ic,20):''}${title}</h2>${moreHref?`<a class="more" href="${moreHref}">${t('c.seeAll')} ${PV.i18n.dir==='rtl'?'‹':'›'}</a>`:''}</div>`;
}

/* ---------- Leaderboard list ---------- */
function lbList(rows, myName, scoreLabel){
  if(!rows.length) return `<div class="empty"><span class="eic">${icon('trophy',34)}</span><p>${t('lb.noData')}</p></div>`;
  return rows.map((r,i)=>{
    const rank = i+1;
    const cls = rank===1?'r1':rank===2?'r2':rank===3?'r3':'';
    const me = myName && String(r.u).toLowerCase()===String(myName).toLowerCase();
    return `<div class="lb-row ${cls} ${me?'me':''}">
      <span class="rank">${rank<=3?icon('medal',17):fmt(rank)}</span>
      ${avatarHtml(r, 38)}
      <span class="nm"><b>${esc(r.u||'؟')}</b><span class="tiny muted">${r.lvl? t('c.lvl')+' '+fmt(r.lvl):''}</span></span>
      <span class="pts">${fmt(r.s ?? r.xp ?? 0)}</span>
    </div>`;
  }).join('');
}

/* ---------- Tabs ---------- */
function tabsHtml(items, active){
  return `<div class="tabs">${items.map(i=>`<button data-tab="${i.id}" class="${i.id===active?'on':''}">${i.label}</button>`).join('')}</div>`;
}

/* ---------- Confetti ---------- */
function confetti(ms=2600){
  const cv = document.getElementById('confetti');
  cv.style.display='block';
  const ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#7c5cff','#00c9bd','#ff5c9d','#ffb020','#3ba9ff','#22c55e'];
  const P = Array.from({length:160}, ()=>({
    x: Math.random()*cv.width, y: -20-Math.random()*cv.height*.4,
    w: 6+Math.random()*8, h: 8+Math.random()*8,
    vy: 2.4+Math.random()*3.6, vx: -1.6+Math.random()*3.2,
    rot: Math.random()*Math.PI, vr: -.12+Math.random()*.24,
    c: colors[Math.floor(Math.random()*colors.length)]
  }));
  const t0 = Date.now();
  (function frame(){
    ctx.clearRect(0,0,cv.width,cv.height);
    for(const p of P){
      p.y += p.vy; p.x += p.vx + Math.sin(p.y*.02); p.rot += p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    }
    if(Date.now()-t0 < ms) requestAnimationFrame(frame);
    else { ctx.clearRect(0,0,cv.width,cv.height); cv.style.display='none'; }
  })();
}

/* ---------- Navbar + bottom nav ---------- */
const NAV = [
  {href:'#/', ic:'home', k:'nav.home', id:'home'},
  {href:'#/discover', ic:'compass', k:'nav.disc', id:'discover'},
  {href:'#/boards', ic:'trophy', k:'nav.boards', id:'boards'},
  {href:'#/friends', ic:'users', k:'nav.friends', id:'friends'},
];
function renderNav(){
  const nb = document.getElementById('navbar');
  const p = PV.store.me();
  const route = (PV.router?.current||'').split('/')[1] || 'home';
  const unread = p? (PV.LS ? 0:0):0;
  nb.innerHTML = `<div class="nav-in">
    <a class="brand" href="#/">${V.logo.replace('<svg','<svg class="logo"')}<b>پلی‌ورس</b></a>
    <div class="nav-links">${NAV.map(n=>`<button data-nav="${n.id}" class="${route===n.id?'on':''}" onclick="location.hash='${n.href}'">${icon(n.ic,19)}<span>${t(n.k)}</span></button>`).join('')}
      <button data-nav="rewards" class="${route==='rewards'?'on':''}" onclick="location.hash='#/rewards'">${icon('gift',19)}<span>${t('nav.rewards')}</span></button>
    </div>
    <div class="nav-right">
      ${p?`<a class="nav-chip pp" href="#/profile" title="XP">${icon('spark',14)}<span class="num">${fmt(p.xp)}</span></a>
      <a class="nav-chip gold" href="#/rewards" title="coins">${icon('coin',14)}<span class="num">${fmt(p.coins)}</span></a>`:''}
      <button class="bell icon avbtn" id="bellBtn" style="color:var(--tx2)">${icon('bell',21)}${hasUnread()?'<span class="dot"></span>':''}</button>
      ${p?`<a class="avbtn" href="#/profile">${avatarHtml(p,38,{dot:true})}</a>`
         :`<a class="btn sm" href="#/auth">${icon('user',15)} ${t('nav.login')}</a>`}
    </div>
  </div>`;
  nb.querySelector('#bellBtn').onclick = bellDrop;
  const bn = document.getElementById('bottomnav');
  bn.innerHTML = [
    {href:'#/', ic:'home', k:'nav.home', id:'home'},
    {href:'#/discover', ic:'compass', k:'nav.disc', id:'discover'},
    {href:'#/friends', ic:'users', k:'nav.friends', id:'friends'},
    {href:'#/boards', ic:'trophy', k:'nav.boards', id:'boards'},
    p? {href:'#/profile', ic:'user', k:'nav.prof', id:'profile'} : {href:'#/auth', ic:'user', k:'nav.login', id:'auth'},
  ].map(n=>`<button class="${route===n.id?'on':''}" onclick="location.hash='${n.href}'">${icon(n.ic,21)}<span>${t(n.k)}</span></button>`).join('');
}
function hasUnread(){
  const p = PV.store.me(); if(!p) return false;
  const notifs = U.LS.get('notifs:'+p.u, []);
  return notifs.some(n=>!n.read);
}
function bellDrop(){
  const p = PV.store.me();
  const btn = document.getElementById('bellBtn');
  let drop = document.querySelector('.bell-drop');
  if(drop){ drop.remove(); return; }
  const notifs = p? U.LS.get('notifs:'+p.u, []).slice(0,8) : [];
  drop = el(`<div class="bell-drop">
    <div class="bd-h"><span>${t('nt.title')}</span>${p&&notifs.length?`<button class="tiny" id="markAll" style="color:var(--p1);font-weight:800">${t('nt.markAll')}</button>`:''}</div>
    <div class="bd-list">${notifs.length? notifs.map(n=>notifRow(n)).join('') : `<div class="empty" style="padding:22px"><span class="eic">${icon('bell',26)}</span><p class="small">${t('nt.empty')}</p></div>`}</div>
  </div>`);
  btn.style.position='relative';
  btn.appendChild(drop);
  setTimeout(()=>{
    const closer = e=>{ if(!drop.contains(e.target) && e.target!==btn){ drop.remove(); document.removeEventListener('click', closer); } };
    document.addEventListener('click', closer);
  },10);
  drop.querySelectorAll('#markAll')?.forEach(b=>b.onclick = ()=>{
    const nn = U.LS.get('notifs:'+p.u, []).map(n=>({...n, read:true}));
    U.LS.set('notifs:'+p.u, nn);
    drop.remove(); renderNav();
  });
}
function notifRow(n){
  const ics = {req:'users', invite:'swords', ach:'medal', sys:'info', msg:'chat'};
  const cols = {req:'pp', invite:'info', ach:'gold', sys:'info', msg:'pp'};
  return `<div class="notif-item ${n.read?'':'unread'}">
    <span class="nic ${cols[n.type]||'info'}" style="background:var(--surface3);color:var(--p1)">${icon(ics[n.type]||'bell',17)}</span>
    <div style="flex:1;min-width:0"><b class="small">${esc(n.txt)}</b><div class="tiny muted">${U.timeAgo(n.ts)}</div></div>
  </div>`;
}
function notify(type, txt, extra={}){
  const p = PV.store.me(); if(!p) return;
  const notifs = U.LS.get('notifs:'+p.u, []);
  notifs.unshift({id:U.uid(9), type, txt, ts:Date.now(), read:false, ...extra});
  U.LS.set('notifs:'+p.u, notifs.slice(0,60));
  renderNav();
  document.dispatchEvent(new CustomEvent('pv:notif'));
}

/* ---------- page scaffold ---------- */
function pageHead(title, ic, sub){
  return `<div class="rise" style="margin-bottom:18px">
    <h1 style="font-size:1.45rem;font-weight:900;display:flex;align-items:center;gap:10px">${ic?`<span style="color:var(--p1)">${icon(ic,26)}</span>`:''}${title}</h1>
    ${sub?`<p class="muted small" style="margin-top:3px">${sub}</p>`:''}
  </div>`;
}

PV.ui = { toast, modal, confirmDlg, avatarHtml, gameCard, sectHead, lbList, tabsHtml, confetti, renderNav, notifRow, notify, pageHead, hasUnread };
Object.assign(PV.u, {icon: PV.visuals.icon, tierIcon: PV.visuals.tierIcon, avatarHtml});
})();
