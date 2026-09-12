/* ============ PlayVerse Visuals — SVG logo, avatars, thumbnails, icons ============ */
(function(){
'use strict';
const PV = window.PV;

/* ---------- Brand logo: hexagon badge + gamepad + orbit ---------- */
const LOGO = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#00c9bd"/></linearGradient>
<linearGradient id="lg-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe6ff"/></linearGradient>
<linearGradient id="lg-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5c9d"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient>
<radialGradient id="lg-d" cx=".35" cy=".3" r="1"><stop offset="0" stop-color="rgba(255,255,255,.5)"/><stop offset=".6" stop-color="rgba(255,255,255,0)"/></radialGradient>
</defs>
<g transform="translate(60 60)">
<g class="pv-orbit"><ellipse cx="0" cy="0" rx="56" ry="20" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-dasharray="4 8" transform="rotate(-24)"/></g>
<circle cx="47" cy="-26" r="7" fill="#ffb020"/><circle cx="49" cy="-28" r="2.5" fill="#fff" opacity=".8"/>
<circle cx="-50" cy="24" r="5" fill="#ff5c9d"/><circle cx="-51.5" cy="22.5" r="1.8" fill="#fff" opacity=".8"/>
<path d="M0-44 L38-22 L38 22 L0 44 L-38 22 L-38-22 Z" fill="url(#lg-a)"/>
<path d="M0-44 L38-22 L38 22 L0 44 L-38 22 L-38-22 Z" fill="url(#lg-d)"/>
<path d="M0-38 L32.5-19 L32.5 19 L0 38 L-32.5 19 L-32.5-19 Z" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
<g transform="translate(0 2)">
<path d="M-19-9 C-28-9 -31 1 -31 6 C-31 12 -27 16 -23 16 C-20 16 -18 13 -15 13 L15 13 C18 13 20 16 23 16 C27 16 31 12 31 6 C31 1 28-9 19-9 Z" fill="url(#lg-b)"/>
<circle cx="-14" cy="3" r="4.6" fill="#7c5cff"/><rect x="-17.5" y="1.6" width="7" height="2.8" rx="1.4" fill="#fff"/>
<circle cx="13" cy="3" r="4.6" fill="#00c9bd"/><circle cx="13" cy="3" r="2" fill="#fff"/>
<g transform="translate(4 -3)"><circle r="2.2" fill="#ff5c9d"/><circle cx="6" r="2.2" fill="#ffb020"/><circle cx="3" cy="-4.6" r="2.2" fill="#3ba9ff"/></g>
</g>
</g></svg>`;

/* ---------- 12 avatars (gradient animal faces) ---------- */
function face(bg, inner){
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="av-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
  <rect width="64" height="64" rx="20" fill="url(#av-g)"/><circle cx="18" cy="14" r="3" fill="#fff" opacity=".25"/><circle cx="50" cy="50" r="4" fill="#fff" opacity=".15"/>${inner}</svg>`;
}
const AVATARS = {
  fox:   face(['#ff8a3d','#ff5c4d'], `<path d="M12 10 L24 22 Q16 26 14 34 L8 16 Z" fill="#e84a3f"/><path d="M52 10 L40 22 Q48 26 50 34 L56 16 Z" fill="#e84a3f"/><circle cx="32" cy="36" r="18" fill="#ffd9c4"/><circle cx="25" cy="32" r="3" fill="#31225c"/><circle cx="39" cy="32" r="3" fill="#31225c"/><path d="M32 38 L29 43 L35 43 Z" fill="#e84a3f"/><ellipse cx="32" cy="46" rx="5" ry="3.6" fill="#fff"/><circle cx="32" cy="45" r="2.4" fill="#31225c"/>`),
  cat:   face(['#7c5cff','#5a8bff'], `<path d="M14 8 L22 20 L10 24 Z" fill="#3b2f8f"/><path d="M50 8 L42 20 L54 24 Z" fill="#3b2f8f"/><circle cx="32" cy="36" r="18" fill="#efeaff"/><circle cx="25" cy="32" r="3" fill="#31225c"/><circle cx="39" cy="32" r="3" fill="#31225c"/><path d="M29 43 Q32 46 35 43" stroke="#31225c" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 38 L20 40 M12 44 L20 43 M52 38 L44 40 M52 44 L44 43" stroke="#b9aaff" stroke-width="2" stroke-linecap="round"/>`),
  panda: face(['#3b4664','#22293f'], `<circle cx="32" cy="35" r="19" fill="#fff"/><circle cx="17" cy="20" r="7" fill="#22293f"/><circle cx="47" cy="20" r="7" fill="#22293f"/><ellipse cx="24" cy="33" rx="6" ry="7" fill="#22293f"/><ellipse cx="40" cy="33" rx="6" ry="7" fill="#22293f"/><circle cx="24" cy="33" r="2.6" fill="#fff"/><circle cx="40" cy="33" r="2.6" fill="#fff"/><ellipse cx="32" cy="45" rx="4" ry="3" fill="#22293f"/>`),
  robot: face(['#00c9bd','#3ba9ff'], `<rect x="14" y="18" width="36" height="30" rx="10" fill="#e8fbff"/><circle cx="32" cy="10" r="4" fill="#ffb020"/><line x1="32" y1="14" x2="32" y2="19" stroke="#ffb020" stroke-width="3"/><rect x="20" y="26" width="24" height="14" rx="7" fill="#132743"/><circle cx="27" cy="33" r="3.4" fill="#00e5ff"/><circle cx="37" cy="33" r="3.4" fill="#00e5ff"/><rect x="26" y="42" width="12" height="3" rx="1.5" fill="#7fd8e8"/>`),
  alien: face(['#22c55e','#0fb5a6'], `<ellipse cx="32" cy="34" rx="17" ry="20" fill="#d8ffe8"/><path d="M22 30 Q26 24 30 30 Q26 34 22 30Z" fill="#134d2c"/><path d="M42 30 Q38 24 34 30 Q38 34 42 30Z" fill="#134d2c"/><path d="M28 45 Q32 48 36 45" stroke="#134d2c" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="32" cy="16" r="3" fill="#ffd93d"/>`),
  ghost: face(['#8f6bff','#b48bff'], `<path d="M14 56 L14 30 A18 18 0 0 1 50 30 L50 56 L44 50 L38 56 L32 50 L26 56 L20 50 Z" fill="#f4f0ff"/><circle cx="25" cy="31" r="4" fill="#31225c"/><circle cx="39" cy="31" r="4" fill="#31225c"/><ellipse cx="32" cy="42" rx="4.5" ry="3.4" fill="#31225c"/>`),
  dragon:face(['#ef4467','#ff8a3d'], `<path d="M10 14 Q24 6 28 20 Q18 22 10 14Z" fill="#c22b47"/><circle cx="32" cy="36" r="18" fill="#ffd9c4"/><path d="M20 20 Q32 8 46 18 Q40 24 32 22 Q24 24 20 20Z" fill="#c22b47"/><circle cx="25" cy="33" r="3" fill="#31225c"/><circle cx="39" cy="33" r="3" fill="#31225c"/><path d="M28 44 L32 47 L36 44" stroke="#c22b47" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M14 40 L20 42 M14 46 L20 45 M50 40 L44 42 M50 46 L44 45" stroke="#ffb3a0" stroke-width="2" stroke-linecap="round"/>`),
  uni:   face(['#ff5c9d','#b48bff'], `<path d="M26 16 L30 4 L36 14 Z" fill="#ffd93d"/><circle cx="32" cy="36" r="18" fill="#fff"/><circle cx="25" cy="32" r="3" fill="#a2488a"/><circle cx="39" cy="32" r="3" fill="#a2488a"/><path d="M29 44 Q32 47 35 44" stroke="#a2488a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M14 26 Q20 20 26 22" stroke="#ff9ecb" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  owl:   face(['#ffb020','#ff8a3d'], `<circle cx="32" cy="36" r="19" fill="#fff3e0"/><circle cx="23" cy="30" r="8" fill="#fff"/><circle cx="41" cy="30" r="8" fill="#fff"/><circle cx="23" cy="30" r="3.6" fill="#5c3a00"/><circle cx="41" cy="30" r="3.6" fill="#5c3a00"/><path d="M32 36 L28 42 L36 42 Z" fill="#ff8a3d"/><path d="M20 46 Q32 54 44 46" stroke="#e8a04d" stroke-width="2" fill="none"/>`),
  tig:   face(['#ffd93d','#ff9d3d'], `<circle cx="32" cy="36" r="18" fill="#ffce7a"/><path d="M14 14 L22 24 L10 26 Z" fill="#e8912d"/><path d="M50 14 L42 24 L54 26 Z" fill="#e8912d"/><path d="M22 26 Q26 30 22 34 M28 24 Q30 29 26 33 M42 26 Q38 30 42 34 M36 24 Q34 29 38 33" stroke="#3d2b12" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="25" cy="35" r="2.8" fill="#31225c"/><circle cx="39" cy="35" r="2.8" fill="#31225c"/><ellipse cx="32" cy="44" rx="4.6" ry="3.4" fill="#fff"/><circle cx="32" cy="43.4" r="2.2" fill="#31225c"/>`),
  peng:  face(['#3ba9ff','#2b6cff'], `<ellipse cx="32" cy="36" rx="17" ry="19" fill="#1d2b53"/><ellipse cx="32" cy="41" rx="11" ry="12" fill="#fff"/><circle cx="26" cy="31" r="3" fill="#fff"/><circle cx="38" cy="31" r="3" fill="#fff"/><circle cx="26" cy="31.6" r="1.6" fill="#1d2b53"/><circle cx="38" cy="31.6" r="1.6" fill="#1d2b53"/><path d="M29 37 L35 37 L32 42 Z" fill="#ff9d3d"/>`),
  wiz:   face(['#5a8bff','#7c5cff'], `<circle cx="32" cy="38" r="15" fill="#ffe3cf"/><path d="M12 26 L32 2 L52 26 Z" fill="#3b2f8f"/><path d="M12 26 L52 26 L50 30 L14 30 Z" fill="#5a48c9"/><path d="M52 4 L54 10 L60 12 L54 14 L52 20 L50 14 L44 12 L50 10 Z" fill="#ffd93d"/><circle cx="26" cy="40" r="2.8" fill="#31225c"/><circle cx="38" cy="40" r="2.8" fill="#31225c"/><path d="M28 48 Q32 51 36 48" stroke="#31225c" stroke-width="2.2" fill="none" stroke-linecap="round"/>`),
};
const AV_IDS = Object.keys(AVATARS);
const AV_COST = { fox:0, cat:0, panda:0, ghost:0, alien:60, robot:60, owl:80, tig:100, uni:120, dragon:150, peng:80, wiz:200 };

/* ---------- Game thumbnails (rich scenes) ---------- */
function thumbSvg(id){
  const defs = `<defs>
    <linearGradient id="th-bg-${id}" x1="0" y1="0" x2="1" y2="1">${gr(id)}</linearGradient>
    <radialGradient id="th-sh-${id}" cx=".5" cy=".35" r="1"><stop offset="0" stop-color="rgba(255,255,255,.35)"/><stop offset=".7" stop-color="rgba(255,255,255,0)"/></radialGradient>
  </defs>`;
  const deco = `<circle cx="20" cy="20" r="34" fill="rgba(255,255,255,.09)"/><circle cx="228" cy="150" r="46" fill="rgba(255,255,255,.08)"/><circle cx="205" cy="24" r="3" fill="#fff" opacity=".6"/><circle cx="30" cy="120" r="2.4" fill="#fff" opacity=".5"/><circle cx="120" cy="12" r="2" fill="#fff" opacity=".5"/>`;
  const art = {
    tictactoe: `<g transform="translate(66 18)" filter="">
      <rect x="0" y="0" width="124" height="124" rx="20" fill="rgba(255,255,255,.92)"/>
      <g stroke="#7c5cff" stroke-width="7" stroke-linecap="round"><line x1="42" y1="16" x2="42" y2="108"/><line x1="83" y1="16" x2="83" y2="108"/><line x1="17" y1="42" x2="108" y2="42"/><line x1="17" y1="83" x2="108" y2="83"/></g>
      <g stroke="#ff5c9d" stroke-width="9" stroke-linecap="round"><line x1="26" y1="24" x2="58" y2="56"/><line x1="58" y1="24" x2="26" y2="56"/></g>
      <circle cx="92" cy="41" r="14" fill="none" stroke="#00c9bd" stroke-width="9"/>
      <circle cx="92" cy="100" r="14" fill="none" stroke="#00c9bd" stroke-width="9"/>
      <g stroke="#ff5c9d" stroke-width="9" stroke-linecap="round"><line x1="26" y1="66" x2="58" y2="98"/><line x1="58" y1="66" x2="26" y2="98"/></g>
      </g>`,
    rps: `<g transform="translate(40 30)">
      <circle cx="30" cy="62" r="30" fill="#fff" opacity=".95"/><text x="30" y="76" font-size="42" text-anchor="middle">✊</text>
      <circle cx="90" cy="40" r="30" fill="#fff" opacity=".95"/><text x="90" y="54" font-size="42" text-anchor="middle">✋</text>
      <circle cx="150" cy="72" r="30" fill="#fff" opacity=".95"/><text x="150" y="86" font-size="42" text-anchor="middle">✌️</text>
      <path d="M56 30 Q60 22 66 28" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/></g>`,
    memory: `<g transform="translate(56 24)">
      <g transform="rotate(-12 30 45)"><rect width="56" height="76" rx="11" fill="#fff"/><text x="28" y="52" font-size="36" text-anchor="middle">🦊</text></g>
      <g transform="translate(36 -6)"><rect width="56" height="76" rx="11" fill="#7c5cff"/><path d="M28 22 L44 38 L28 54 L12 38 Z" fill="#fff" opacity=".9"/></g>
      <g transform="translate(72 -6) rotate(8)"><rect width="56" height="76" rx="11" fill="#fff"/><text x="28" y="52" font-size="36" text-anchor="middle">🐼</text></g>
      <g transform="translate(108 -2) rotate(-6)"><rect width="56" height="76" rx="11" fill="#00c9bd"/><path d="M28 22 L44 38 L28 54 L12 38 Z" fill="#fff" opacity=".9"/></g></g>`,
    quiz: `<g transform="translate(60 22)">
      <circle cx="60" cy="64" r="52" fill="#fff" opacity=".95"/>
      <text x="60" y="88" font-size="76" font-weight="900" text-anchor="middle" fill="#7c5cff" font-family="sans-serif">?</text>
      <circle cx="14" cy="14" r="10" fill="#ffb020"/><text x="14" y="19" font-size="13" font-weight="900" text-anchor="middle" fill="#fff">A</text>
      <circle cx="106" cy="14" r="10" fill="#00c9bd"/><text x="106" y="19" font-size="13" font-weight="900" text-anchor="middle" fill="#fff">B</text>
      <circle cx="14" cy="112" r="10" fill="#ff5c9d"/><text x="14" y="117" font-size="13" font-weight="900" text-anchor="middle" fill="#fff">C</text>
      <circle cx="106" cy="112" r="10" fill="#3ba9ff"/><text x="106" y="117" font-size="13" font-weight="900" text-anchor="middle" fill="#fff">D</text></g>`,
    reaction: `<g transform="translate(64 18)">
      <path d="M70 0 L34 66 L58 66 L46 124 L96 50 L68 50 L88 0 Z" fill="#ffd93d" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      <g stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"><line x1="8" y1="30" x2="20" y2="30"/><line x1="12" y1="48" x2="22" y2="44"/><line x1="120" y1="30" x2="108" y2="30"/><line x1="116" y1="48" x2="106" y2="44"/></g></g>`,
    connect4: `<g transform="translate(48 26)">
      <rect width="128" height="108" rx="16" fill="#fff" opacity=".95"/>
      <g fill="#efeaff">${[0,1,2,3,4,5,6].map(c=>[0,1,2].map(r=>`<circle cx="${18+c*16}" cy="${18+r*34}" r="9"/>`).join('')).join('')}</g>
      <circle cx="18" cy="52" r="11" fill="#ffb020"/><circle cx="34" cy="52" r="11" fill="#ff5c9d"/><circle cx="50" cy="52" r="11" fill="#ffb020"/><circle cx="66" cy="52" r="11" fill="#ffb020"/>
      <circle cx="50" cy="86" r="11" fill="#ff5c9d"/><circle cx="66" cy="86" r="11" fill="#ff5c9d"/>
      <circle cx="34" cy="18" r="11" fill="#ff5c9d"/><circle cx="50" cy="18" r="11" fill="#ffb020"/></g>`,
    word: `<g transform="translate(40 34)">
      ${[0,1,2,3,4].map(i=>`<rect x="${i*30}" y="20" width="26" height="26" rx="7" fill="#fff" transform="rotate(${i%2? 4:-4} ${15+i*30} 33)"/>`).join('')}
      <text x="43" y="40" font-size="17" font-weight="900" text-anchor="middle" fill="#7c5cff">م</text>
      <text x="73" y="41" font-size="17" font-weight="900" text-anchor="middle" fill="#00c9bd">‌ب</text>
      <text x="103" y="39" font-size="17" font-weight="900" text-anchor="middle" fill="#ff5c9d">ا</text>
      <rect x="30" y="66" width="26" height="26" rx="7" fill="#22c55e"/><rect x="60" y="64" width="26" height="26" rx="7" fill="#ffb020"/><rect x="90" y="66" width="26" height="26" rx="7" fill="#3d2b63" opacity=".4"/>
      <circle cx="170" cy="30" r="16" fill="#fff" opacity=".9"/><text x="170" y="37" font-size="19" font-weight="900" text-anchor="middle" fill="#7c5cff">؟</text></g>`,
  };
  function gr(id){
    const maps = {
      tictactoe:'<stop offset="0" stop-color="#8f6bff"/><stop offset="1" stop-color="#5a3df0"/>',
      rps:'<stop offset="0" stop-color="#ff5c9d"/><stop offset="1" stop-color="#ff8a3d"/>',
      memory:'<stop offset="0" stop-color="#00c9bd"/><stop offset="1" stop-color="#3ba9ff"/>',
      quiz:'<stop offset="0" stop-color="#ffb020"/><stop offset="1" stop-color="#ff5c9d"/>',
      reaction:'<stop offset="0" stop-color="#6d4dff"/><stop offset="1" stop-color="#00b8ac"/>',
      connect4:'<stop offset="0" stop-color="#3ba9ff"/><stop offset="1" stop-color="#7c5cff"/>',
      word:'<stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#0e9f8a"/>',
    };
    return maps[id]||maps.tictactoe;
  }
  return `<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${defs}<rect width="240" height="150" fill="url(#th-bg-${id})"/><rect width="240" height="150" fill="url(#th-sh-${id})"/>${deco}${art[id]||''}</svg>`;
}

/* ---------- Icon set (stroke, currentColor) ---------- */
const PATHS = {
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5h4v5"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" stroke="none"/>',
  users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M3.5 19.5c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.6c2.2.3 3.6 1.7 4 4.4"/>',
  trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 14v3M8.5 20h7M10 17h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  gift:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M12 10v10M4 13h16M12 10s-4.5.2-5.5-2C5.8 6.4 7.5 4.6 9 5.5c1.8 1 3 4.5 3 4.5s1.2-3.5 3-4.5c1.5-.9 3.2.9 2.5 2.5-1 2.2-5.5 2-5.5 2z"/>',
  bell:'<path d="M6 9.5a6 6 0 0 1 12 0c0 5 1.6 6 1.6 6H4.4S6 14.5 6 9.5"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.9 1.9M16.1 16.1 18 18M18 6l-1.9 1.9M7.9 16.1 6 18"/>',
  shield:'<path d="M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  play:'<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 14.5A2.5 2.5 0 0 1 4 12V6a2 2 0 0 1 2-2h6a2.5 2.5 0 0 1 2.5 1.5"/>',
  share:'<circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.8 10.8 6.4-3.6M8.8 13.2l6.4 3.6"/>',
  vol:'<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  volOff:'<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  star:'<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.5 3.8 4.5 7 4.5c2 0 3.8 1 5 3 1.2-2 3-3 5-3 3.2 0 5.5 3 4.3 6.2C19.5 15.4 12 20 12 20z" fill="currentColor" stroke="none"/>',
  coin:'<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" opacity=".25"/><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M9.5 9.8c0-1 5-1 5 .2 0 2.6-5 1.4-5 4 0 1.2 5 1.2 5 .2"/>',
  bolt:'<path d="M13 3 5 13.5h5L10.5 21 19 10h-5.5z" fill="currentColor" stroke="none"/>',
  crown:'<path d="m4 8 4 3 4-6 4 6 4-3-1.5 10h-13z"/><path d="M6.5 21h11"/>',
  chat:'<path d="M20 11.5c0 4-3.6 7-8 7-1 0-2-.2-2.9-.5L4.5 19.5l1.2-3.4A6.6 6.6 0 0 1 4 11.5c0-4 3.6-7 8-7s8 3 8 7z"/>',
  send:'<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-7-3z" fill="currentColor" stroke="none" stroke-linejoin="round"/>',
  back:'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  next:'<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  refresh:'<path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5"/>',
  logout:'<path d="M14 4h4.5v16H14M9.5 8.5 6 12l3.5 3.5M6 12h9"/>',
  moon:'<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5z"/>',
  wifi:'<path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.5a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
  wifiOff:'<path d="M4 9.5a12 12 0 0 1 8-3.4M16.5 7.7a12 12 0 0 1 3.5 1.8M7 13a8 8 0 0 1 4.5-2.2M14 11.2A8 8 0 0 1 17 13M10 16.5a4 4 0 0 1 2.5-.8M12 19h.01M4 4l16 16"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  fire:'<path d="M12 21c-3.9 0-6.5-2.5-6.5-6 0-2.5 1.5-4.4 2.8-6C9.5 7.5 10.5 6 10.5 4c3 1.5 3.5 4 3.2 5.5 1-.4 1.8-1.3 2-2.5C17.5 8.5 18.5 11 18.5 15c0 3.5-2.6 6-6.5 6z"/>',
  lock:'<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2"/>',
  edit:'<path d="M14.5 5.5 18.5 9.5 8.5 19.5H4.5v-4z"/><path d="m12.5 7.5 4 4"/>',
  trash:'<path d="M5.5 7h13M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6"/>',
  down:'<path d="m6 9.5 6 6 6-6"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  medal:'<circle cx="12" cy="14" r="5.5"/><path d="m8.5 9.5-3-6h4l2.5 4 2.5-4h4l-3 6"/>',
  swords:'<path d="m4.5 4.5 9 9M14.5 4.5l-9 9M14 14l3 3 2.5-2.5-3-3M10 14l-3 3-2.5-2.5 3-3"/>',
  dice:'<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/>',
  puzzle:'<path d="M9 4.5h6V7a2 2 0 1 0 4 0V4.5H21.5v6H19a2 2 0 1 0 0 4h2.5v6H15.5V19a2 2 0 1 0-4 0v2.5H4.5v-6H7a2 2 0 1 0 0-4H4.5v-6H9z" transform="scale(.88) translate(1.6 1.6)"/>',
  brain:'<path d="M9.5 4.5a3 3 0 0 0-3 3 3.2 3.2 0 0 0-2.5 3.1c0 .9.4 1.7 1 2.3a3.3 3.3 0 0 0 1.5 5.6A3 3 0 0 0 9.5 21c1.4 0 2.5-1.1 2.5-2.5v-11a3 3 0 0 0-2.5-3z"/><path d="M14.5 4.5a3 3 0 0 1 3 3 3.2 3.2 0 0 1 2.5 3.1c0 .9-.4 1.7-1 2.3a3.3 3.3 0 0 1-1.5 5.6A3 3 0 0 1 14.5 21c-1.4 0-2.5-1.1-2.5-2.5v-11a3 3 0 0 1 2.5-3z"/>',
  zap:'<path d="M13 3 5 13.5h5L10.5 21 19 10h-5.5z"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  key:'<circle cx="8" cy="14.5" r="4"/><path d="m11 11.5 8.5-8.5M17 5.5l2.5 2.5M14.5 8l2.5 2.5"/>',
  dpad:'<rect x="4" y="9" width="16" height="6.5" rx="3.2"/><path d="M8.5 9v6.5M15.5 9v6.5M4 12h16"/>',
  flag:'<path d="M6 21V4M6 5c4-2.5 8 2.5 12 0v9c-4 2.5-8-2.5-12 0"/>',
  info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.4"/>',
  calendar:'<rect x="4" y="6" width="16" height="14.5" rx="2.5"/><path d="M4 10.5h16M8.5 4v4M15.5 4v4"/>',
};
function icon(name, size=22, sw=1.9){
  const p = PATHS[name]||PATHS.star;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/* medal/tier icon */
function tierIcon(tierKey, size=30){
  const colors = {bronze:['#d9884a','#b4652f'], silver:['#9aa5b8','#64748b'], gold:['#ffb020','#ff8a3d'], plat:['#7dd3fc','#3ba9ff'], diamond:['#67e8f9','#22d3ee'], master:['#c4b5fd','#7c5cff']};
  const c = tierKey.includes('bronze')?colors.bronze : tierKey.includes('silver')?colors.silver : tierKey.includes('gold')?colors.gold : tierKey==='tier.plat'?colors.plat : tierKey==='tier.diamond'?colors.diamond : colors.master;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><defs><linearGradient id="ti-${tierKey}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><path d="m4 8 4 3 4-6 4 6 4-3-1.5 10h-13z" fill="url(#ti-${tierKey})"/><path d="M6.5 21h11" stroke="url(#ti-${tierKey})" stroke-width="2" stroke-linecap="round"/></svg>`;
}

PV.visuals = { logo:LOGO, avatar:(id)=>AVATARS[id]||AVATARS.fox, avatars:AV_IDS, avCost:AV_COST, thumb:thumbSvg, icon, tierIcon };
})();
