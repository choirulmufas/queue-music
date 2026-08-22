# Queue Music UX Copy

This document is the source of truth for user-facing terminology during the redesign.

## Voice

- Short, friendly, direct.
- Conversational instead of technical.
- Social without forcing slang.
- Explain what happens next.
- Do not require users to understand `queue`, `claim`, `player`, `bump`, or autoplay internals.

## Primary vocabulary

| Internal/current term | User-facing term |
|---|---|
| Party queue | Up next |
| Search YouTube | Find a song |
| Search YouTube… | Search a song, artist, or vibe… |
| Become the Player | Take the aux |
| You are the speaker | You're on aux |
| Playing on another tab | Playing from `<name>`'s device |
| My queue | Do not show in primary flow |
| Bump to party | Do not show in primary flow |
| Autoplay | Auto-play is on; secondary/settings only |
| Now playing | Playing now |
| Remove | Remove from room |
| Friends | People in room |
| Leave | Leave room |

## Login / room entry

### Preferred

```text
Queue Music
Drop a song. Shape the vibe.
Your name
Enter the room
```

### Optional presence line

```text
Join the room and pick what plays next.
```

### Validation

```text
Enter a name to join.
That name is too long.
```

## Room header

```text
Friday Night
3 people in the room
```

If no room name exists yet:

```text
This room
```

Connection states:

```text
Connected
Connection lost — trying again
Back online
```

## Playing now

```text
PLAYING NOW
Nothing playing yet
Be the first to set the vibe.
```

Speaker states:

```text
Take the aux
You're on aux
Playing from Daffa's device
Tap once to enable sound on this device
```

Playback preparation:

```text
Getting the track ready…
Almost there…
```

Playback errors:

```text
This track couldn't be played.
Try another version?
```

## Search

Heading:

```text
What should we play next?
```

Placeholder:

```text
Search a song, artist, or vibe…
```

Search states:

```text
Search for a song, artist, or vibe.
No matches this time.
Try a different title or artist.
Searching…
Search is temporarily unavailable. Try again.
```

Result actions:

```text
Add to room
Added
Adding…
```

Confirmation:

```text
Added to the room
You're #4 in line
```

## Up next

Heading:

```text
Up next · 4 songs
```

Empty state:

```text
The room is quiet 👀
Add the first song and set the mood.
Find a song
```

Queue attribution:

```text
Added by Daffa
```

Queue actions:

```text
Skip
Remove from room
```

## People / social context

```text
1 person in the room
3 people vibing
You're here
```

Do not show fake activity, fake metrics, or invented engagement counts.

## Leave / secondary actions

```text
Leave room
Change name
Room settings
```

Confirmation:

```text
Leave this room?
You can join again with the room link/address.
```

## Error and recovery principles

Every error must answer:

1. What happened?
2. Can the user recover?
3. What should they do next?

Avoid exposing:

```text
yt-dlp exit code
HTTP 500
SSE failure
player_state idle
```

unless shown in a developer/debug view.
