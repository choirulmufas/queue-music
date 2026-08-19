# TDD — Queue Music

Discipline: **tests-first**. Every module ships with its tests (Node built-in
`node:test`, zero extra deps). Command: `npm test` (runs `node --test test/`).
Unit tests never touch the network; yt-dlp and yt-search are injected/mocked.

---

## 1. Test Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | `node:test` | `src/db.js`, `src/auth.js`, `src/player.js`, `src/queue.js` |
| Integration | `node:test` + `fastify.inject` | Routes without network (fake search/yt) |
| E2E / manual | curl / browser on LAN | `--host` binding, audio streaming, live update |

Dependency-injection seam: modules take small function params
(`getSongById`, `searchYouTube`, `spawn`), letting tests stub real IO.

---

## 2. Unit Test Matrix (namespace → behaviors)

### `db.js`
- `t0` new DB has vendor tables & WAL mode; `player_state` row `id=1` seeded.
- `t1` `createUser` dedupes by name (returns same id).
- `t2` `addSong` upserts by `yt_id`; returns song id.
- `t3` `addToUserQueue` sets position = max+1; duplicate (user,song) rejected (policy test).
- `t4` `removeFromUserQueue` & `reorderUserQueue(ids)` keep ordering and no orphans.
- `t5` `addToPartyQueue` appends at end with `addedBy`; `removeFromPartyQueue` renumbers.
- `t6` `finishPartyItem(index)` returns next item / null when empty.
- `t7` `setPlayerState` persists `status|currentSongId|index|autoplay`; `getPlayerState` round-trips.
- `t8` `getPartySnapshot` joins author names + song metadata, ordered.

### `auth.js`
- `t10` `setCookie(loginName)` encodes; `parseCookie` round-trips.
- `t11` unsigned/forged token rejected (returns null).
- `t12` cookie + DB lookup yields `{user}`; deleted user → null.

### `player.js` (state machine, no IO)
- `t20` `play()` on non-empty queue sets `status=loading`, current=index 0.
- `t21` `onTrackEnd()` advances index; wraps? no → next; last item → `idle`.
- `t22` `next(skip=true)` same behavior; `next()` at end → `idle` + `endedQueue=true`.
- `t23` `onTrackEnd()` with `autoplay=1` wraps to index 0.
- `t24` `pause/resume` toggles status only in `playing`/`paused`.
- `t25` `claimPlayer(userToken)` broadcasts a `player-claimed` event; two tabs → last wins.
- `t26` current song exposes `audioReady` (cached) vs `loading` (being cached).

### `queue.js` (pure helpers)
- `t30` `bumpToParty(userQueueItem)` moves AND returns new party item with author.
- `t31` changing positions never leaves `position` gaps (renumber helper).
- `t32` party add at empty queue = first item index 0.

### `audio.js` (yt-dlp wrapper, spawn mocked)
- `t40` request misses cache → spawns `yt-dlp -x -f bestaudio --audio-format mp3`; on exit 0, cache hit later.
- `t41` request already cached → **no** spawn (100% cache-hit path).
- `t42` spawn failure → `AUDIO_FAILED` event + 502 on audio GET (test via route as well).
- `t43` cache dir created lazily; filenames sanitized by `yt_id`.

### `search.js` (yt-search mocked)
- `t50` `search('x')` returns ≤10 normalized `{ytId,title,channel,durationSec,thumb}`.
- `t51` yt-search throws → typed `SearchError` (500 handled by route).
- `t52` empty query → validation error (route test).

---

## 3. Integration Test Matrix (`routes.test.js`, fake IO)
Each test boots Fastify with real modules but injected fakes:
`fakeSearch` returns fixed results; `fakeCacher` returns pre-made mp3 buffer.

- `r1` **login flow**: `POST /api/login` sets cookie; `GET /api/me` maps cookie→user.
- `r2` **401 guard**: `/api/queue` without cookie → 401 JSON.
- `r3` **search**: `GET /api/search?q=bei` returns 200, shape matches `t50`.
- `r4` **add + list**: `POST /api/queue` then `GET /api/queue` → 1 item.
- `r5` **bump**: add to personal → `POST /api/party/bump` → party has 1 attributed item; personal now empty.
- `r6` **party order + remove**: `POST /api/party` x2, `DELETE` first → order renumbers (no gap).
- `r7` **player claim/play**: claim → `play` → `GET /api/player/state` shows `loading`. Then stub `onTrackEnd` → next.
- `r8` **audio 404**: `GET /api/audio/999999` → 404 (unknown song, before fake-cacher path).
- `r9` **audio OK**: pre-seed cache → `GET /api/audio/:id` → 200 `audio/mpeg`, body = mp3 fixture.
- `r10` **SSE**: open `/api/events` (inject with `EventSource` shim) → queue-add pushes `party` event.

> E2E (not in CI): see `docs/ACTION_PLAN.md` phase 10 — curl `--host`, phone/browser
> pass, `netstat -an | findstr 8080` shows `0.0.0.0:8080`.

---

## 4. Red→Green→Refactor Notes
- One failing test per commit surface; no test editing to force green except to
  fix obvious spec typos — documented inline.
- Keep `/api/audio` mapper dumb: state machine decides `currentSong`; route only
  serves bytes for a valid cached song id.

## 5. Coverage goal
`npm test` must be ≥ ~85% lines on `src/*.js` (report: `node --test --experimental-test-coverage`).