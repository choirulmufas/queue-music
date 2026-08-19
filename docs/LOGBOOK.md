# LOGBOOK — Queue Music

Execution log. Updated per completed phase.

| Phase | Status | Date | Notes |
|---|---|---|---|
| 0 Scaffold | ✅ | 2026-08-19 | npm install clean (180 pkgs); better-sqlite3 native OK; yt-dlp 2026.07.04 copied to bin/ |
| 1 Core modules (TDD) | ✅ | 2026-08-19 | db/auth/player/queue/search/audio; 36 unit tests green. Fixes: reserved word `index`, boolean bind, addSong snake_case→camelCase |
| 2 HTTP surface | ✅ | 2026-08-19 | server.js + routes.test.js; 45 tests green. Fix: inject set-cookie is a string; SSE close semantics |
| 3 CLI + boot | ✅ | 2026-08-19 | --host binds 0.0.0.0:8080, prints LAN banner (192.168.100.184, 172.20.160.1); yt-dlp probe at boot |
| 4 Frontend | ✅ | 2026-08-19 | agent-built SPA (index.html/style.css/app.js); added SSE reconnect after login so users register online |
| 5 Real YouTube + yt-dlp | ✅ | 2026-08-19 | search real OK ('Surfin Bird'); yt-dlp 403 fixed via `youtube:player_client=android`; audio E2E 200 audio/mpeg |
| 6 E2E on LAN | ✅ | 2026-08-19 | verified over 192.168.100.184:8080: index/assets 200, SSE streams meta/party/player, full flow login→search→add→bump→play→audio 5.7MB |
| 7 Polish & docs | ✅ | 2026-08-19 | README written; coverage 96% lines / 88.7% branch; 45 tests green |

## Debug notes (durable)
- `--test test/` fails on Windows: use `node --test test/*.test.js`.
- Fastify v5 `inject()` `set-cookie` header is a **string**, not array.
- Fastify v5 `app.listen()` resolves to a **URL string**, not a server object.
- yt-dlp 2026 on Win + Python 3.10: default clients 403. Working args:
  `--extractor-args youtube:player_client=android -f bestaudio/best -x --audio-format mp3`.
- better-sqlite3 cannot bind booleans — coerce with `+Boolean()`.
- SQLite `index` is reserved → use `position_index`.