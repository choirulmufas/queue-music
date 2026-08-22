# Queue Music Design System

## Product posture

Queue Music is the shared aux for a room: people search for songs, add them to one shared queue, and shape the soundtrack together.

Working tagline:

> Drop a song. Shape the vibe.

The interface should feel energetic, social, immediate, and easy to understand without documentation.

## Design principles

1. **One room, one queue** — do not expose internal queue mechanics in the primary flow.
2. **Show the next action** — every empty, loading, error, or permission state must explain what to do next.
3. **Make the vibe visible** — album art, presence, attribution, and playback state carry more meaning than dense controls.
4. **Guests add; the speaker controls** — separate contribution actions from host playback controls.
5. **Mobile first** — guest users are likely on phones; the host may use a desktop browser.
6. **Feedback is part of the action** — adding a song must visibly confirm success and position.
7. **Motion explains state** — use animation for add, queue, and playback transitions; respect reduced motion.

## Visual direction

Dark nightlife UI with controlled neon accents. Avoid generic dashboard styling, excessive gradients, and decorative cards without hierarchy.

### Color tokens

```text
--bg: #0B0B10
--surface: #15151D
--surface-elevated: #20202B
--surface-highlight: #282838
--border: #30303D
--text: #F7F7FA
--text-muted: #A4A4B2
--accent: #A970FF
--accent-strong: #C08BFF
--accent-pink: #FF6B9D
--accent-lime: #B8F25A
--success: #61E294
--warning: #FFC857
--danger: #FF6B6B
--focus: #D8B4FE
```

Use purple as the primary action color. Use lime for healthy/active states, amber for preparing/warnings, pink for social emphasis, and red only for destructive states.

### Typography

Preferred direction:

- Heading: Space Grotesk or Sora, semibold/bold.
- Body: DM Sans or Inter, regular/medium.
- Small state/position labels: system sans or a restrained mono font.

Do not use uppercase section labels as the default hierarchy. Prefer conversational labels such as `Playing now`, `Find a song`, and `Up next`.

### Spacing

Use a 4px base scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Page gutters:

- Mobile: 16px.
- Tablet: 24px.
- Desktop: 32px.

Readable content max width: approximately 960px. Do not stretch the primary room experience across the full desktop viewport.

### Shape and elevation

- Standard control radius: 12px.
- Card radius: 18px.
- Pill radius: 999px.
- Avoid applying the same card treatment to every section; use spacing and type to establish hierarchy.
- Use low-contrast borders and restrained shadows rather than heavy glassmorphism.

### Interaction requirements

- Minimum interactive target: 44px by 44px.
- Every icon-only control needs an accessible label and tooltip/title where appropriate.
- Every keyboard-focusable control needs a visible focus ring.
- Never communicate state with color alone.
- Long song titles must truncate gracefully.
- Destructive removal should have confirmation or undo feedback.

### Motion

Default motion should be short and purposeful:

- Tap feedback: 120–180ms.
- Toast entrance: 180–240ms.
- Queue insertion: 220–320ms.
- Playback pulse: subtle and optional.

Under `prefers-reduced-motion: reduce`, remove nonessential transitions and looping animation.

## Component posture

### Room header

Show room identity, people/presence, connection state, and secondary actions. `Leave` should not compete with the primary song action.

### Playing now

The active song is the visual anchor. Show artwork, title, artist/channel, added-by attribution, status, and speaker context.

### Search

Search is the primary contribution action. Copy should ask what the room should play rather than mention YouTube internals.

### Up next

Use one shared queue. Show queue count, position, current/upcoming distinction, and attribution. Keep row actions secondary.

### Speaker state

Use human language:

- No speaker: `Take the aux`.
- Current speaker: `You're on aux`.
- Other speaker: `Playing from <name>'s device`.
- Browser gesture required: `Tap once to enable sound on this device`.

### Toasts

Toasts should confirm outcomes, not expose implementation details:

- `Added to the room`.
- `You're #4 in line`.
- `Removed from the room`.
- `Connection lost — trying again`.

## Responsive priorities

### Guest mobile

Prioritize search, add, now playing, queue visibility, and people/presence. Keep host controls secondary or hidden for non-speakers.

### Host desktop

Prioritize a larger now-playing surface, visible queue, speaker controls, and connection state.

At 375px, 768px, and 1440px widths there must be no horizontal scrolling and no fixed player element covering an actionable control.
