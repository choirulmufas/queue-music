# Queue Music Product Decisions

Status: working decisions for the Gen Z redesign. Revisit open questions before implementing behavior changes.

## Confirmed direction

1. Queue Music is a shared social music room, not a personal queue manager.
2. The primary user flow is `search → add to room → see queue position`.
3. The primary UI exposes one shared queue called `Up next`.
4. The old personal queue and bump concepts are not part of the primary UX.
5. The host browser remains the audio output device.
6. The host needs one initial user gesture to enable browser audio; the UI must explain this in human language.
7. Realtime queue/player updates remain important and should not require refresh.
8. The visual direction is dark nightlife with restrained neon accents.
9. Mobile guest usage and desktop host usage are both first-class contexts.

## Recommended permissions

Initial recommendation:

- All room members: search, add songs, see now playing, see Up next.
- Speaker: play, pause, next, and release aux.
- Member who added a pending song: may remove their own pending item.
- Room owner/speaker: may remove any pending item.
- Future option: non-speakers can request or vote to skip.

This permission model must be confirmed before changing server authorization behavior.

## Recommended defaults

- Autoplay is on by default.
- Direct add to the shared room is the default action.
- A single shared queue is the default mental model.
- No registration or password is required for the LAN room flow.
- User-facing copy avoids `claim`, `player`, `bump`, and technical autoplay terminology.

## Open questions

1. Keep the product name `Queue Music`, or use a more social name such as `VibeQueue` or `Aux Room`?
2. Should a room have a human-readable name, or should the first version use a host-derived label?
3. Should duplicate songs be allowed, merged, or shown as request counts?
4. Should non-speakers vote to skip, request a skip, or have no skip action?
5. Should anonymous users use names, initials, or avatars?
6. Should the old personal queue remain accessible in a secondary menu for power users?
7. Should the interface be English-only initially or support Indonesian copy?
8. Should the host be suggested automatically or must they explicitly choose `Take the aux`?

## Non-goals for the first redesign slice

- Replacing the existing frontend framework architecture.
- Adding a full account system.
- Adding playlists, recommendations, or persistent cloud rooms.
- Changing the audio extraction provider.
- Rewriting the realtime transport.
- Adding social reactions before the add/search/now-playing flow is clear.
