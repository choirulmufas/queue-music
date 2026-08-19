import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDB } from '../src/db.js'

function seeded() {
  const db = createDB()
  const alice = db.createUser('alice')
  const bob = db.createUser('bob')
  const s1 = db.addSong({ ytId: 'A', title: 'Song A', channel: 'Ch', durationSec: 10, addedBy: alice.id })
  const s2 = db.addSong({ ytId: 'B', title: 'Song B', channel: 'Ch', durationSec: 20, addedBy: bob.id })
  return { db, alice, bob, s1, s2 }
}

test('t0 new DB has tables; player_state seeded idle', () => {
  const { db } = seeded()
  const state = db.getPlayerState()
  assert.equal(state.status, 'idle')
  assert.equal(state.index, 0)
  assert.equal(state.autoplay, false)
  assert.equal(state.currentSong, null)
})

test('t1 createUser dedupes by name', () => {
  const { db } = seeded()
  const again = db.createUser('alice')
  assert.equal(again.id, 1)
  assert.equal(again.name, 'alice')
})

test('t2 addSong upserts by yt_id', () => {
  const { db } = seeded()
  const again = db.addSong({ ytId: 'A', title: 'Renamed', channel: 'X' })
  assert.equal(again.id, 1)
  assert.equal(db.getSong('A').title, 'Renamed')
})

test('t3 addToUserQueue uses max+1 and rejects dup per user', () => {
  const { db, alice, s1 } = seeded()
  const a = db.addToUserQueue(alice.id, s1.id)
  const b = db.addToUserQueue(alice.id, s1.id)
  assert.equal(a.duplicate, false)
  assert.equal(b.duplicate, true)
  assert.equal(a.id, b.id)
  assert.equal(db.getUserQueue(alice.id).length, 1)
})

test('t4 remove & reorder keep order, no orphans', () => {
  const { db, alice, s1, s2 } = seeded()
  db.addToUserQueue(alice.id, s1.id)
  db.addToUserQueue(alice.id, s2.id)
  const q = db.getUserQueue(alice.id)
  const reversed = db.reorderUserQueue(alice.id, [q[1].id, q[0].id])
  assert.deepEqual(reversed.map((x) => x.song.ytId), ['B', 'A'])
  assert.ok(db.removeFromUserQueue(q[0].id, alice.id))
  assert.equal(db.getUserQueue(alice.id).length, 1)
})

test('t5 party add appends; remove renumbers', () => {
  const { db, alice, bob, s1, s2 } = seeded()
  const p1 = db.addToPartyQueue(s1.id, alice.id)
  const p2 = db.addToPartyQueue(s2.id, bob.id)
  assert.equal(p1.position, 0)
  assert.equal(p2.position, 1)
  const before = db.getPartyQueue()
  assert.equal(before[0].song.ytId, 'A')
  assert.equal(before[0].addedBy.name, 'alice')
  db.removePartyItem(p1.id)
  const after = db.getPartyQueue()
  assert.equal(after.length, 1)
  assert.equal(after[0].position, 0)
  assert.equal(after[0].song.ytId, 'B')
})

test('t6 partyAtPosition returns next or null', () => {
  const { db, s1, s2 } = seeded()
  db.addToPartyQueue(s1.id, null)
  db.addToPartyQueue(s2.id, null)
  assert.equal(db.partyAtPosition(0).song.ytId, 'A')
  assert.equal(db.partyAtPosition(1).song.ytId, 'B')
  assert.equal(db.partyAtPosition(2), null)
})

test('t7 setPlayerState round-trips', () => {
  const { db, s1 } = seeded()
  db.setPlayerState({ status: 'playing', currentSongId: s1.id, index: 0, autoplay: true, positionSec: 42 })
  const state = db.getPlayerState()
  assert.equal(state.status, 'playing')
  assert.equal(state.currentSong.ytId, 'A')
  assert.equal(state.index, 0)
  assert.equal(state.autoplay, true)
  assert.equal(state.positionSec, 42)
})

test('t8 getPartySnapshot ordered with authors', () => {
  const { db, alice, s1, s2 } = seeded()
  db.addToPartyQueue(s2.id, alice.id)
  db.addToPartyQueue(s1.id, alice.id)
  const q = db.getPartyQueue()
  assert.deepEqual(q.map((x) => x.song.ytId), ['B', 'A'])
  assert.ok(q.every((x) => x.addedBy?.name === 'alice'))
  assert.deepEqual(q.map((x) => x.position), [0, 1])
})

test('reorder rejects mismatched ids', () => {
  const { db, alice, s1, s2 } = seeded()
  db.addToUserQueue(alice.id, s1.id)
  db.addToUserQueue(alice.id, s2.id)
  assert.throws(() => db.reorderUserQueue(alice.id, [999, 123]), /must match/)
})