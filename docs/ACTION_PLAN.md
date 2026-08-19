# ACTION_PLAN — Queue Music

Executed as synchronous phases. Each phase = verifiable exit criteria.
Sign-off per phase documented in `docs/LOGBOOK.md`.

---

## Phase 0 — Scaffold (exit: `npm install` clean, `npm test` runs 0 tests OK)
- `package.json` (type:module, scripts `start`, `dev`, `test`).
- Deps: `fastify`, `@fastify/cookie`, `@fastify/static`, `better-sqlite3`, `yt-search`.
- Dev: none extra (node:test built-in).
- Install **yt-dlp** (pip `yt-dlp`; verify `yt-dlp --version`).
- Folder tree: `src/`, `public/`, `test/`, `data/`, `cache/`, `docs/`, `bin/`.
- `docs/LOGBOOK.md` created.

## Phase 1 — Core domain modules + unit tests (TDD, red→green)
- `src/db.js`       (t0–t8)
- `src/auth.js`     (t10–t12)
- `src/player.js`   (t20–t26)
- `src/queue.js`    (t30–t32)
- `src/search.js`   (t50–t52)
- `src/audio.js`    (t40–t43)
Exit: `npm test` green for all unit matrices.

## Phase 2 — HTTP surface + integration tests (r1–r10)
- `src/server.js` builds Fastify app with widgets:
  auth, queue, party, player, search, audio, sse, static + login page.
- `test/routes.test.js` with fake search + fake cacher.
- Add `README` scaffold referencing run commands.
Exit: all r-tests green via `fastify.inject`.

## Phase 3 — CLI + boot (FR-1)
- `src/cli.js` parses `--host`, `--port` (also `HOST`/`PORT` env).
- `src/index.js` boot: db init → audio cache dir → listen → print LAN banner.
- `--host` → bind `0.0.0.0`; else `127.0.0.1`. Print public v4 addresses.
Exit: `node src/index.js --host --port 8080` prints `http://192.168.100.184:8080`; `netstat` shows 0.0.0.0:8080.

## Phase 4 — Frontend (agent-executed, API contract from Phases 1–3)
- Static SPA in `public/`: login → home (search, my queue, party queue, player bar).
- SSE listener updates live; player tab special "SPEAKER" view with claim button.
Exit: browser pass on `http://127.0.0.1:8080` (manual checklist) — styles mobile-first.

## Phase 5 — Real YouTube + yt-dlp integration (FR-3/6/7 real IO)
- Replace fakes in routes with real `yt-search` + real `audio.js` cacher.
- Manual: search real terms, add real songs, play, confirm audio via VLC/browser.
Exit: real search works; `/api/audio/:ytId` serves mpeg; gateway requests on LAN.

## Phase 6 — E2E hardening on LAN (acceptance §8)
- Test from second LAN device (phone); SSE live update ≤2 s; autoplay wrap.
- Handle yt-dlp first-cache latency UX ("Preparing…" state).
- `netstat` 0.0.0.0 binding confirm.
Exit: all 8 acceptance criteria pass. LOGBOOK updated.

## Phase 7 — Polish & docs
- README (features, install, run, LAN usage, troubleshooting yt-dlp).
- Wrap-up: `npm test` green, coverage report saved.
Exit: final review checklist in LOGBOOK.