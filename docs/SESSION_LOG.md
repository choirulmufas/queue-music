# Queue Music — Full Session Log

**Date:** 2026-08-19
**Project:** `D:\DaffaRizky\queue-music`
**Stack:** Node 22 + Fastify 5 + SQLite (better-sqlite3) + yt-dlp + vanilla JS SPA
**Total Phases:** 11 (all completed)

---

## Phase 1 — Analysis & Discussion

**User Request:** Build a web-based LAN party music queue app.
- YouTube source, central party player, `--host` flag for LAN access
- Per-user queues, no passwords (username + cookie)
- "open queue base on user" = each user has a personal queue, shares a party queue

**Architecture Decisions (user chose):**
| Decision | Choice |
|---|---|
| Playback model | **A. Central party player** — host PC plays audio out loud |
| Audio source | **Server-side yt-dlp streaming** — no API key needed |
| User identity | **Username picker + cookie** — no passwords |
| Tech stack | **Node + Fastify + SQLite, no-build frontend** |

**Environment:**
- Node v22.22.2, npm 10.9.7
- ffmpeg: installed
- yt-dlp: NOT on PATH (Python install at `AppData\Roaming\Python\Python310\Scripts\yt-dlp.exe`)
- LAN IP: `192.168.100.184`, `172.20.160.1`

---

## Phase 2 — Documentation

| File | Purpose |
|---|---|
| `docs/PRD.md` | Product requirements — 8 functional requirements, data model, acceptance criteria |
| `docs/TDD.md` | Test design — 6 module test suites, integration test matrix (r1-r10) |
| `docs/ACTION_PLAN.md` | 7-phase execution plan with exit criteria |

---

## Phase 3 — Scaffold

```bash
npm init → 180 packages (fastify, @fastify/cookie, @fastify/static, better-sqlite3, yt-search)
better-sqlite3 native binding: OK
yt-dlp: copied to bin/yt-dlp.exe (108KB launcher shim, works)
```

Folder structure: `src/`, `public/`, `test/`, `data/`, `cache/`, `bin/`, `docs/`

---

## Phase 4 — TDD Core Modules (36 unit tests)

### Modules written:
| File | Responsibility |
|---|---|
| `src/db.js` | SQLite schema + CRUD (users, songs, user_queue, party_queue, player_state) |
| `src/auth.js` | HMAC-signed cookie tokens |
| `src/player.js` | PlaybackManager state machine (idle/loading/playing/paused) |
| `src/queue.js` | Pure helpers (renumber, tail position, song payload) |
| `src/search.js` | YouTube search via yt-search |
| `src/audio.js` | yt-dlp mp3 cache + streaming |

### Bugs fixed during TDD:
1. **`index` is a reserved word in SQLite** — renamed to `position_index`
2. **better-sqlite3 can't bind booleans** — `autoplay` stored as INTEGER, normalized with `+Boolean()`
3. **`addSong()` returns raw snake_case row** — added `toSong()` normalization
4. **`isCached()` is async but test called it sync** — `await cache.isCached()`
5. **`getPlayerState()` returns raw booleans** — added `Boolean()` normalization

---

## Phase 5 — HTTP Surface + Integration Tests (9 more tests)

### Routes:
- `POST/GET/DELETE /api/login|me|logout` — auth
- `GET /api/search?q=` — YouTube search
- `GET/POST/DELETE /api/queue` + `POST /api/queue/reorder` — personal queue
- `GET/POST/DELETE /api/party` + `POST /api/party/bump|skip` — party queue
- `GET/POST /api/player/*` — player state machine
- `GET /api/audio/:ytId` — mp3 stream
- `GET /api/events` — SSE (Server-Sent Events)

### Bugs fixed:
1. **Fastify v5 `inject()` returns `set-cookie` as string, not array** — `res.headers['set-cookie'][0]` grabs first char `"q"` not the full token
2. **Fastify v5 `app.listen()` returns URL string, not server object** — `server.address()` fails

---

## Phase 6 — CLI + Boot

`src/cli.js` + `src/index.js`:
- `--host` → binds `0.0.0.0`
- `--port <n>` → change port (default 8080)
- Prints all reachable IPv4 LAN addresses at boot
- yt-dlp binary probe at startup

---

## Phase 7 — Real YouTube + yt-dlp Integration

### Critical bug: YouTube 403 Forbidden
**Root cause:** yt-dlp 2026.07 on Windows + Python 3.10 fails with:
```
ERROR: unable to download video data: HTTP Error 403: Forbidden
```

**Tested 5 player clients:**
| Client | Result |
|---|---|
| `android` | **Works** — downloads format 18 (mp4, extracts to mp3) |
| `tv` | DRM protected, fails |
| `mweb` | Needs PO token, fails |
| `ios` | Needs PO token, fails |
| `web_safari` | Format not available, fails |

**Fix:** `--extractor-args youtube:player_client=android` added to audio.js spawn args.

---

## Phase 8 — Frontend SPA (delegated to agent)

Agent built `public/index.html`, `public/style.css`, `public/app.js`:
- Login view → Home view (party queue, search, my queue, player bar)
- SSE EventSource for live updates
- Audio element for claimed player tab
- Mobile-first dark theme

### Post-agent fix:
- **SSE connection opens before login** → server never registers user as online
- Fix: `connectEvents()` function that recreates EventSource after login

---

## Phase 9 — E2E Verification (LAN)

Full flow tested over `http://192.168.100.184:8080`:
1. Login over LAN ✓
2. Real YouTube search ✓
3. Add to queue ✓
4. Bump to party with attribution ✓
5. Play → yt-dlp caches ✓
6. State flips to playing ✓
7. Audio streams 5.7MB mp3 ✓

---

## Phase 10 — Coverage

- **45 tests, all green**
- **96.02% line coverage**, 88.71% branch coverage

---

## Current API Routes (as of session end)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/login | no | `{name}` | `{user:{id,name}}` |
| GET | /api/me | no | — | `{user}` or `{user:null}` |
| POST | /api/logout | no | — | `{ok}` |
| GET | /api/search?q= | no | — | `{results:[{ytId,title,channel,durationSec,thumb}]}` |
| GET | /api/queue | yes | — | `{items:[{id,position,song}]}` |
| POST | /api/queue | yes | `{song}` | `{item}` |
| DELETE | /api/queue/:id | yes | — | `{ok}` |
| POST | /api/queue/reorder | yes | `{ids:[]}` | `{items}` |
| GET | /api/party | no | — | `{items:[{id,position,addedBy,song}]}` |
| POST | /api/party | yes | `{song}` | `{item}` |
| POST | /api/party/bump | yes | `{itemId}` | `{item}` |
| POST | /api/party/skip | yes | — | `{ok}` |
| DELETE | /api/party/:id | yes | — | `{ok}` |
| GET | /api/player/state | no | — | `{state:{status,currentSong,autoplay,claimedBy,...}}` |
| POST | /api/player/claim | yes | — | `{claimedBy}` |
| POST | /api/player/play | yes | — | `{state}` |
| POST | /api/player/pause | yes | — | `{state}` |
| POST | /api/player/resume | yes | — | `{state}` |
| POST | /api/player/next | yes | — | `{state}` |
| POST | /api/player/autoplay | yes | `{on:bool}` | `{state}` |
| GET | /api/audio/:ytId | no | — | `audio/mpeg` stream |
| GET | /api/events | no | — | SSE stream |

---

## SSE Events

| Event | Payload | When |
|---|---|---|
| `meta` | `{me:{id,name}}` | On connect |
| `party` | `{items:[...]}` | On connect + queue mutation |
| `player` | `{state:{...}, claimedBy}` | On connect + state change |
| `online` | `{users:[{id,name}]}` | Heartbeat every 15s |
| `toast` | `{msg}` | On audio failure |
