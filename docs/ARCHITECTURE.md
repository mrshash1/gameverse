# PlayVerse — Architecture

## Layers

```
┌────────────────────────── index.html (SPA shell) ──────────────────────────┐
│  router (hash-based)  →  PV.screens.*  (js/screens/*.js)                   │
│                                                                          │
│  Core services (global `PV`):                                              │
│   i18n (fa/en/ar)   store (settings/session/profiles)   ui (kit)          │
│   registry (plugin games)   sdk (match lifecycle)   net (WebRTC P2P)      │
│   cloud (accounts/boards sync)   achievements   missions   sound   visuals│
└──────────────────────────────────────────────────────────────────────────┘
                │ lazy script injection
        games/<id>/game.js  →  PV.registry.register({factory})
```

## Game plugin contract

Static metadata ships in `js/registry.js` so lists render instantly; the **factory**
is lazy-loaded from `games/<id>/game.js` on first play.

Controller interface (all optional except none):

```js
{ init(), start(), pause(), resume(), end(), reset(), getState(),
  submitResult(), destroy(), getScores(), getStatus() }
```

`ctx` handed to every factory:

| field | meaning |
|---|---|
| `root` | DOM element to render into |
| `mode` | `solo` / `classic` / `ranked` / `casual` / `quick` / `tournament` |
| `room` | live `GameRoom` (null in solo) |
| `players` | authoritative seat order (host-defined, includes bots `BOT:*`) |
| `seed` | shared RNG seed (host-generated) → deterministic decks/questions |
| `amHost` | host-authority flag |
| `send(k,d,to)` / `broadcast(k,d)` / `on(k,fn)` | P2P messaging (enveloped in `gm`) |
| `finish({res:'w'|'l'|'d', scores, perf, stats, vsHuman})` | ends match → SDK overlay, XP/ELO/achievements/missions |
| `setTurn/setStatus/setScores` | shell UI bindings |

## Multiplayer protocol (Trystero / Nostr relays)

- **Lobby room** `pv-lobby-v1`: presence heartbeat every 12 s (`me`), live-room ads (`rm`), peer metadata exchange hook.
- **Game rooms** `pv-room-<CODE5>`: actions
  - `me` identity, `lb` lobby snapshot (host → all, authoritative), `rd` ready toggle,
    `ch` chat/emotes, `st` start payload (game, seed, players, mode), `gm` game moves, `kk` kick.
- **Queue rooms** `pv-queue-<gameId>`: first peer (lowest id) pairs newcomers, issues a fresh room code.
- Host election: lowest peer id wins when the host disconnects; lobby state survives.
- Turn-based games are **host-authoritative** (moves validated by host, state broadcast);
  simultaneous games (RPS reveal, reaction, quiz) use deterministic client logic with the shared seed.

## Cloud layer (`js/cloud.js`)

Provider chain: custom endpoint (admin-set) → auto-created jsonblob world blob → offline.
Read-modify-write with `If-Match` ETag retries. Passwords: per-user salt + SHA-256 (WebCrypto).
Writes are debounced; render paths never block on the network (local data first).

World blob schema: `{users:{<u>:{u,name,salt,ph,prof,ratings,friends}}, scores:{<g>:[…]},
inbox:{<u>:[friend requests…]}, announce, flags, cats, stats}`.

## Performance

Zero build; lazy game modules; vendored font (woff2, FD digits) and P2P library (no CDN at runtime);
single global namespace; rendering via template strings; interval cleanup on navigation.
