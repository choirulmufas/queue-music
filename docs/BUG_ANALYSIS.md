# Bug Analysis — Queue Music

**Reported by:** user
**Date:** 2026-08-19

---

## Bug 1: "It should be automated to play"

### Symptom
When the host opens the app and becomes the player, nothing starts playing
automatically. The host must manually click "Play" every time.

### Expected behavior
Once the party queue has songs AND a player is claimed, playback should start
automatically (or at least prompt the user once).

### Root cause analysis
`src/player.js:29` — `play()` is only called when:
1. The host clicks the "Play" button in the UI (`POST /api/player/play`)
2. The player tab manually triggers `ctlPlay()` in `app.js:408`

There is **no automatic trigger** for `play()`. The server never calls
`play()` on its own when songs appear in the party queue or when a player is
claimed. The client-side `claim()` function (app.js:397) calls `loadPlayer()`
then `tryPlayNow()`, but `tryPlayNow()` only plays if the audio is already
loaded — it doesn't call the server's `POST /api/player/play`.

**Fix location:** `src/server.js` — the `POST /api/player/claim` route should
call `player.play()` after claiming. Or `app.js` `claim()` should call
`POST /api/player/play` after claiming.

**Fix location 2:** `src/server.js` — when a song is bumped to party AND the
player is in `idle` status, auto-start playback:
```
bump route → emitParty() → if player.status === 'idle' AND claimedBy exists → player.play()
```

### Complexity: LOW

---

## Bug 2: "When queuing music, it's auto to play, not necessary to bump into queue"

### Symptom
The user flow requires TWO steps: (1) add song to personal queue, (2) bump to
party queue. The user wants ONE step: search → add → it appears in the party
queue directly.

### Expected behavior
When a user searches and taps "+", the song should go straight into the party
queue (not a personal queue). The "bump" step is an unnecessary intermediate.

### Root cause analysis
**By design** (PRD §5 FR-4/FR-5), the system has:
- Personal queue: each user's private list
- Party queue: shared list that the player plays

The design assumed a "personal queue = wishlist" + "party queue = shared queue"
two-tier model. The user sees this as unnecessary friction — they want to just
add songs and hear them.

**Fix options:**

**Option A (simplest, recommended):** Change the "+" button in `app.js` to call
`POST /api/party` (direct to party) instead of `POST /api/queue` (personal
queue). Then hide or repurpose the personal queue section entirely. This is a
frontend-only change.

**Option B:** Keep both queues but auto-bump on add. In `app.js`, after a
successful `POST /api/queue`, immediately call `POST /api/party/bump`. This
preserves the personal queue for re-adding later but makes the UX feel instant.

**Option C (hybrid):** "+" sends to party queue directly; the personal queue
becomes a "history" of what the user has played (read-only view).

### Recommended: Option A
Simplest, removes the most friction. Personal queue can be removed from the
frontend entirely. The backend routes stay (API compat), just the UI changes.

### Complexity: LOW (frontend-only)

---

## Bug 3: "When queueing, it must be refreshed for playing again"

### Symptom
After a song is bumped to the party queue, the player tab doesn't start
playing it automatically. The player must be refreshed (page reload) to pick
up the new song.

### Expected behavior
When a new song appears in the party queue AND the player is in `idle` state,
it should automatically start playing the next song.

### Root cause analysis
**The SSE `player` event chain is broken for idle→loading transitions.**

Here's the flow:
1. User bumps a song → `bump route` → `db.addToPartyQueue()` → `emitParty()`
2. SSE pushes `party` event to all tabs (new queue list appears)
3. The player tab renders the updated party queue ✓
4. **BUT** the player state is still `idle` — nothing tells the player to start
5. The player tab only plays when it receives a `player` SSE event with
   `status !== 'idle'` — but the `party` event doesn't trigger a player state
   change

**The gap:** `emitParty()` sends the party list but does NOT check if the
player should start. `player.play()` is never called.

**Also:** `syncAudio()` in `app.js:69` only reacts to player state changes,
not party queue changes. When the party list updates (via `party` SSE event),
`renderParty()` runs but `syncAudio()` is NOT called.

**Fix locations:**
1. `src/server.js` — after `emitParty()` in bump/party-add routes, check
   `if player.getState().status === 'idle' && player.claimedBy → player.play()`
2. `app.js` — in the `party` SSE handler, also call `syncAudio()` or check
   if the player should start

**The real root cause is design-level:** The server doesn't have a "watcher"
that says "if party queue is non-empty AND player is idle AND someone claimed
→ auto-play". This is the same gap as Bug 1.

### Complexity: LOW (same root cause as Bug 1)

---

## Summary of All 3 Bugs

| Bug | Root Cause | Fix |
|---|---|---|
| Auto-play on join | No auto-play trigger when claim + songs exist | Add `player.play()` in claim route OR claim handler |
| Direct to party (no bump step) | Frontend adds to personal queue, requires bump | Change "+" to POST /api/party directly (frontend only) |
| Need refresh to play new songs | No auto-play when party queue gets songs while idle | After emitParty, check idle+claimed → play() |

**Bugs 1 & 3 share the same root cause:** The server never auto-starts
playback. The fix is to add a single helper function:
```
function maybePlay() {
  const st = player.getState()
  if (st.status === 'idle' && player.claimedBy && player.db.partyCount() > 0) {
    player.play()
  }
}
```
Call `maybePlay()` after:
- `POST /api/player/claim`
- `POST /api/party` (add)
- `POST /api/party/bump`

**Bug 2 is independent:** purely a frontend routing change (or a post-add
auto-bump helper).

---

## Recommended Fix Order

1. **Add `maybePlay()` helper in `src/player.js` or `src/server.js`** — fixes
   bugs 1 AND 3 in one change
2. **Call `maybePlay()` in relevant server routes** — claim, party add, bump
3. **Change frontend "+" to POST /api/party directly** — fixes bug 2
4. **Or:** add a `POST /api/queue-and-bump` convenience endpoint that does
   both in one round-trip (alternative to frontend-only fix)
