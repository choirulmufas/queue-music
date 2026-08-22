import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { createDB } from '../src/db.js'
import { buildApp } from '../src/server.js'
import { PlaybackManager } from '../src/player.js'
import { EventBus } from '../src/events.js'
import { makeSearch } from '../src/search.js'

const FAKE = { ytId: 'M1', title: 'Bei Mir Bist Du Schoen', channel: 'Janelle Monae', durationSec: 155, thumb: 'x.jpg' }

function makeContext() {
  const cacheDir = mkdtempSync(join(tmpdir(), 'qm-routes-'))
  writeFileSync(join(cacheDir, 'M1.mp3'), 'FAKE-AUDIO')
  const db = createDB()
  const bus = new EventBus()
  const player = new PlaybackManager({ db, bus, audio: null })
  const search = makeSearch({ searchFn: async () => ({ videos: [{ videoId: 'M1', title: FAKE.title, author: { name: FAKE.channel }, duration: { seconds: FAKE.durationSec }, thumbnail: 'x.jpg' }] }) })
  const cacher = {
    isCached: async (id) => id === 'M1',
    ensure: async () => ({ ready: false }),
  }
  const app = buildApp({ db, search, cacher, bus, player, secret: 'itest-secret', cacheDir })
  return { cacheDir, db, bus, player, app }
}

async function login(app, name = 'alice') {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name } })
  assert.equal(res.statusCode, 200)
  const sc = res.headers['set-cookie']
  const cookie = (Array.isArray(sc) ? sc[0] : sc).split(';')[0]
  return cookie
}

test('r1 login sets cookie; me maps cookie->user', async () => {
  const { app } = makeContext()
  await app.ready()
  const cookie = await login(app, 'r1user')
  const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
  assert.equal(me.json().user.name, 'r1user')
  const anon = await app.inject({ method: 'GET', url: '/api/me' })
  assert.equal(anon.json().user, null)
})

test('r2 queue requires auth', async () => {
  const { app } = makeContext()
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/api/queue' })
  assert.equal(res.statusCode, 401)
})

test('r3 search returns normalized results; empty -> 400', async () => {
  const { app } = makeContext()
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/api/search?q=bei' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().results[0].ytId, 'M1')
  assert.equal(res.json().results[0].durationSec, 155)
  const empty = await app.inject({ method: 'GET', url: '/api/search?q=' })
  assert.equal(empty.statusCode, 400)
})

test('r4 add + list + duplicate 409', async () => {
  const { app } = makeContext()
  await app.ready()
  const cookie = await login(app, 'r4user')
  const add = await app.inject({ method: 'POST', url: '/api/queue', headers: { cookie }, payload: { song: FAKE } })
  assert.equal(add.statusCode, 200)
  const dup = await app.inject({ method: 'POST', url: '/api/queue', headers: { cookie }, payload: { song: FAKE } })
  assert.equal(dup.statusCode, 409)
  const list = await app.inject({ method: 'GET', url: '/api/queue', headers: { cookie } })
  const items = list.json().items
  assert.equal(items.length, 1)
  assert.equal(items[0].song.ytId, 'M1')
})

test('r5 bump moves personal -> party attributed', async () => {
  const { app } = makeContext()
  await app.ready()
  const cookie = await login(app, 'r5user')
  const add = await app.inject({ method: 'POST', url: '/api/queue', headers: { cookie }, payload: { song: FAKE } })
  const itemId = add.json().item.id
  const bump = await app.inject({ method: 'POST', url: '/api/party/bump', headers: { cookie }, payload: { itemId } })
  assert.equal(bump.statusCode, 200)
  assert.equal(bump.json().item.addedBy.name, 'r5user')
  const mine = await app.inject({ method: 'GET', url: '/api/queue', headers: { cookie } })
  assert.equal(mine.json().items.length, 0)
  const party = await app.inject({ method: 'GET', url: '/api/party' })
  assert.ok(party.json().items.some((i) => i.song.ytId === 'M1'))
})

test('r6 party order + delete renumbers', async () => {
  const { app, db } = makeContext()
  await app.ready()
  db.addSong({ ytId: 'M2', title: 'Second' })
  const cookie = await login(app, 'r6user')
  const s2 = { ytId: 'M2', title: 'Second' }
  const p1 = await app.inject({ method: 'POST', url: '/api/party', headers: { cookie }, payload: { song: FAKE } })
  const p2 = await app.inject({ method: 'POST', url: '/api/party', headers: { cookie }, payload: { song: s2 } })
  assert.equal(p1.statusCode, 200)
  assert.equal(p2.statusCode, 200)
  const del = await app.inject({ method: 'DELETE', url: `/api/party/${p1.json().item.id}`, headers: { cookie } })
  assert.equal(del.statusCode, 200)
  const party = (await app.inject({ method: 'GET', url: '/api/party' })).json().items
  assert.equal(party.length, 1)
  assert.equal(party[0].position, 0)
  assert.equal(party[0].song.ytId, 'M2')
})

test('r7 claim/play/state round-trip; skip when empty idle', async () => {
  const { app, db } = makeContext()
  await app.ready()
  db.addSong(FAKE)
  db.addToPartyQueue(db.getSong('M1').id, null)
  const cookie = await login(app, 'r7user')
  await app.inject({ method: 'POST', url: '/api/player/claim', headers: { cookie } })
  const play = await app.inject({ method: 'POST', url: '/api/player/play', headers: { cookie } })
  assert.equal(play.json().state.status, 'loading')
  assert.equal(play.json().state.currentSong.ytId, 'M1')
  const st = (await app.inject({ method: 'GET', url: '/api/player/state' })).json().state
  assert.equal(st.status, 'loading')
  const pause = await app.inject({ method: 'POST', url: '/api/player/pause', headers: { cookie } })
  assert.equal(pause.json().state.status, 'paused')
})

test('r7a claiming with a non-empty party queue starts playback automatically', async () => {
  const { app, db } = makeContext()
  await app.ready()
  db.addSong(FAKE)
  db.addToPartyQueue(db.getSong('M1').id, null)
  const cookie = await login(app, 'r7auser')

  const claim = await app.inject({ method: 'POST', url: '/api/player/claim', headers: { cookie } })

  assert.equal(claim.statusCode, 200)
  const state = (await app.inject({ method: 'GET', url: '/api/player/state' })).json().state
  assert.equal(state.status, 'loading')
  assert.equal(state.currentSong.ytId, 'M1')
})

test('r7b adding directly to party starts playback for the claimed player', async () => {
  const { app } = makeContext()
  await app.ready()
  const cookie = await login(app, 'r7buser')
  await app.inject({ method: 'POST', url: '/api/player/claim', headers: { cookie } })

  const add = await app.inject({ method: 'POST', url: '/api/party', headers: { cookie }, payload: { song: FAKE } })

  assert.equal(add.statusCode, 200)
  const state = (await app.inject({ method: 'GET', url: '/api/player/state' })).json().state
  assert.equal(state.status, 'loading')
  assert.equal(state.currentSong.ytId, 'M1')
})

test('r8 audio unknown -> 404; r9 cached -> 200 audio/mpeg', async () => {
  const { app } = makeContext()
  await app.ready()
  const miss = await app.inject({ method: 'GET', url: '/api/audio/999999' })
  assert.equal(miss.statusCode, 404)
  const hit = await app.inject({ method: 'GET', url: '/api/audio/M1' })
  assert.equal(hit.statusCode, 200)
  assert.match(hit.headers['content-type'], /audio\/mpeg/)
  assert.equal(hit.body, 'FAKE-AUDIO')
})

test('r10 SSE pushes party event on connect', async () => {
  const { app } = makeContext()
  await app.ready()
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  await new Promise((resolve, reject) => {
    const req = http.get(url + '/api/events', (res) => {
      res.setEncoding('utf8')
      let buf = ''
      const timer = setTimeout(() => finish(new Error('SSE timeout')), 4000)
      const finish = (err) => {
        clearTimeout(timer)
        res.destroy()
        req.destroy()
        app.close()
        err ? reject(err) : resolve()
      }
      res.on('data', (chunk) => {
        buf += chunk
        if (buf.includes('event: meta') && buf.includes('event: party') && buf.includes('event: player')) {
          finish()
        }
      })
      res.on('error', (err) => finish(err))
    })
    req.on('error', (err) => finish(err))
  })
})