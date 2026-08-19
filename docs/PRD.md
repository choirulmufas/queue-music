# PRD — Queue Music (LAN Party Player)

**Status:** Approved
**Date:** 2026-08-19
**Owner:** DaffaRizky

---

## 1. Problem Statement

Friends want to queue and control music together at a party without premium
accounts, per-device subscriptions, or complicated apps. The host runs one app on
their PC; friends on the same LAN add songs to a shared queue from their phones
or laptops. Everyone listens through the host's speakers (central party player).

## 2. Goals / Non-Goals

### Goals
- Runs with `--host <ip>` (binds `0.0.0.0`) so any device on the LAN can open
  `http://<host-ip>:<port>`.
- Central party player: the host browser tab plays audio out loud; all other
  tabs only control/search/queue.
- **Queue based on user**: each user has a **personal queue**; items pushed to
  the shared **party queue** retain the author's name.
- Search & play videos via **YouTube** (yt-dlp + ffmpeg server-side extraction).
- No login password required: username picker + cookie.

### Non-Goals (MVP)
- No YouTube API key requirement (yt-dlp only).
- No multi-room / multiple parties.
- No song lyrics, playlists/shares, or mobile app binaries.
- No resume-across-restart of the *player position* (queue persists, player restarts).

## 3. Users & Scenarios

| Persona | Behavior |
|---|---|
| **Host (Daffa)** | Starts server with `npm start -- --host`. Keeps the **Player tab** open and the PC near the speakers. Can also queue songs. |
| **Friend** | Opens `http://192.168.100.184:8080`, picks a username, searches YouTube, adds songs to their own queue, bumps them to the party queue, votes to skip. |

## 4. Architecture

```
┌──────────────┐  HTTP/JSON + SSE   ┌───────────────────────────────┐
│ Friend tabs  │ ─────────────────► │                               │
│ (queue view) │                    │  Fastify server (Node 22)     │
└──────────────┘                    │   ├─ REST /api/*              │
┌──────────────┐  GET /api/audio/   │   ├─ SSE /api/events           │
│ HOST Player  │ ◄────────────────  │   ├─ PlaybackManager (state)   │
│ tab (audio)  │                    │   ├─ SQLite (better-sqlite3)   │
└──────────────┘                    │   └─ yt-dlp + ffmpeg           │
                                    └───────────┬───────────────────┘
                                            │ spawn
                                    ┌───────▼────────┐
                                    │ yt-dlp cache   │  mp3 files
                                    │ .cache/*.mp3   │
                                    └────────────────┘
```

- **Frontend**: static HTML/CSS/JS served by Fastify (no build step).
- **DB**: single SQLite file `data/music.db` via `better-sqlite3`.
- **Real-time**: SSE push channel (`/api/events`) broadcasts state changes
  (queue updates, playback state, online users).
- **Playback**: state machine held server-side. The "player tab" polls state and
  streams audio from `/api/audio/:songId`. Designated player = last tab that
  pressed **"Become the Player"** (host intent) — friends auto-land in queue mode.

## 5. Functional Requirements

### FR-1 CLI & LAN (hosting)
- `npm start` → defaults `host=127.0.0.1`, `port=8080`.
- `npm start -- --host` → binds `0.0.0.0`. `--port 9000` overrides port.
- Startup prints all reachable v4 addresses:
  `► http://192.168.100.184:8080  (LAN)`
- Prints `yt-dlp not found → search cache only mode` if binary is missing (graceful degradation).

### FR-2 Identity (username + cookie)
- `POST /api/login { name }` creates/looks-up user, sets `qm_user` cookie.
- `GET /api/me` returns `{ user }` or `401`-style when anonymous.
- `POST /api/logout`.

### FR-3 YouTube search
- `GET /api/search?q=...` returns up to 10 `{ ytId, title, channel, duration, thumb }`.
- Uses `yt-search` npm package (no API key). Errors returned clearly to client.

### FR-4 Personal queue (per user)
- `GET  /api/queue` — items of logged-in user.
- `POST /api/queue` `{ song }` — add song (dedupe allowed).
- `DELETE /api/queue/:id`.
- `POST /api/queue/reorder` `{ ids: [...] }` — persist custom order.

### FR-5 Party queue (shared, attributed)
- `GET /api/party` — ordered items `{ song, addedBy, position }`.
- `POST /api/party/bump { queueItemId }` — move a song from personal queue to the
  end of party queue (keeps author = the user).
- `POST /api/party` `{ song }` — add directly to party queue.
- `POST /api/party/skip` — advance to next song (anyone can; vote threshold N/A MVP).
- `DELETE /api/party/:id` — host removable.

### FR-6 Playback manager (central player)
- Holds state: `{ status: idle|loading|playing|paused, currentSong, index, positionSec }`.
- `POST /api/player/claim` — marks requester tab as the active player.
- `POST /api/player/play` — play party queue from index 0 / resume.
- `POST /api/player/pause` / `POST /api/player/resume`.
- `POST /api/player/next`.
- Auto-advance: on track end → next item; loop party queue when finished (toggle).
- `GET /api/audio/:songId` streams cached mp3 (downloads via yt-dlp on first play).

### FR-7 Real-time events (SSE)
- `/api/events` pushes: `party`, `player`, `online`, `meta` (current user).
- Replays current full state on connect.

### FR-8 Frontend
- Single-page-app, mobile-friendly (friends are on phones).
- Views: `Login` → `Home` (search + your queue + party queue + player bar).
- Player tab: minimal, shows artwork, title, seek hint, and a **clear claim**.
- Host can see string "YOUR SPEAKER TAB" so they don't mistake it for a phone view.

## 6. Data Model

```sql
users(id INTEGER PK, name TEXT UNIQUE NOT NULL, created_at INTEGER)

songs(id INTEGER PK, yt_id TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      channel TEXT, duration_sec INTEGER, thumb TEXT, added_by INTEGER)

user_queue(id INTEGER PK, user_id INTEGER REFERENCES users,
           song_id INTEGER REFERENCES songs, position INTEGER, created_at INTEGER)

party_queue(id INTEGER PK, song_id INTEGER REFERENCES songs,
            added_by INTEGER REFERENCES users, position INTEGER, created_at INTEGER)

player_state(id INTEGER PRIMARY KEY CHECK(id=1), status TEXT, current_song_id INTEGER,
             index INTEGER, position_sec INTEGER, autoplay INTEGER, updated_at INTEGER)
```

Unique partial index over `user_queue(user_id, song_id)` to avoid duplicates per
user (policy: duplicates allowed at party level though — MVP allow).

## 7. Non-Functional Requirements
- **LAN latency**: search < 1.5 s typical; play start (first cache) < ~8 s.
- **Concurrency**: SQLite is single-writer; use WAL mode + a small mutex for
  writes. SSE fan-out O(n).
- **Persistence**: queue + users survive server restart.
- **Security (trusted LAN)**: sanitize/escape all user input in UI; content-type
  of audio is `audio/mpeg`; range-request support for seeking.
- **Zero build**: no npm build step, no bundler.

## 8. Acceptance Criteria (answerable YES/NO)
1. `npm start -- --host --port 8080` prints `http://<lan-ip>:8080` and binds 0.0.0.0. ✅ verified by `netstat`/curl from another device.
2. Friend opens URL on phone → sees login → sets name.
3. Friend searches "sunday best" → results appear; adds 2 songs to personal queue.
4. Friend bumps song → appears in party queue with friend's name; all tabs update live (≤2 s).
5. Host tab presses "Become the Player" + Play → audio audible on host speakers.
6. Track ends → next track plays; empty queue → idle.
7. Server restart → queues/users persist; player back to idle.
8. First-play listing a song the host tab streams from `/api/audio/:id` returns `audio/mpeg`.

## 9. Open Questions (post-MVP)
- Vote-to-skip threshold | SoundCloud source | multiple rooms | playlist import.