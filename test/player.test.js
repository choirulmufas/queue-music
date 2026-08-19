import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDB } from '../src/db.js'
import { PlaybackManager } from '../src/player.js'
import { EventBus } from '../src/events.js'

function setup({ withAudio = true } = {}) {
  const db = createDB()
  const bus = new EventBus()
  const events = []
  bus.subscribe((e) => events.push(e.type + ':' + (e.state ? e.state.status : e.msg ?? '')))
  const alice = db.createUser('alice')
  const bob = db.createUser('bob')
  const s1 = db.addSong({ ytId: 'A', title: 'A', thumb: '' })
  const s2 = db.addSong({ ytId: 'B', title: 'B', thumb: '' })
  const resolves = new Set()
  const audio = {
    ensure: async (song) => ({ ready: resolves.has(song.ytId) }),
    tracksEnsured: [],
    ensureTracked(song) {
      audio.tracksEnsured.push(song.ytId)
      return audio.ensure(song)
    },
  }
  const realAudio = {
    ensure: (song) => { audio.tracksEnsured.push(song.ytId); return audio.ensure(song) },
  }
  const player = new PlaybackManager({ db, bus, audio: withAudio ? realAudio : null })
  return { db, bus, player, alice, bob, s1, s2, events, resolves, audio }
}

function seedParty(db, s1, s2) {
  db.addToPartyQueue(s1.id, null)
  db.addToPartyQueue(s2.id, null)
}

test('t20 play() on non-empty queue loads index 0', () => {
  const { db, player, s1, s2 } = setup()
  seedParty(db, s1, s2)
  db.setPlayerState({ status: 'idle', index: 0 })
  const st = player.play()
  assert.equal(st.status, 'loading')
  assert.equal(st.index, 0)
  assert.equal(st.currentSong.ytId, 'A')
})

test('t20b play() on empty queue stays idle', () => {
  const { db, player } = setup()
  const st = player.play()
  assert.equal(st.status, 'idle')
  assert.equal(st.index, 0)
  assert.equal(st.currentSong, null)
})

test('t21 onTrackEnd advances to next', () => {
  const { db, player, s1, s2 } = setup()
  seedParty(db, s1, s2)
  player.play()
  const st = player.onTrackEnd()
  assert.equal(st.currentSong.ytId, 'B')
  assert.equal(st.index, 1)
})

test('t22 next() at end without autoplay → idle', () => {
  const { db, player, s1 } = setup()
  db.addToPartyQueue(s1.id, null)
  player.play()
  const st = player.next()
  assert.equal(st.status, 'idle')
  assert.equal(st.currentSong, null)
})

test('t23 autoplay wraps to index 0 at end', () => {
  const { db, player, s1, s2 } = setup()
  seedParty(db, s1, s2)
  player.setAutoplay(true)
  let st = player.play()
  st = player.onTrackEnd()
  assert.equal(st.currentSong.ytId, 'B')
  st = player.onTrackEnd()
  assert.equal(st.currentSong.ytId, 'A')
  assert.equal(st.index, 0)
})

test('t24 pause/resume toggle only in right states', async () => {
  const { db, player, s1, s2, resolves } = setup()
  seedParty(db, s1, s2)
  resolves.add('A')
  player.play()
  await new Promise((r) => setImmediate(r))
  assert.equal(player.pause().status, 'paused')
  assert.equal(player.pause().status, 'paused')
  assert.equal(player.resume().status, 'playing')
  assert.equal(player.resume().status, 'playing')
})

test('t24b ensureAudio flips loading→playing when ready', async () => {
  const { player, s1, resolves } = setup()
  resolves.add('A')
  player.db.setPlayerState({ status: 'loading', currentSongId: s1.id, index: 0 })
  await player.ensureAudio(s1)
  assert.equal(player.db.getPlayerState().status, 'playing')
})

test('t25 claim player: last wins + broadcasts', () => {
  const { player, alice, bob, events } = setup({ withAudio: false })
  const c1 = player.claim(alice)
  const c2 = player.claim(bob)
  assert.equal(c2.name, 'bob')
  assert.equal(player.claimedBy.name, 'bob')
  assert.ok(events.some((e) => e.startsWith('player')))
})

test('t26 audio missing party song triggers ensure', () => {
  const { player, s1, s2, audio } = setup()
  const db = player.db
  db.setPlayerState({ status: 'loading', currentSongId: s1.id, index: 0 })
  db.setPlayerState({ currentSongId: s1.id })
  player.ensureAudio(s1)
  assert.ok(audio.tracksEnsured.includes('A'))
})