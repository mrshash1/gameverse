/* ============ PlayVerse Net — REAL-time P2P via WebRTC (Trystero v0.25 API) ============
   Rooms, live presence, room discovery, matchmaking queue.
   No backend needed — works straight from GitHub Pages, also from Iran.
===================================================================================== */
import { joinRoom, selfId } from '../vendor/trystero-nostr.mjs';

const PV = (window.PV = window.PV || {});
const U = PV.u, t = PV.t;

const APP = { appId: 'playverse-p2p-v1' };
let status = 'ok';

/* v0.25 action wrapper: {send(data, toPeerId?), on(cb(data, peerId))} */
function act(room, name){
  const a = room.makeAction(name);
  return {
    send: (data, to)=>{ try{ a.send(data, to? {target:to} : {}); }catch(e){ console.warn('send fail', name, e); } },
    on: (fn)=>{ a.onMessage = (data, ctx)=>{ try{ fn(data, ctx?.peerId); }catch(e){ console.error('on', name, e); } }; }
  };
}

const lobby = { room:null, peers:new Map(), rooms:new Map() };
let roomInst = null;
let queueInst = null;
let exchangeHandlers = null;

function safeJoin(roomId){
  try{ return joinRoom(APP, roomId); }catch(e){ console.error('join fail', e); return null; }
}
function prune(map){
  const now = Date.now();
  for(const [k,v] of [...map]) if(now - (v.seen||0) > 40000) map.delete(k);
}

/* ---------- LOBBY presence (everyone joins silently) ---------- */
function joinLobby(profileFn){
  if(lobby.room || status!=='ok') return;
  const r = safeJoin('pv-lobby-v1');
  if(!r){ status='fail'; return; }
  lobby.room = r;
  const me = act(r, 'me');
  const rm = act(r, 'rm');
  lobby._sendMe = me; lobby._sendRoom = rm;

  const announce = ()=>{
    const p = profileFn(); if(!p) return;
    me.send({u:p.name, av:p.avatar, lvl:U.levelFromXp(p.xp).level, ts:Date.now()});
  };
  announce();
  lobby._timer = setInterval(announce, 12000);

  r.onPeerJoin = id=>{ lobby.peers.set(id, {...(lobby.peers.get(id)||{}), id, seen:Date.now()}); PV.net.events.emit('lobby'); };
  r.onPeerLeave = id=>{ lobby.peers.delete(id); PV.net.events.emit('lobby'); };
  me.on((data, id)=>{ lobby.peers.set(id, {...data, id, seen:Date.now()}); PV.net.events.emit('lobby'); if(exchangeHandlers) exchangeHandlers(data, id); });
  rm.on((data, id)=>{ data.seen = Date.now(); lobby.rooms.set(data.code, data); prune(lobby.rooms); PV.net.events.emit('rooms'); });
  setInterval(()=>{ prune(lobby.peers); prune(lobby.rooms); PV.net.events.emit('lobby'); }, 15000);
}

/* ---------- GAME ROOM ---------- */
class GameRoom {
  constructor(code){
    this.code = code;
    const r = safeJoin('pv-room-'+code);
    if(!r) throw new Error('net fail');
    this.r = r;
    this.peers = new Map();
    this.lobbyState = null;
    this.amHost = false;
    this.hostPid = null;
    this.inMatch = false;
    this.handlers = {};
    this._seq = 0;

    this.aMe = act(r,'me');
    this.aLb = act(r,'lb');
    this.aRd = act(r,'rd');
    this.aCh = act(r,'ch');
    this.aSt = act(r,'st');
    this.aGm = act(r,'gm');
    this.aKk = act(r,'kk');

    r.onPeerJoin = id=>{
      this.peers.set(id, this.peers.get(id)||{id, seen:Date.now()});
      this.aMe.send(this.myMeta());
      if(this.amHost){
        const st = this.lobbyState ||= this.initLobbyFromOld();
        if(!st.players.some(p=>p.pid===id)){
          st.players.push({pid:id, name:'؟', av:'fox', lvl:1, ready:false});
          this.broadcastLobby();
        }
      }
      PV.net.events.emit('room', this);
      PV.sound.play('join');
    };
    r.onPeerLeave = id=>{
      this.peers.delete(id);
      if(this.amHost && this.lobbyState){
        this.lobbyState.players = this.lobbyState.players.filter(p=>p.pid!==id);
        this.broadcastLobby();
      }
      if(this.hostPid===id) this.electHost();
      this.h('leave', id);
      PV.net.events.emit('room', this);
      PV.sound.play('leave');
    };
    this.aMe.on((d, id)=>{
      const p = this.peers.get(id) || {};
      this.peers.set(id, {...p, ...d, id, seen:Date.now()});
      if(this.amHost){
        const st = this.lobbyState;
        const pl = st?.players?.find(x=>x.pid===id);
        if(st && pl){ Object.assign(pl, {name:d.name, av:d.av, lvl:d.lvl}); this.broadcastLobby(); }
      }
      PV.net.events.emit('room', this);
    });
    this.aLb.on((st, id)=>{ if(id===this.hostPid || st?.host){ this.lobbyState = st; if(st?.host) this.hostPid = st.host; this.h('lobby', st); } });
    this.aRd.on((d, id)=>{
      if(this.amHost){
        const p = this.lobbyState?.players?.find(p=>p.pid===id);
        if(p){ p.ready = !!d.ready; this.broadcastLobby(); }
      }
    });
    this.aCh.on((d, id)=>{ this.h('chat', {...d, pid:id}); PV.sound.play('msg'); });
    this.aSt.on((d, id)=>{ if(id===this.hostPid){ this.inMatch = true; this.h('start', d); } });
    this.aGm.on((d, id)=>{ this.h('gm', {...d, from:id}); });
    this.aKk.on(()=>{ this.h('kicked'); });
  }
  myMeta(){
    const p = PV.store.me();
    return {name: p? p.name : (PV.store.displayName()||t('c.guest')), av: p? p.avatar:'fox', lvl: p? U.levelFromXp(p.xp).level:1};
  }
  h(k, d){ const list=this.handlers[k]; if(list) list.forEach(fn=>{ try{fn(d);}catch(e){console.error(e);} }); }
  on(k, fn){ (this.handlers[k] ||= []).push(fn); }
  electHost(){
    const ids = [selfId, ...this.peers.keys()].sort();
    this.hostPid = ids[0];
    const was = this.amHost;
    this.amHost = this.hostPid === selfId;
    if(this.amHost && !was){
      if(!this.lobbyState) this.initLobbyFromOld();
      else {
        /* refresh host flag in state */
        this.lobbyState.host = selfId;
        this.lobbyState.players = this.lobbyState.players.map(p=>({...p, host: p.pid===selfId}));
        this.broadcastLobby();
      }
      this.h('host', true);
      PV.net.events.emit('room', this);
    }
  }
  initLobbyFromOld(){
    if(this.lobbyState) return this.lobbyState;
    const players = [{pid:selfId, ...this.myMeta(), ready:true, host:true}];
    this.lobbyState = {host:selfId, game:null, mode:'classic', players, ts:Date.now()};
    this.broadcastLobby();
    return this.lobbyState;
  }
  broadcastLobby(){
    if(!this.amHost || !this.lobbyState) return;
    this.lobbyState.ts = Date.now();
    this.aLb.send(this.lobbyState);
    if(!this.inMatch){
      lobby._sendRoom?.send({code:this.code, host:this.lobbyState.players.find(p=>p.host)?.name||'؟', game:this.lobbyState.game, n:this.lobbyState.players.length, max:8, mode:this.lobbyState.mode, ts:Date.now()});
    }
  }
  players(){ return this.lobbyState?.players || []; }
  me(){ return this.lobbyState?.players?.find(p=>p.pid===selfId) || {pid:selfId, ...this.myMeta(), ready:false}; }
  startMatch(payload){ this.inMatch=true; this.aSt.send(payload); this.h('start', payload); }
  gameMsg(k, d, to){ this.aGm.send({k, d, by:selfId, seq:++this._seq}, to); }
  sendChat(d){ this.aCh.send(d); }
  sendReady(d){ this.aRd.send(d); }
  sendKick(d, to){ this.aKk.send(d, to); }
  leave(){ try{ this.r.leave(); }catch(e){} if(roomInst===this) roomInst=null; }
}

/* ---------- Matchmaking queue ---------- */
async function queueUp(gameId, onFound){
  if(status!=='ok') return false;
  leaveQueue();
  const r = safeJoin('pv-queue-'+gameId);
  if(!r) return false;
  queueInst = {r, gameId};
  const pair = act(r, 'pair');
  const p = PV.store.me();
  r.onPeerJoin = async id=>{
    const ids = [selfId, id].sort();
    if(ids[0]===selfId){
      const c = U.code(5);
      pair.send({code:c}, id);
      await U.sleep(500);
      onFound({code:c, host:true});
    }
  };
  pair.on(async d=>{
    onFound({code:d.code, host:false});
  });
  return true;
}
function leaveQueue(){
  if(queueInst){ try{ queueInst.r.leave(); }catch(e){} queueInst=null; }
}

const events = {
  m:{},
  on(k, fn){ (this.m[k] ||= []).push(fn); },
  emit(k, d){ (this.m[k]||[]).forEach(fn=>{ try{fn(d);}catch(e){console.error(e);} }); }
};

function init(){
  status = 'ok';
  joinLobby(()=>PV.store.me());
  PV.net.events.emit('ready');
}

PV.net = {
  get status(){ return status; },
  get selfId(){ return selfId; },
  ready: null,
  events,
  joinLobby,
  createRoom(){
    const c = U.code(5);
    const r = new GameRoom(c);
    roomInst = r; r.hostPid = selfId; r.amHost = true; r.initLobbyFromOld();
    return r;
  },
  joinRoomByCode(c){ const r = new GameRoom(String(c).toUpperCase()); roomInst = r; return r; },
  get room(){ return roomInst; },
  queueUp, leaveQueue,
  setExchange(fn){ exchangeHandlers = fn; },
  lobby,
  liveRooms(){ prune(lobby.rooms); return [...lobby.rooms.values()].filter(r=>r.n>0).sort((a,b)=>b.ts-a.ts); },
  onlineFriends(friendNames){
    prune(lobby.peers);
    const names = new Set((friendNames||[]).map(n=>String(n).toLowerCase()));
    return [...lobby.peers.values()].filter(p=>p.u && names.has(String(p.u).toLowerCase()));
  },
  onlineCount(){ prune(lobby.peers); return lobby.peers.size; }
};
init();
window.Net = PV.net;
document.dispatchEvent(new CustomEvent('pv:net'));
