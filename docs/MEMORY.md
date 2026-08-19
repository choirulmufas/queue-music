# Project Memory — Queue Music

Single source of truth for agents working on this repo. Read `docs/PRD.md`,
`docs/TDD.md`, `docs/ACTION_PLAN.md` for full specs. This file is the living
index + conventions.

## Conventions (STRICT)
- **ESM only** (`"type": "module"`). No CommonJS `require` in `src/`.
- **No comments in code** unless the task explicitly requests them, except
  `TODO` markers are fine.
- **Tests drive code**: write/modify `test/` first (node:test), then make it
  pass. Run: `npm test`.
- **Never touch the network in unit tests.** Search/audio/youtube IO must be
  injected as fakes.
- Node built-ins only in `src/` plus the deps listed in `package.json`.

## Module map
| File | Responsibility |
|---|---|
| `src/db.js` | better-sqlite3 wrapper: schema + all data-access functions (injectable file path) |
| `src/auth.js` | HMAC-signed username cookie tokens; `sign`/`verify` |
| `src/player.js` | `PlaybackManager` state machine (status, index, autoplay, advance) |
| `src/queue.js` | pure queue helpers (renumber, tail, bump position calc) |
| `src/search.js` | `makeSearch(cb)` factory → normalized YouTube results |
| `src/audio.js` | `createCacher({cacheDir, spawnToken, bin, events})` → mp3 cache via yt-dlp |
| `src/events.js` | tiny `EventBus` (single emit→all subscribers) used by SSE |
| `src/server.js` | `buildApp({ db, search, cacher, bus, player })` Fastify composition root |
| `src/index.js` | CLI+boot: parse flags, bind, print LAN banner |
| `public/` | static SPA (login, search, queues, player tab) |

## API contract (stable signatures — frontend agent BEWARE)
- `POST /api/login {name}` → `{user:{id,name}}` + cookie `qm_user`
- `GET  /api/me` → `{user}` or 401
- `GET  /api/search?q=word` → `{results:[{ytId,title,channel,durationSec,thumb}]}`
- `GET  /api/queue` → `{items:[{id,song:{...} }]}`
- `POST /api/queue {song}` → `{item}`
- `DELETE /api/queue/:itemId`
- `POST /api/queue/reorder {ids:[...]}` → `{items}`
- `GET  /api/party` → `{items:[{id,song,addedBy:{id,name} }]}`
- `POST /api/party {song}` → `{item}`
- `POST /api/party/bump {itemId}` → `{item}`  (move personal→party)
- `POST /api/party/:itemId/skip` → `{ok}`
- `DELETE /api/party/:itemId`
- `GET  /api/player/state` → `{state:{status,currentSong?,index,autoplay}, claimedBy?}`
- `POST /api/player/claim` → `{claimed:true, tab {id}}`
- `POST /api/player/play|pause|resume|next`
- `POST /api/player/autoplay {on:boolean}`
- `GET  /api/audio/:ytId` → stream `audio/mpeg` (or 404/502)
- `GET  /api/events` → **SSE** events: `party`, `player`, `online`, `meta`, `toast`

## SSE event payloads
- `party`   → `{items:[...]}` full party snapshot
- `player`  → `{state, claimedBy?}`
- `online`  → `{users:[{id,name}]}` (heartbeat from open SSE tabs)
- `meta`    → `{me:{id,name}}` sent on connect
- `toast`   → `{msg}` transient message

## Verification commands
- `npm test`
- `npm start` / `npm start -- --host --port 8080`
- Manual E2E in `docs/ACTION_PLAN.md` phase 6.

## Logbook
Append status per phase in `docs/LOGBOOK.md` when a phase completes.