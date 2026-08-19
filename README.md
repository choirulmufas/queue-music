# Queue Music

LAN party music queue. Your PC plays the music out loud; friends on the same
wifi/network open the app in their phones and queue YouTube songs together.

- **Central party player** — one browser tab (the host's) becomes "The Player"
  and streams audio from the server through the host's speakers.
- **Queue per user** — each friend has a personal queue and bumps songs into the
  shared party queue, credited by name.
- **Real YouTube** — search + audio extraction via yt-dlp (no API key, no ads).
- **No build step** — plain Node + Fastify + SQLite + vanilla JS frontend.

---

## Quick start

```bash
npm install                 # once
npm start -- --host         # reachable from your LAN, port 8080
```

The console prints your reachable address, e.g.:

```
Queue Music — LAN party player
  yt-dlp: found (2026.07.04)
  LAN:    http://192.168.100.184:8080
  Local:  http://127.0.0.1:8080
  Bind:   0.0.0.0:8080
```

Friends open `http://<your-lan-ip>:8080` (must be on the same network; your PC's
firewall must allow inbound on the port).

### Flags

| Flag | Meaning |
|---|---|
| `--host` | bind `0.0.0.0` (default binds 127.0.0.1 only) |
| `--port <n>` | change port (default 8080; or `$PORT`) |
| `--db <dir>` | sqlite location (default `./data`) |
| `--cache <dir>` | yt-dlp mp3 cache (default `./cache`) |

Env: `HOST`, `PORT`, `QM_SECRET` (cookie-signing secret; random per boot if unset).

## How to use it (party flow)

1. **Host:** run `npm start -- --host`, keep the tab open on your PC, click
   **Become the Player** so audio comes out of your speakers.
2. **Friends:** open the LAN URL, type a name → **Join**.
3. Anyone can search YouTube and add songs to *their* queue.
4. Press **🎉** (bump) to push a song into the party queue — it appears with
   your name.
5. The player plays the party queue top-to-bottom; **Autoplay** loops it.
   Track ends → next track starts automatically.

## Screens (mobile-first, dark theme)

- **Login** — name picker (cookie-based, no passwords).
- **Party queue** — shared playlist with "added by", skip (current row), remove.
- **Search** — YouTube search results, one tap to add to your queue.
- **My queue** — reorder (↑/↓), bump to party, remove.
- **Player bar** — live status (`preparing… / now playing / paused`), play,
  pause, next, autoplay, and the **Become the Player / YOU ARE THE SPEAKER**
  controls.

Live updates use Server-Sent Events — every tab updates instantly when someone
bumps a song or the player state changes.

## Troubleshooting

**`yt-dlp: NOT FOUND`** — `bin/yt-dlp.exe` is bundled. If it's missing, install
yt-dlp (`pip install yt-dlp`) or set `YT_DLP=/path/to/yt-dlp`. Playback needs it;
search/queue still work.

**YouTube downloads fail with HTTP 403** — the app already forces
`youtube:player_client=android`, which currently bypasses the sign-challenge.
If a new 403 appears, update yt-dlp (the version in `bin/` is from `--version`
at build time).

**Friends can't connect** — same wifi? Firewall? Try
`http://<your-ip>:8080` from the phone; check `netstat -an | findstr 8080`
shows `0.0.0.0:8080` LISTENING.

**First play is slow** — the server downloads + converts the song once
(cached in `./cache/`), typically 5–20 s depending on the video.

## Project layout

```
src/db.js        SQLite data layer (users, songs, queues, player state)
src/auth.js      signed cookie identity
src/player.js    playback state machine (idle/loading/playing/paused)
src/audio.js     yt-dlp → mp3 cache + streaming
src/search.js    YouTube search (yt-search)
src/events.js    SSE event bus
src/server.js    Fastify routes + SSE
src/cli.js       --host/--port parsing + LAN IPs
src/index.js     boot / banner
public/          SPA (no build)
test/            node:test suites — run `npm test`
docs/            PRD, TDD, action plan, logbook
```

## Tests

```bash
npm test                 # 45 unit + integration tests (no network)
```

Backend specs: `docs/PRD.md` · test design: `docs/TDD.md` · execution plan:
`docs/ACTION_PLAN.md`.