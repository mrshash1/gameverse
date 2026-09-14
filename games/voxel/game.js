/* ============ Game: مکعب‌کره (Minecraft-lite, raw WebGL) ============
   • ZERO dependencies (no three.js / no CDN) — works offline & on GitHub Pages
   • Procedural island: value-noise terrain, water, sand, trees
   • Mine / place 9 block types, day sky + fog, fly mode
   • Desktop: pointer-lock + WASD; Mobile: joystick + look-drag + buttons
   • World auto-saves (seed + edit diffs) to localStorage
===================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const WX = 64, WZ = 64, WY = 48, CH = 16;           /* world + chunk size  */
const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, WOOD=5, LEAF=6, WATER=7, BRICK=8, GLASS=9, LAMP=10;
const HOT = [GRASS, DIRT, STONE, SAND, WOOD, LEAF, BRICK, GLASS, LAMP];
const NAMES = {}; NAMES[GRASS]=t('vx.grass'); NAMES[DIRT]=t('vx.dirt'); NAMES[STONE]=t('vx.stone');
NAMES[SAND]=t('vx.sand'); NAMES[WOOD]=t('vx.wood'); NAMES[LEAF]=t('vx.leaves');
NAMES[BRICK]=t('vx.brick'); NAMES[GLASS]=t('vx.glass'); NAMES[LAMP]=t('vx.lamp');
const WATER_LVL = 10;
const idx = (x,y,z)=> (y*WZ+z)*WX+x;
const inW = (x,y,z)=> x>=0 && x<WX && y>=0 && y<WY && z>=0 && z<WZ;

/* --------------------------- noise + worldgen ---------------------------- */
function mulberry(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function makeNoise(seed){
  const r = mulberry(seed);
  const perm = new Uint8Array(512);
  for(let i=0;i<256;i++) perm[i]=i;
  for(let i=255;i>0;i--){ const j=(r()*(i+1))|0; const tmp=perm[i]; perm[i]=perm[j]; perm[j]=tmp; }
  for(let i=0;i<256;i++) perm[256+i]=perm[i];
  const h = (x,y)=> perm[(perm[x&255]+y)&255]/255;
  function smooth(a,b,f){ f=f*f*(3-2*f); return a+(b-a)*f; }
  function n2(x,y){
    const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
    const a=h(xi,yi), b=h(xi+1,yi), c=h(xi,yi+1), d=h(xi+1,yi+1);
    return smooth(smooth(a,b,xf), smooth(c,d,xf), yf);
  }
  return (x,y)=> n2(x,y)*.65 + n2(x*2.7+31, y*2.7+17)*.35;
}
function genWorld(seed, edits){
  const noise = makeNoise(seed), rng = mulberry(seed^0x9e3779b9);
  const w = new Uint8Array(WX*WY*WZ);
  const H = new Int16Array(WX*WZ);
  for(let x=0;x<WX;x++) for(let z=0;z<WZ;z++){
    const e = noise(x*0.045, z*0.045);
    let h = Math.floor(7 + e*16 + noise(x*0.13+9, z*0.13+4)*7);
    h = U.clamp(h, 4, WY-14);
    H[x*WZ+z]=h;
    for(let y=0;y<=h;y++){
      let b = STONE;
      if(y===h) b = (h<=WATER_LVL+1)? SAND : GRASS;
      else if(y>=h-2) b = (h<=WATER_LVL+1)? SAND : DIRT;
      w[idx(x,y,z)]=b;
    }
    for(let y=h+1;y<=WATER_LVL;y++) w[idx(x,y,z)]=WATER;
  }
  /* trees */
  const nT = 26;
  for(let k=0;k<nT;k++){
    const x = 3+Math.floor(rng()*(WX-6)), z = 3+Math.floor(rng()*(WZ-6));
    const h = H[x*WZ+z];
    if(h<=WATER_LVL+1 || w[idx(x,h,z)]!==GRASS) continue;
    const th = 4+Math.floor(rng()*2);
    for(let y=1;y<=th;y++) if(h+y<WY) w[idx(x,h+y,z)]=WOOD;
    for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) for(let dy=0;dy<=2;dy++){
      const yy=h+th+dy-1;
      if(Math.abs(dx)+Math.abs(dz)+dy > 4-(dy===0?1:0)) continue;
      if(inW(x+dx,yy,z+dz) && w[idx(x+dx,yy,z+dz)]===AIR) w[idx(x+dx,yy,z+dz)]=LEAF;
    }
  }
  /* apply saved edits */
  if(edits) for(const [k,id] of edits){
    const [x,y,z] = k.split(',').map(Number);
    if(inW(x,y,z)) w[idx(x,y,z)]=id;
  }
  return {w, H};
}

/* ------------------------------ atlas ------------------------------------ */
function makeAtlas(){
  const TS=16, COLS=4, cv=document.createElement('canvas');
  cv.width=TS*COLS; cv.height=TS*COLS;
  const c = cv.getContext('2d');
  const rnd = mulberry(1234);
  const px = (tx,ty,x,y,col)=>{ c.fillStyle=col; c.fillRect(tx*TS+x, ty*TS+y, 1,1); };
  function tile(tx,ty,base,fn){ for(let y=0;y<TS;y++) for(let x=0;x<TS;x++){ let col=base; const r=rnd(); col=fn? fn(x,y,r,col):col; if(col) px(tx,ty,x,y,col); } }
  const shade = (hex, f)=>{ const n=parseInt(hex.slice(1),16); const r=Math.min(255,(n>>16)*f|0), g=Math.min(255,((n>>8)&255)*f|0), b=Math.min(255,(n&255)*f|0); return `rgb(${r},${g},${b})`; };
  tile(0,0,'#58b13a',(x,y,r)=> r<.12? '#4a9e2f' : r>.9? '#6ec44c' : '#58b13a');           /* 0 grass top */
  tile(1,0,'#7a5636',(x,y,r)=> y<3? (r<.5? '#58b13a':'#4a9e2f') : (r<.15?'#65452b':'#7a5636')); /* 1 grass side */
  tile(2,0,'#7a5636',(x,y,r)=> r<.14? '#65452b' : r>.88? '#8a6440':'#7a5636');            /* 2 dirt */
  tile(3,0,'#8b8f96',(x,y,r)=> r<.18? '#7d8188' : r>.85? '#9aa0a8':'#8b8f96');            /* 3 stone */
  tile(0,1,'#e7d8a8',(x,y,r)=> r<.2? '#dcc795' : r>.86? '#f2e6bc':'#e7d8a8');             /* 4 sand */
  tile(1,1,'#6e4f2e',(x,y,r)=> (x%5===0||x%5===4)? '#5c4325':'#6e4f2e');                  /* 5 wood side */
  tile(2,1,'#a5835a',(x,y,r)=> (Math.abs(x-8)<5&&Math.abs(y-8)<5)? '#8a6c44':'#a5835a');  /* 6 wood top */
  tile(3,1,'#3f9e34',(x,y,r)=>{ if(r<.3) return null; return r<.55? '#4cb03f' : '#358c2c'; }); /* 7 leaves (holes) */
  tile(0,2,'#2f7fd0',(x,y,r)=> r<.2? '#2a70b8' : r>.8? '#3f8fdd':'#2f7fd0');              /* 8 water */
  tile(1,2,'#b5442f',(x,y,r)=>{ const row=y%8, cc=x%8; if(row<2||row===7) return '#9c3a28'; if(cc<1) return '#9c3a28'; return (x+y)%2? '#b5442f':'#a83e2b'; }); /* 9 brick */
  tile(2,2,'#ffd45c',(x,y,r)=> r<.15? '#ffc93d' : r>.85? '#ffe38a':'#ffd45c');            /* 10 lamp */
  tile(3,2,null,(x,y,r)=>{ const edge = x===0||y===0||x===15||y===15; return edge? 'rgba(210,235,245,.9)' : 'rgba(190,225,240,.16)'; }); /* 11 glass */
  return cv;
}

/* --------------------------- face tables ---------------------------------- */
/* [dx,dy,dz, corners(4×3), shade] — corner order → uv (0,0)(0,1)(1,1)(1,0) */
const FACES = [
  {d:[1,0,0],  c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]], s:.72},  /* +X */
  {d:[-1,0,0], c:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]], s:.72},  /* -X */
  {d:[0,1,0],  c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]], s:1.0},  /* +Y */
  {d:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], s:.52},  /* -Y */
  {d:[0,0,1],  c:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]], s:.84},  /* +Z */
  {d:[0,0,-1], c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]], s:.84},  /* -Z */
];
/* block → atlas tile per face: [top, bottom, side] */
const TILES = {
  [GRASS]:[0,2,1], [DIRT]:[2,2,2], [STONE]:[3,3,3], [SAND]:[4,4,4],
  [WOOD]:[6,6,5], [LEAF]:[7,7,7], [WATER]:[8,8,8], [BRICK]:[9,9,9],
  [GLASS]:[11,11,11], [LAMP]:[10,10,10],
};
const OPAQUE = b => b!==AIR && b!==LEAF && b!==WATER && b!==GLASS;
const SOLID  = b => b!==AIR && b!==WATER;      /* physics */

/* -------------------------------- module --------------------------------- */
PV.registry.register({
  id:'voxel', cats:['sandbox','strategy','family'], players:[1,1], modes:['solo'],
  weight:78, dynamicScore:true,
  factory: function(ctx){
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="vxb" dir="ltr">
        <div class="vx-wrap">
          <canvas id="vxCv"></canvas>
          <div class="vx-cross" id="vxCross"></div>
          <div class="vx-locked center" id="vxLock">
            <div class="vx-lock-card">
              <b>⛏ ${t('g.voxel')}</b>
              <p class="small muted">${t('vx.locked')}</p>
              <button class="btn" id="vxLockGo">▶ ${t('c.start')}</button>
              <button class="btn ghost" id="vxFinish">${t('vx.done')}</button>
            </div>
          </div>
        </div>
        <div class="vx-bar">
          <div class="vx-hot" id="vxHot"></div>
          <div class="row" style="gap:8px">
            <span class="tiny muted num" id="vxPos"></span>
            <span class="spacer"></span>
            <button class="btn sm ghost vx-tbtn" id="vxJump">⤒ ${t('vx.jump')}</button>
            <button class="btn sm ghost vx-tbtn" id="vxFly">🕊 ${t('vx.fly')}</button>
            <button class="btn sm warn vx-tbtn" id="vxMine">⛏ ${t('vx.mine')}</button>
            <button class="btn sm cyan vx-tbtn" id="vxPlace">🧱 ${t('vx.put')}</button>
          </div>
        </div>
      </div>`;
    ctx.root.appendChild(root);
    const cv = root.querySelector('#vxCv');
    const gl = cv.getContext('webgl', {antialias:false, alpha:false}) || cv.getContext('experimental-webgl');
    if(!gl){
      root.querySelector('.vx-wrap').innerHTML = `<div class="empty" style="padding:60px 20px"><p>WebGL در دسترس نیست 😢</p></div>`;
      return {init(){},start(){},destroy(){ root.remove(); }};   /* honest fallback */
    }

    /* ------------------------- save / load ------------------------- */
    const SAVE_KEY = 'pv:voxel:world';
    let saved = U.LS.get(SAVE_KEY, null);
    const seed = saved?.seed || (1+Math.floor(Math.random()*2**30));
    const edits = new Map(saved?.edits || []);
    let placed = 0, mined = 0;
    function save(){
      U.LS.set(SAVE_KEY, {seed, edits:[...edits], ts:Date.now()});
    }
    const saveSoon = U.debounce(save, 1500);

    const {w} = genWorld(seed, edits);

    /* --------------------------- shaders --------------------------- */
    const VS = `
    attribute vec3 aPos; attribute vec2 aUV; attribute float aShade; attribute float aAlpha;
    uniform mat4 uMVP; uniform vec3 uEye;
    varying vec2 vUV; varying float vShade; varying float vAlpha; varying float vDist;
    void main(){
      vUV=aUV; vShade=aShade; vAlpha=aAlpha;
      vDist = distance(aPos, uEye);
      gl_Position = uMVP * vec4(aPos, 1.0);
    }`;
    const FS = `
    precision mediump float;
    varying vec2 vUV; varying float vShade; varying float vAlpha; varying float vDist;
    uniform sampler2D uTex; uniform float uMode; uniform vec3 uFog;
    void main(){
      vec4 c = texture2D(uTex, vUV);
      float fog = smoothstep(26.0, 62.0, vDist);
      vec3 col = mix(c.rgb * vShade, uFog, fog);
      if(uMode < 0.5){
        if(c.a < 0.5) discard;
        gl_FragColor = vec4(col, 1.0);
      } else {
        gl_FragColor = vec4(col, c.a * vAlpha);
      }
    }`;
    function sh(type, src){
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); }
    gl.useProgram(prog);
    const loc = {
      aPos: gl.getAttribLocation(prog,'aPos'), aUV: gl.getAttribLocation(prog,'aUV'),
      aShade: gl.getAttribLocation(prog,'aShade'), aAlpha: gl.getAttribLocation(prog,'aAlpha'),
      uMVP: gl.getUniformLocation(prog,'uMVP'), uEye: gl.getUniformLocation(prog,'uEye'),
      uTex: gl.getUniformLocation(prog,'uTex'), uMode: gl.getUniformLocation(prog,'uMode'),
      uFog: gl.getUniformLocation(prog,'uFog'),
    };
    /* atlas texture */
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   /* canvas top = v=1 (matches tileUV) */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.53, 0.78, 0.94, 1);

    /* ---------------------------- meshing ---------------------------- */
    const chunks = [];      /* {solid:{buf,n}, blend:{buf,n}} for 4×4 chunks */
    const NCX = WX/CH, NCZ = WZ/CH;
    function tileUV(tileIdx, u, v){
      const tx = (tileIdx % 4), ty = Math.floor(tileIdx/4);
      const pad = 0.6/64;                        /* anti-bleed inset */
      return [ (tx + (u? 1-pad : pad))/4, 1 - (ty + (v? 1-pad : pad))/4 ];
    }
    function pushFace(arr, x, y, z, f, tileIdx, alpha, shadeBoost){
      const uvq = [[0,0],[0,1],[1,1],[1,0]];
      const quad = [0,1,2, 0,2,3];
      for(const i of quad){
        const cc = f.c[i];
        const [u,v] = tileUV(tileIdx, uvq[i][0], uvq[i][1]);
        arr.push(x+cc[0], y+cc[1], z+cc[2], u, v, f.s*(shadeBoost||1), alpha);
      }
    }
    function blockFaceTile(b, f){
      const t = TILES[b];
      if(f.d[1]===1) return t[0];
      if(f.d[1]===-1) return t[1];
      return t[2];
    }
    function buildChunk(ci, cj){
      const solid = [], blend = [];
      for(let x=ci*CH; x<(ci+1)*CH; x++)
      for(let z=cj*CH; z<(cj+1)*CH; z++)
      for(let y=0; y<WY; y++){
        const b = w[idx(x,y,z)];
        if(b===AIR) continue;
        const isWater = b===WATER, isGlass = b===GLASS, isLeaf = b===LEAF, isLamp = b===LAMP;
        for(const f of FACES){
          const nx=x+f.d[0], ny=y+f.d[1], nz=z+f.d[2];
          const nb = inW(nx,ny,nz)? w[idx(nx,ny,nz)] : AIR;
          let draw = false, alpha = 1, target = solid;
          if(isWater){ draw = (nb===AIR || nb===GLASS); alpha=.62; target=blend; }
          else if(isGlass){ draw = (nb===AIR || nb===WATER || nb===LEAF); alpha=.5; target=blend; }
          else { draw = !OPAQUE(nb) || (isLeaf && nb===LEAF && false); if(nb===GLASS||nb===WATER||nb===LEAF||nb===AIR) draw=true; }
          if(!draw) continue;
          const boost = isLamp? 1.35 : 1;
          pushFace(target, x, y, z, f, blockFaceTile(b, f), alpha, boost);
        }
      }
      return {
        solid: upload(solid), blend: upload(blend),
      };
    }
    function upload(arr){
      if(!arr.length) return {buf:null, n:0};
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return {buf, n: arr.length/7};
    }
    for(let i=0;i<NCX;i++){ chunks[i]=[]; for(let j=0;j<NCZ;j++) chunks[i][j] = buildChunk(i,j); }
    function rebuildAt(x, z){
      const ci = Math.floor(x/CH), cj = Math.floor(z/CH);
      const jobs = [[ci,cj]];
      if(x%CH===0 && ci>0) jobs.push([ci-1,cj]);
      if(x%CH===CH-1 && ci<NCX-1) jobs.push([ci+1,cj]);
      if(z%CH===0 && cj>0) jobs.push([ci,cj-1]);
      if(z%CH===CH-1 && cj<NCZ-1) jobs.push([ci,cj+1]);
      for(const [a,b] of jobs) chunks[a][b] = buildChunk(a,b);
    }

    /* --------------------------- math helpers --------------------------- */
    function mat4(){ return new Float32Array(16); }
    function persp(out, fovy, asp, near, far){
      const f = 1/Math.tan(fovy/2);
      out.fill(0);
      out[0]=f/asp; out[5]=f; out[10]=(far+near)/(near-far); out[11]=-1; out[14]=2*far*near/(near-far);
      return out;
    }
    function viewMat(out, eye, yaw, pitch){
      const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
      /* right, up, forward */
      const rx=cy, ry=0, rz=-sy;
      const ux=sy*sp, uy=cp, uz=cy*sp;
      const fx=sy*cp, fy=-sp, fz=-cy*cp;   /* look direction */
      out[0]=rx; out[4]=ry; out[8]=rz;
      out[1]=ux; out[5]=uy; out[9]=uz;
      out[2]=fx; out[6]=fy; out[10]=fz;
      out[3]=0; out[7]=0; out[11]=0;
      out[12]=-(rx*eye[0]+ry*eye[1]+rz*eye[2]);
      out[13]=-(ux*eye[0]+uy*eye[1]+uz*eye[2]);
      out[14]=-(fx*eye[0]+fy*eye[1]+fz*eye[2]);
      out[15]=1;
      return out;
    }
    function mul(out, a, b){
      /* out = a × b  (column-major) */
      const o = mat4();
      for(let c=0;c<4;c++) for(let r=0;r<4;r++){
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
      }
      out.set(o); return out;
    }

    /* ---------------------------- player ---------------------------- */
    /* find a flat, dry spawn plateau near the center (nice first view) */
    const heightAt = (x,z)=>{ for(let y=WY-1;y>=0;y--){ const b=w[idx(x,y,z)]; if(b!==AIR && b!==WATER) return y; } return 0; };
    let spawnX = WX/2+.5, spawnZ = WZ/2+.5, groundH = heightAt(WX/2, WZ/2);
    (function findSpawn(){
      const cx=WX/2, cz=WZ/2;
      let best = null;
      for(let rad=2; rad<24 && !best; rad++){
        for(let dx=-rad; dx<=rad && !best; dx++) for(let dz=-rad; dz<=rad && !best; dz++){
          const x=cx+dx, z=cz+dz;
          if(x<2||z<2||x>=WX-2||z>=WZ-2) continue;
          const h = heightAt(x,z);
          if(h <= WATER_LVL+1) continue;
          let flat = true;
          for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
            if(Math.abs(heightAt(x+ox,z+oz) - h) > 1){ flat=false; break; }
          }
          if(flat) best = {x, z, h};
        }
      }
      if(best){ spawnX = best.x+.5; spawnZ = best.z+.5; groundH = best.h; }
    })();
    const P = {
      x: spawnX, y: groundH+2.2, z: spawnZ,
      vx:0, vy:0, vz:0, yaw: -2.35, pitch: .5,
      onGround:false, fly:false, sel:0,
    };
    const keys = {};
    let placed0 = placed, mined0 = mined;

    /* ------------------------- raycast (DDA) ------------------------- */
    function raycast(maxD=6){
      const cy=Math.cos(P.yaw), sy=Math.sin(P.yaw), cp=Math.cos(P.pitch), sp=Math.sin(P.pitch);
      const dx=sy*cp, dy=-sp, dz=-cy*cp;
      let x=Math.floor(P.x), y=Math.floor(P.y+1.62), z=Math.floor(P.z);
      const stepX=dx>0?1:-1, stepY=dy>0?1:-1, stepZ=dz>0?1:-1;
      const tdx=Math.abs(1/dx), tdy=Math.abs(1/dy), tdz=Math.abs(1/dz);
      let tmx = tdx*(dx>0? (x+1-P.x) : (P.x-x));
      let tmy = tdy*(dy>0? (y+1-(P.y+1.62)) : ((P.y+1.62)-y));
      let tmz = tdz*(dz>0? (z+1-P.z) : (P.z-z));
      let face = [0,0,0], t=0;
      for(let i=0;i<128;i++){
        if(!inW(x,y,z)) return null;
        const b = w[idx(x,y,z)];
        if(b!==AIR && b!==WATER) return {x,y,z,b,face};
        if(tmx < tmy && tmx < tmz){ x+=stepX; t=tmx; tmx+=tdx; face=[-stepX,0,0]; }
        else if(tmy < tmz){ y+=stepY; t=tmy; tmy+=tdy; face=[0,-stepY,0]; }
        else { z+=stepZ; t=tmz; tmz+=tdz; face=[0,0,-stepZ]; }
        if(t>maxD) return null;
      }
      return null;
    }
    function setBlock(x,y,z,id){
      if(!inW(x,y,z)) return false;
      w[idx(x,y,z)] = id;
      edits.set(x+','+y+','+z, id);
      rebuildAt(x,z);
      saveSoon();
      return true;
    }
    function mine(){
      const hit = raycast();
      if(!hit || hit.y===0) return;
      setBlock(hit.x, hit.y, hit.z, AIR);
      mined++; PV.sound.play('pop'); U.vibrate(12);
    }
    function place(){
      const hit = raycast();
      if(!hit) return;
      const x = hit.x+hit.face[0], y = hit.y+hit.face[1], z = hit.z+hit.face[2];
      if(!inW(x,y,z)) return;
      const cur = w[idx(x,y,z)];
      if(cur!==AIR && cur!==WATER) return;
      /* don't place inside the player */
      const px0=P.x-.35, px1=P.x+.35, pz0=P.z-.35, pz1=P.z+.35, py0=P.y, py1=P.y+1.8;
      if(px1>x && px0<x+1 && py1>y && py0<y+1 && pz1>z && pz0<z+1) return;
      setBlock(x,y,z, HOT[P.sel]);
      placed++; PV.sound.play('place'); U.vibrate(12);
    }

    /* --------------------------- physics ---------------------------- */
    function collide(nx, ny, nz){
      const r=.3, h=1.8;
      for(const [ax, ay, az] of [[nx,ny,nz]]){
        const x0=Math.floor(ax-r), x1=Math.floor(ax+r);
        const y0=Math.floor(ay), y1=Math.floor(ay+h);
        const z0=Math.floor(az-r), z1=Math.floor(az+r);
        for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++){
          if(inW(x,y,z) && SOLID(w[idx(x,y,z)])) return true;
        }
      }
      return false;
    }
    function physStep(dt){
      const sp = P.fly? 11 : (keys['ShiftLeft']||keys['shift']? 7.4 : 4.6);
      let mx=0, mz=0;
      if(keys['KeyW']||keys['ArrowUp']) mz+=1;
      if(keys['KeyS']||keys['ArrowDown']) mz-=1;
      if(keys['KeyA']||keys['ArrowLeft']) mx-=1;
      if(keys['KeyD']||keys['ArrowRight']) mx+=1;
      mx += joy.x; mz += -joy.y;
      const L = Math.hypot(mx,mz)||1;
      mx/=L; mz/=L;
      const cy=Math.cos(P.yaw), sy=Math.sin(P.yaw);
      const wx = (sy*mz + cy*mx) * sp;
      const wz = (-cy*mz + sy*mx) * sp;
      P.vx = wx; P.vz = wz;
      if(P.fly){
        let vy = 0;
        if(keys['Space'] || touchJump) vy += 8;
        if(keys['ShiftLeft'] || keys['ShiftRight']) vy -= 8;
        P.vy = vy;
      } else {
        P.vy -= 22*dt;
        if((keys['Space']||touchJump) && P.onGround){ P.vy = 7.6; P.onGround=false; PV.sound.play('tap'); }
      }
      /* axis-separated moves */
      let nx = P.x + P.vx*dt;
      if(!collide(nx, P.y, P.z)) P.x = nx;
      let nz = P.z + P.vz*dt;
      if(!collide(P.x, P.y, nz)) P.z = nz;
      let ny = P.y + P.vy*dt;
      if(!collide(P.x, ny, P.z)){ P.y = ny; P.onGround=false; }
      else {
        if(P.vy < 0){ P.onGround = true; P.y = Math.floor(ny)+1; }   /* land exactly on the surface */
        P.vy = 0;
      }
      if(P.y < -12){ P.y = groundH+3; P.vy=0; }        /* fell out? teleport */
      P.x = U.clamp(P.x, .5, WX-.5); P.z = U.clamp(P.z, .5, WZ-.5);
    }

    /* ---------------------------- render ---------------------------- */
    const proj = mat4(), view = mat4(), mvp = mat4();
    let vw=640, vh=400, dpr=1;
    function resize(){
      const wrap = root.querySelector('.vx-wrap');
      dpr = Math.min(2, window.devicePixelRatio||1);
      vw = wrap.clientWidth; vh = wrap.clientHeight;
      cv.width = vw*dpr; cv.height = vh*dpr;
      cv.style.width = vw+'px'; cv.style.height = vh+'px';
      gl.viewport(0,0,cv.width, cv.height);
    }
    resize();
    window.addEventListener('resize', resize);

    let raf=0, last=0, posT=0;
    function frame(ts){
      raf = requestAnimationFrame(frame);
      if(!last) last=ts;
      const dt = Math.min(.05, (ts-last)/1000); last = ts;
      if(!locked && !isTouch){ /* still render */ }
      physStep(dt);
      /* draw */
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      persp(proj, 1.25, vw/vh, .08, 90);
      viewMat(view, [P.x, P.y+1.62, P.z], P.yaw, P.pitch);
      mul(mvp, proj, view);
      gl.uniformMatrix4fv(loc.uMVP, false, mvp);
      gl.uniform3f(loc.uEye, P.x, P.y+1.62, P.z);
      gl.uniform3f(loc.uFog, .53, .78, .94);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc.uTex, 0);
      function bind(buf){
        if(!buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(loc.aShade, 1, gl.FLOAT, false, 28, 20);
        gl.vertexAttribPointer(loc.aAlpha, 1, gl.FLOAT, false, 28, 24);
      }
      if(loc.aPos>=0) gl.enableVertexAttribArray(loc.aPos);
      if(loc.aUV>=0) gl.enableVertexAttribArray(loc.aUV);
      if(loc.aShade>=0) gl.enableVertexAttribArray(loc.aShade);
      if(loc.aAlpha>=0) gl.enableVertexAttribArray(loc.aAlpha);
      /* opaque pass */
      gl.uniform1f(loc.uMode, 0);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      for(let i=0;i<NCX;i++) for(let j=0;j<NCZ;j++){
        const c = chunks[i][j].solid;
        if(c.n){ bind(c.buf); gl.drawArrays(gl.TRIANGLES, 0, c.n); }
      }
      /* blended pass (water + glass) */
      gl.uniform1f(loc.uMode, 1);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for(let i=0;i<NCX;i++) for(let j=0;j<NCZ;j++){
        const c = chunks[i][j].blend;
        if(c.n){ bind(c.buf); gl.drawArrays(gl.TRIANGLES, 0, c.n); }
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      /* HUD-ish text updates @4Hz */
      posT += dt;
      if(posT > .25){
        posT = 0;
        const posEl = root.querySelector('#vxPos');
        if(posEl) posEl.textContent = `x ${Math.floor(P.x)} · y ${Math.floor(P.y)} · z ${Math.floor(P.z)}`;
      }
    }

    /* ---------------------------- input ----------------------------- */
    const lockEl = root.querySelector('#vxLock');
    let locked = false;
    function lock(){
      if(!isTouch){ try{ cv.requestPointerLock(); }catch(e){} }
      lockEl.classList.add('off');
      locked = true;
    }
    root.querySelector('#vxLockGo').onclick = lock;
    document.addEventListener('pointerlockchange', ()=>{
      locked = document.pointerLockElement === cv;
      if(!locked && !over){ lockEl.classList.remove('off'); }
    });
    cv.addEventListener('click', ()=>{ if(!locked) lock(); });
    document.addEventListener('mousemove', e=>{
      if(!locked) return;
      P.yaw += e.movementX*.0026;
      P.pitch = U.clamp(P.pitch + e.movementY*.0026, -1.55, 1.55);
    });
    cv.addEventListener('contextmenu', e=> e.preventDefault());
    document.addEventListener('mousedown', e=>{
      if(!locked || over) return;
      if(e.target.closest && e.target.closest('.vx-bar')) return;
      if(e.button===0) mine(); else if(e.button===2) place();
    });
    document.addEventListener('wheel', e=>{
      if(!locked) return;
      P.sel = (P.sel + (e.deltaY>0? 1:-1) + HOT.length) % HOT.length;
      drawHot();
    }, {passive:true});
    const kd = e=>{
      keys[e.code]=true;
      if(e.code.startsWith('Digit')){
        const n = +e.code.slice(5);
        if(n>=1 && n<=HOT.length){ P.sel = n-1; drawHot(); }
      }
      if(e.code==='KeyF' && locked){ P.fly=!P.fly; P.vy=0; flyBtn.textContent = P.fly? '🕊 '+t('c.on') : '🕊 '+t('vx.fly'); }
      if(e.code==='Space' || e.code==='ArrowUp' || e.code==='ArrowDown') e.preventDefault();
    };
    const ku = e=>{ keys[e.code]=false; };
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);

    /* touch controls */
    const joy = {x:0, y:0};
    let touchJump = false;
    if(isTouch){
      root.querySelector('.vx-wrap').insertAdjacentHTML('beforeend', `
        <div class="vx-joy" id="vxJoy"><i></i></div>`);
    }
    const wrapEl = root.querySelector('.vx-wrap');
    let lookId = null, lookX=0, lookY=0, joyId=null, joyCX=0, joyCY=0;
    wrapEl.addEventListener('touchstart', e=>{
      lockEl.classList.add('off'); locked = true;
      for(const tc of e.changedTouches){
        const r = wrapEl.getBoundingClientRect();
        const lx = tc.clientX - r.left;
        if(lx < r.width*.45 && joyId===null){ joyId=tc.identifier; joyCX=tc.clientX; joyCY=tc.clientY; }
        else if(lookId===null){ lookId=tc.identifier; lookX=tc.clientX; lookY=tc.clientY; }
      }
    }, {passive:true});
    wrapEl.addEventListener('touchmove', e=>{
      for(const tc of e.changedTouches){
        if(tc.identifier===joyId){
          joy.x = U.clamp((tc.clientX-joyCX)/52, -1, 1);
          joy.y = U.clamp((tc.clientY-joyCY)/52, -1, 1);
          const jel = root.querySelector('#vxJoy');
          if(jel){ jel.style.transform = `translate(${joy.x*26}px, ${joy.y*26}px)`; }
        } else if(tc.identifier===lookId){
          P.yaw += (tc.clientX-lookX)*.006;
          P.pitch = U.clamp(P.pitch + (tc.clientY-lookY)*.006, -1.55, 1.55);
          lookX = tc.clientX; lookY = tc.clientY;
        }
      }
    }, {passive:true});
    wrapEl.addEventListener('touchend', e=>{
      for(const tc of e.changedTouches){
        if(tc.identifier===joyId){ joyId=null; joy.x=0; joy.y=0; const jel=root.querySelector('#vxJoy'); if(jel) jel.style.transform=''; }
        if(tc.identifier===lookId){ lookId=null; }
      }
    }, {passive:true});
    const jumpBtn = root.querySelector('#vxJump');
    ['touchstart','mousedown'].forEach(ev=> jumpBtn.addEventListener(ev, e=>{ e.preventDefault(); touchJump=true; setTimeout(()=>touchJump=false, 160); }));
    const flyBtn = root.querySelector('#vxFly');
    flyBtn.onclick = ()=>{ P.fly=!P.fly; P.vy=0; flyBtn.textContent = P.fly? '🕊 '+t('c.on') : '🕊 '+t('vx.fly'); };
    root.querySelector('#vxMine').onclick = ()=> mine();
    root.querySelector('#vxPlace').onclick = ()=> place();
    root.querySelector('#vxFinish').onclick = ()=> finishSandbox();
    if(!isTouch){
      root.querySelectorAll('.vx-tbtn').forEach(b=> b.style.display='none');
    }

    /* hotbar */
    const hotEl = root.querySelector('#vxHot');
    const BLOCK_CSS = {
      [GRASS]:'linear-gradient(180deg,#58b13a 45%,#7a5636 45%)', [DIRT]:'#7a5636', [STONE]:'#8b8f96',
      [SAND]:'#e7d8a8', [WOOD]:'repeating-linear-gradient(90deg,#6e4f2e 0 3px,#5c4325 3px 5px)',
      [LEAF]:'#3f9e34', [BRICK]:'repeating-linear-gradient(0deg,#b5442f 0 4px,#9c3a28 4px 6px)',
      [GLASS]:'linear-gradient(135deg,rgba(190,225,240,.55),rgba(255,255,255,.75))', [LAMP]:'#ffd45c',
    };
    function drawHot(){
      hotEl.innerHTML = HOT.map((b,i)=>
        `<button class="vx-slot ${i===P.sel?'on':''}" data-i="${i}" title="${NAMES[b]}">
          <span style="background:${BLOCK_CSS[b]}"></span><em>${i+1}</em>
        </button>`).join('');
      hotEl.querySelectorAll('[data-i]').forEach(b=> b.onclick = ()=>{ P.sel = +b.dataset.i; drawHot(); });
    }
    drawHot();

    /* finish */
    let over = false;
    function finishSandbox(){
      if(over) return; over = true;
      save();
      try{ document.exitPointerLock && document.exitPointerLock(); }catch(e){}
      PV.ui.toast(t('vx.saved'),'ok','check');
      const score = placed*5 + mined*2;
      ctx.setTurn('⛏ '+fmtCount(placed)+' · '+fmtCount(mined));
      setTimeout(()=>ctx.finish({
        res:'d', vsHuman:false, scores:{[ctx.selfPid]:score, me:score},
        sub: t('vx.blocks')+': '+fmtCount(placed+mined),
        stats:{blocks: placed+mined},
      }), 500);
    }
    function fmtCount(n){ return U.fmt(n||0); }

    /* auto-save */
    const saveIv = setInterval(save, 8000);
    window.addEventListener('beforeunload', save);

    raf = requestAnimationFrame(frame);
    /* tiny debug hook (QA + power users) */
    try{ window.__vx = { P, mine, place, setBlock, raycast }; }catch(e){}

    return {
      init(){}, start(){},
      getState(){ return {seed, edits:edits.size, placed, mined}; },
      getScores(){ return {[ctx.selfPid]: placed*5+mined*2, me: placed*5+mined*2}; },
      getStatus(){ return over? '' : (P.fly? '🕊 '+t('vx.fly') : ''); },
      end(){ if(!over){ over=true; save(); } cancelAnimationFrame(raf); clearInterval(saveIv); },
      pause(){}, resume(){},
      destroy(){
        over = true; cancelAnimationFrame(raf); clearInterval(saveIv); save();
        locked = false;
        try{ document.exitPointerLock && document.exitPointerLock(); }catch(e){}
        document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
        root.remove();
      },
      reset(){},
    };
  }
});
})();
