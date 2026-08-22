# Queue Music Gen Z Product Redesign Implementation Plan

> **For Hermes:** Use this plan as the implementation handoff. Execute phase-by-phase, with visual verification after each UI milestone and regression tests before changing behavior.

**Goal:** Transform Queue Music from a queue-management prototype into a social, mobile-first shared music room that a new user can understand and use without reading documentation.

**Architecture:** Preserve the existing Node.js/Fastify/vanilla JavaScript architecture and realtime SSE model. Redesign the information architecture, copy, visual system, responsive layout, and interaction states first; only introduce backend changes where the redesigned UX needs explicit room/player permissions or new metadata.

**Tech Stack:** Node.js ESM, Fastify, vanilla JavaScript, HTML, CSS, SQLite, SSE, existing audio/player services.

---

## Product direction

### Positioning

Queue Music should feel like:

> The shared aux for your room.

Primary promise:

> Search a song, add it to the room, and shape the vibe together.

Recommended working tagline:

> Drop a song. Shape the vibe.

### Primary user flow

```text
Enter room
  → see what is playing
  → search a song
  → tap Add to room
  → see position and confirmation
  → continue browsing
```

### Core product rules

1. Anyone can add a song to the shared room queue.
2. The host/speaker controls playback.
3. The host only needs one initial browser gesture to enable audio.
4. The primary UI exposes one shared queue; personal queue and bump are not part of the primary mental model.
5. Every important action has visible feedback without requiring refresh.
6. The first-time experience must be self-explanatory without a guide.

---

## Current context and constraints

- Current frontend is a vanilla JavaScript single-page interface in `public/index.html`, `public/app.js`, and `public/style.css`.
- Current backend routes and player behavior are already able to add directly to the party queue and trigger playback after the previous bugfix.
- Realtime updates use SSE through `src/events.js` and frontend handlers in `public/app.js`.
- Audio output still comes from the claimed host browser, so browser autoplay restrictions remain a real state that must be represented clearly in the UI.
- Existing personal queue routes may remain for compatibility, but they should not be presented as the default user journey.
- Do not add a frontend framework unless the current vanilla implementation becomes a measurable blocker.
- Do not change playback or queue semantics while performing visual-only milestones.

---

# Phase 0 — Baseline and design contract

## Task 0.1: Freeze a visual and behavior baseline

**Objective:** Capture the current UI and behavior before redesign work begins.

**Files:**
- Read: `public/index.html`
- Read: `public/app.js`
- Read: `public/style.css`
- Read: `src/server.js`
- Read: `src/player.js`
- Read: `test/routes.test.js`

**Actions:**

1. Run `pnpm run test`.
2. Start the app on a non-default test port.
3. Capture login, logged-in room, search results, empty queue, claimed player, loading player, and disconnected SSE states.
4. Record the baseline viewport sizes used for desktop and mobile verification.
5. Do not modify application files.

**Acceptance criteria:**

- Baseline test result is recorded.
- Screenshots or visual notes exist for all listed states.
- Existing behavior is not changed.

## Task 0.2: Define design tokens and content vocabulary

**Objective:** Establish one visual language and one vocabulary before component work starts.

**Files:**
- Create: `docs/DESIGN_SYSTEM.md`
- Create: `docs/UX_COPY.md`

**Design direction:**

- Dark nightlife interface.
- Near-black background with elevated charcoal surfaces.
- Purple primary accent plus pink/lime secondary accents.
- Large album artwork for the active track.
- Friendly geometric heading font with a neutral body font.
- Rounded but not excessively soft controls.
- Motion used for confirmation and playback state, with reduced-motion support.

**Recommended vocabulary:**

| Current label | New label |
|---|---|
| Party Queue | Up next |
| Search YouTube… | Search a song, artist, or vibe… |
| Become the Player | Take the aux |
| You are the speaker | You’re on aux |
| My Queue | Remove from primary UI; optionally rename to Your picks later |
| Bump to party | Remove from primary UI |
| Autoplay | Auto-play is on; move control to settings if retained |
| Now Playing | Playing now |
| Remove | Remove from room |
| Friends | People in room |

**Acceptance criteria:**

- Every major screen and component has documented labels.
- No primary-flow copy depends on internal terms such as bump, personal queue, claim, or player state.
- Contrast and state-color decisions are documented.

---

# Phase 1 — Information architecture and UX flow

## Task 1.1: Replace the current information hierarchy with the room model

**Objective:** Define the new page structure before styling it.

**Files:**
- Modify later: `public/index.html`
- Modify later: `public/app.js`

**Target structure:**

```text
Room header
  - room name
  - people/avatars
  - connection state
  - overflow menu

Playing now hero
  - album art
  - title, artist/channel, added by
  - playback status
  - progress indicator
  - host controls or Take the aux CTA

Find a song
  - prominent search input
  - search results

Up next
  - queue count
  - current/next states
  - added-by attribution
  - row overflow actions

Optional room activity
  - recent additions or lightweight reactions
```

**Acceptance criteria:**

- A user can identify the room, active song, primary action, and next queue from the structure alone.
- `My Queue` is not part of the default information hierarchy.
- Host controls and guest actions are visually distinct.

## Task 1.2: Document user journeys and edge states

**Objective:** Define the exact experience for first-time users, guests, and hosts.

**Files:**
- Modify: `docs/UX_COPY.md`

**Journeys to document:**

1. New user enters a room.
2. New user searches and adds a song.
3. Song is added while another song is playing.
4. Host claims the aux.
5. Another user sees a different device playing.
6. Queue is empty.
7. Search returns no results.
8. Audio is preparing.
9. Browser blocks audio until a gesture.
10. Audio download fails.
11. SSE connection drops.
12. Current user leaves the room.

**Acceptance criteria:**

- Every journey has a user-facing message and next action.
- No state ends in a dead end or unexplained spinner.

## Task 1.3: Decide playback permissions before UI implementation

**Objective:** Avoid redesigning controls around an unresolved permission model.

**Recommended decision:**

- Everyone: search, add, view queue, view current song.
- Speaker: play, pause, next, release aux.
- Optional later feature: skip voting for non-speakers.

**Files:**
- Document first: `docs/PRODUCT_DECISIONS.md`
- Possible later backend changes: `src/server.js`, `src/player.js`, `test/routes.test.js`

**Acceptance criteria:**

- Product owner confirms who can control playback.
- The UI can render guest, speaker, and unavailable-speaker states without ambiguity.

---

# Phase 2 — Login and room entry

## Task 2.1: Redesign the entry screen

**Objective:** Make entering a room feel instant, social, and branded.

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js` only if copy/state handling requires it

**Target experience:**

```text
[brand mark]
Friday Night
Drop a song. Shape the vibe.

[Your name]
[Enter the room]

3 people are already here
```

**Behavior:**

- Keep name-only entry; do not add registration.
- Preserve keyboard Enter submission.
- Focus the name input on load.
- Show inline validation without shifting the layout unexpectedly.
- Avoid exposing technical LAN terminology in the primary copy.

**Acceptance criteria:**

- A first-time user understands what to do without explanation.
- Primary CTA is visually dominant.
- Mobile layout works without vertical scrolling for the first action.
- Login error state remains accessible and visible.

## Task 2.2: Add room-presence context

**Objective:** Make the room feel alive before the user performs an action.

**Files:**
- Possible frontend-only change: `public/app.js`, `public/style.css`
- Possible data change if room name is introduced: `src/db.js`, `src/server.js`, tests

**Acceptance criteria:**

- The UI shows a meaningful people count or an intentional empty-room state.
- The user can distinguish “room is active” from “not connected.”

---

# Phase 3 — Room home and now-playing hero

## Task 3.1: Build the room header

**Objective:** Establish a clear room identity and simple navigation.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Elements:**

- Brand mark/name.
- Room name or host-derived room label.
- People count with avatars/initials where available.
- Connection indicator.
- Overflow menu for Leave, name, and future settings.

**Acceptance criteria:**

- `Leave` is no longer competing with the main action as a large top-level button.
- Connection state is visible but not alarming when healthy.
- Header remains usable on narrow screens.

## Task 3.2: Convert the fixed player bar into a now-playing experience

**Objective:** Make the active track the visual anchor of the product.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Elements:**

- Large album art on desktop.
- Compact but prominent album art on mobile.
- Track title and artist/channel.
- Added-by attribution.
- Status labels: `Preparing`, `Playing now`, `Paused`, `Nothing playing`.
- Progress indicator if reliable state is available.
- Host controls only when current user is speaker.
- `Take the aux` CTA when no speaker is active.
- `Playing from <name>’s device` when another user is speaker.

**Acceptance criteria:**

- The user can tell what is playing and where it is playing from.
- The speaker CTA explains its purpose without a guide.
- The player does not obscure primary content on small viewports.
- Browser autoplay failures have a human-readable recovery action.

## Task 3.3: Simplify playback controls

**Objective:** Remove technical controls from the default guest experience.

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`
- Possible behavior tests: `test/routes.test.js`

**Acceptance criteria:**

- Guests do not see controls they cannot use.
- The speaker has clear play/pause/next controls.
- Autoplay is enabled by default and is not presented as a required setup step.
- If an autoplay setting remains, it is secondary and clearly explained.

---

# Phase 4 — Search and add flow

## Task 4.1: Make search the primary action

**Objective:** Reduce the path from room entry to song addition to one obvious interaction.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Target copy:**

```text
What should we play next?
Search a song, artist, or vibe…
```

**Acceptance criteria:**

- Search is visible without scrolling on desktop and mobile.
- Enter submits search.
- Search loading state is visible.
- Empty query and backend errors are handled inline or with a clear toast.

## Task 4.2: Redesign search result cards

**Objective:** Make add-to-room action immediately discoverable.

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

**Elements:**

- Album art.
- Track title.
- Artist/channel.
- Duration badge.
- Explicit `Add to room` action on mobile or clear plus button with accessible label.
- Disabled/confirmed `Added` state.
- Optimistic or near-immediate feedback.

**Acceptance criteria:**

- User knows exactly where to tap to add.
- Add result shows queue position if available.
- Duplicate/error states do not falsely show success.
- Result cards meet minimum 44px tap-target requirements.

## Task 4.3: Add confirmation and queue-position feedback

**Objective:** Confirm that the user’s action affected the shared room.

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`
- Possible API response enhancement: `src/server.js`, `src/db.js`, `test/routes.test.js`

**Target feedback:**

```text
Added to the room
You’re #4 in line
```

**Acceptance criteria:**

- Confirmation is visible for at least one meaningful moment.
- Queue updates arrive through existing realtime behavior.
- The user does not need to reload the page to see the new item.

---

# Phase 5 — Queue redesign

## Task 5.1: Rename and simplify the shared queue

**Objective:** Make one shared queue the default mental model.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Target label:**

```text
Up next · N songs
```

**Acceptance criteria:**

- The primary UI no longer presents `My Queue` or `Bump to party`.
- Queue rows show position, title, source, and added-by attribution.
- Current song is visually separated from upcoming songs.
- Removing a song has a reversible or clearly confirmable interaction.

## Task 5.2: Define queue permissions and actions

**Objective:** Prevent destructive or confusing controls from appearing to everyone.

**Files:**
- Document: `docs/PRODUCT_DECISIONS.md`
- Possible backend authorization: `src/server.js`, `src/player.js`
- Tests: `test/routes.test.js`

**Recommended initial policy:**

- Any user can add.
- Speaker can skip.
- Room owner or speaker can remove any item.
- User can remove their own pending item.

**Acceptance criteria:**

- UI matches server permission behavior.
- Unauthorized actions return a clear message rather than silently failing.
- Existing regression tests remain green.

## Task 5.3: Implement empty, loading, and error queue states

**Objective:** Make every queue state instructive.

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

**Target empty copy:**

```text
The room is quiet 👀
Add the first song and set the mood.
[Find a song]
```

**Acceptance criteria:**

- Empty state contains a useful next action.
- Loading and error states are not confused with an empty queue.
- The fixed player does not cover the queue CTA.

---

# Phase 6 — Visual system and responsive behavior

## Task 6.1: Implement the new design token layer

**Objective:** Replace the flat prototype styling with a cohesive nightlife visual system.

**Files:**
- Modify: `public/style.css`
- Reference: `docs/DESIGN_SYSTEM.md`

**Token categories:**

- Colors.
- Typography scale.
- Spacing.
- Border radii.
- Elevation.
- Focus rings.
- Motion durations.
- Breakpoints.

**Acceptance criteria:**

- Components use shared tokens rather than one-off values.
- Text contrast meets WCAG AA for normal text where practical.
- Focus states are visible for keyboard users.
- Reduced-motion preference disables nonessential animation.

## Task 6.2: Add responsive layouts for guest mobile and host desktop

**Objective:** Make the app comfortable on both phone requesters and host screens.

**Files:**
- Modify: `public/style.css`
- Modify: `public/index.html` if DOM order needs responsive restructuring

**Mobile priorities:**

- Search and add action reachable near the top.
- Single-column cards.
- Bottom player does not cover content.
- Minimum 44px tap targets.
- Queue actions moved into row overflow.

**Desktop priorities:**

- Larger now-playing hero.
- Queue and search can share horizontal space if it improves scanning.
- Host controls stay visible.
- Content width remains readable rather than stretching across the entire viewport.

**Acceptance criteria:**

- Verify at minimum 375px, 768px, and 1440px widths.
- No horizontal scrolling.
- No fixed element covers an actionable control.
- Long titles truncate without breaking the layout.

## Task 6.3: Add social presence and lightweight motion

**Objective:** Make room activity feel shared without adding noisy complexity.

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

**Candidate interactions:**

- Avatar/inital presence.
- New song row slide-in.
- Short added confirmation glow.
- Playback equalizer/pulse.
- Toast for speaker changes.

**Acceptance criteria:**

- Motion communicates state change rather than decoration only.
- Reduced-motion mode remains fully usable.
- SSE updates are visibly reflected without page refresh.

---

# Phase 7 — Documentation, QA, and rollout

## Task 7.1: Update product and UX documentation

**Objective:** Keep the repository documentation aligned with the redesigned product.

**Files:**
- Modify: `docs/PRD.md` if present or create it if still absent
- Modify: `docs/TDD.md` if present or create it if still absent
- Modify: `docs/ACTION_PLAN.md` only if the project wants a user-facing copy of this plan
- Create/maintain: `docs/DESIGN_SYSTEM.md`
- Create/maintain: `docs/UX_COPY.md`
- Create/maintain: `docs/PRODUCT_DECISIONS.md`

**Acceptance criteria:**

- New contributors can understand the product flow without reverse-engineering the UI.
- Documentation does not describe personal queue/bump as the primary flow.
- Technical autoplay limitations are documented separately from user-facing copy.

## Task 7.2: Add frontend smoke and interaction verification

**Objective:** Verify the redesigned UI behavior, not just backend routes.

**Files:**
- Existing: `test/routes.test.js`
- Possible new: `test/frontend.test.js` or browser smoke script, depending on project conventions

**Verification scenarios:**

1. Login with a valid name.
2. Search a query.
3. Add a result directly to the shared room.
4. See confirmation and queue update.
5. Claim aux with a non-empty queue.
6. Observe preparing → playing state.
7. Open a second client and see realtime queue/player updates.
8. Verify guest does not see inappropriate host-only controls.
9. Verify disconnected SSE state.
10. Verify mobile keyboard and tap-target behavior.

**Commands:**

```bash
pnpm run test
pnpm run lint
```

If no lint script exists, use the repository's available syntax checks and browser smoke process instead of inventing a new toolchain.

**Acceptance criteria:**

- All existing tests pass.
- New behavior tests pass.
- No uncaught browser console errors.
- All primary flows can be completed without documentation.

## Task 7.3: Dogfood with real users

**Objective:** Validate whether the redesign is understandable to people who did not participate in development.

**Test script:**

Give a new tester only this instruction:

```text
Join this room and add a song you want to hear.
```

Observe without helping:

- Time until they identify the search field.
- Whether they understand `Add to room`.
- Whether they look for a personal queue.
- Whether they understand who controls sound.
- Whether they notice their song entered the queue.
- Whether they can recover from browser audio permission behavior.

**Acceptance criteria:**

- At least 4 of 5 testers complete the primary flow without help.
- No tester needs to learn the words `bump`, `claim`, or `player` to succeed.
- Top confusion points are converted into copy or UI improvements.

## Task 7.4: Roll out in low-risk slices

**Objective:** Avoid changing visual design and playback behavior simultaneously without checkpoints.

**Recommended rollout order:**

1. Copy and terminology cleanup.
2. Remove My Queue/bump from primary UI.
3. Search and add interaction redesign.
4. Queue and empty-state redesign.
5. Now-playing and speaker-mode redesign.
6. Visual tokens and motion polish.
7. Optional social features.

**Acceptance criteria:**

- Each slice can be verified independently.
- A failed visual experiment can be reverted without reverting the autoplay fix.
- No database migration is introduced unless a documented product decision requires it.

---

# Files likely to change

## Primary frontend files

- `public/index.html`
- `public/app.js`
- `public/style.css`

## Documentation

- `.hermes/plans/2026-08-22_191758-gen-z-product-redesign.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/UX_COPY.md`
- `docs/PRODUCT_DECISIONS.md`
- `docs/PRD.md` if the product requirements document is restored
- `docs/TDD.md` if the testing document is restored

## Possible backend files, only if product decisions require behavior changes

- `src/server.js`
- `src/player.js`
- `src/db.js`
- `src/events.js`
- `test/routes.test.js`

Do not modify backend files for a visual-only milestone.

---

# Definition of done

The redesign is ready for release when:

- A new user can join and add a song without reading a guide.
- The shared queue is the only queue concept visible in the primary flow.
- Search is clearly the main action.
- The now-playing track is visually dominant and understandable.
- The speaker/aux state is obvious.
- Host-only controls are not confusingly shown to guests.
- Empty, loading, error, and disconnected states have useful recovery actions.
- The UI works at 375px, 768px, and 1440px widths.
- Tap targets and focus states are accessible.
- Realtime updates are visible without refresh.
- `pnpm run test` passes with zero failures.
- Browser smoke testing reports no uncaught JavaScript errors.
- At least four of five new testers complete the primary flow without assistance.

---

# Open product decisions before implementation

1. Should the product keep the name `Queue Music`, or move to a more social name such as `VibeQueue` or `Aux Room`?
2. Should a room have a human-readable name?
3. Should anyone be allowed to remove any queue item, or only the speaker/owner?
4. Should non-speakers be able to vote to skip?
5. Should duplicate songs be allowed, merged, or shown as request counts?
6. Should the old personal queue remain accessible in a secondary menu for power users?
7. Should people in the room be anonymous names, initials, or avatars?
8. Is the primary language English, Indonesian, or localized per room?
9. Should the host be automatically suggested as the aux device, or must they explicitly claim it?
10. Is the target first release optimized primarily for mobile guests, desktop host, or equal priority?

---

# Recommended first implementation slice

Start with the smallest high-impact slice:

1. Remove `MY QUEUE` and `Bump to party` from the primary interface.
2. Rename `PARTY QUEUE` to `UP NEXT`.
3. Make search the first prominent action after the room header.
4. Replace `Become the Player` with `Take the aux` and clearer speaker states.
5. Add explicit `Added to the room` feedback.
6. Redesign empty states.
7. Verify with `pnpm run test`, browser smoke testing, and one new-user dogfood session.

This slice changes the mental model before investing in visual polish, making it the highest-value and lowest-risk starting point.
