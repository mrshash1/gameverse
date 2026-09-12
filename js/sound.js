/* ============ PlayVerse Sound Engine — WebAudio synth (no asset files) ============ */
(function(){
'use strict';
const PV = window.PV;
let ctx = null, vol = .8, enabled = true;

function ac(){
  if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
  if(ctx.state==='suspended') ctx.resume();
  return ctx;
}
function tone({f=440, f2=null, type='sine', dur=.15, gain=.5, when=0, slide=false}){
  if(!enabled) return; const c=ac(); if(!c) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if(f2!=null) o.frequency[slide?'exponentialRampToValueAtTime':'linearRampToValueAtTime'](f2, t0+dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*vol), t0+.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0+dur+.05);
}
function noise({dur=.2, gain=.3, when=0}){
  if(!enabled) return; const c=ac(); if(!c) return;
  const t0=c.currentTime+when, len=c.sampleRate*dur, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=c.createBufferSource(); src.buffer=buf;
  const g=c.createGain(); g.gain.value=gain*vol;
  const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=900;
  src.connect(f).connect(g).connect(c.destination); src.start(t0);
}

const SFX = {
  tap: ()=>{ tone({f:600,f2:750,type:'triangle',dur:.07,gain:.35}); },
  pop: ()=>{ tone({f:300,f2:560,type:'sine',dur:.11,gain:.5}); },
  place: ()=>{ tone({f:240,f2:180,type:'triangle',dur:.12,gain:.55}); noise({dur:.06,gain:.15}); },
  flip: ()=>{ tone({f:500,f2:800,type:'sine',dur:.09,gain:.4}); },
  win: ()=>{ [523,659,784,1047].forEach((f,i)=>tone({f,type:'triangle',dur:.28,gain:.5,when:i*.11})); tone({f:1319,type:'sine',dur:.5,gain:.35,when:.44}); },
  lose: ()=>{ tone({f:392,f2:196,type:'sawtooth',dur:.5,gain:.3}); tone({f:311,f2:156,type:'sawtooth',dur:.55,gain:.25,when:.1}); },
  drawS: ()=>{ tone({f:440,type:'sine',dur:.2,gain:.4}); tone({f:440,type:'sine',dur:.2,gain:.4,when:.22}); },
  tick: ()=>{ tone({f:900,type:'square',dur:.04,gain:.14}); },
  urgent: ()=>{ tone({f:1200,type:'square',dur:.05,gain:.2}); },
  go: ()=>{ tone({f:880,f2:1320,type:'triangle',dur:.2,gain:.6}); },
  falseStart: ()=>{ tone({f:200,f2:90,type:'sawtooth',dur:.35,gain:.5}); },
  coin: ()=>{ tone({f:988,type:'square',dur:.08,gain:.3}); tone({f:1319,type:'square',dur:.2,gain:.3,when:.08}); },
  ach: ()=>{ [660,880,1175].forEach((f,i)=>tone({f,type:'sine',dur:.25,gain:.5,when:i*.09})); noise({dur:.3,gain:.12,when:.1}); },
  msg: ()=>{ tone({f:700,f2:900,type:'sine',dur:.1,gain:.35}); },
  join: ()=>{ [440,660].forEach((f,i)=>tone({f,type:'triangle',dur:.15,gain:.45,when:i*.1})); },
  leave: ()=>{ [660,440].forEach((f,i)=>tone({f,type:'triangle',dur:.15,gain:.4,when:i*.1})); },
  whoosh: ()=>{ noise({dur:.25,gain:.2}); },
  fanfare: ()=>{ [523,659,784,659,784,1047].forEach((f,i)=>tone({f,type:'triangle',dur:.2,gain:.5,when:i*.09})); },
};

function play(name){ try{ SFX[name] && SFX[name](); }catch(e){} }
function setVol(v){ vol = Math.max(0, Math.min(1, v)); }
function setEnabled(b){ enabled = !!b; }

PV.sound = { play, setVol, setEnabled, get enabled(){return enabled;}, unlock: ()=>ac() };
})();
