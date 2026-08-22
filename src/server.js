import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setAuthCookie, identityFromRequest } from './auth.js'
import { songToPayload } from './queue.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')

export function buildApp({ db, search, cacher, bus, player, secret, cacheDir }) {
  const app = Fastify({ logger: false })

  app.register(fastifyCookie)

  app.decorate('requireAuth', (request, reply, done) => {
    const userId = identityFromRequest(request, secret)
    request.user = userId ? db.getUser(userId) : null
    if (!request.user) {
      reply.code(401).send({ error: 'unauthorized', message: 'login required' })
      return done()
    }
    done()
  })

  app.decorate('optionalUser', (request, reply, done) => {
    const userId = identityFromRequest(request, secret)
    request.user = userId ? db.getUser(userId) : null
    done()
  })

  const emitParty = () => bus.emit('party', { items: db.getPartyQueue() })

  function maybeStartPlayback() {
    const state = player.getState()
    if (state.status === 'idle' && state.claimedBy && db.partyCount() > 0) {
      player.play()
    }
  }

  function songBody(body) {
    const s = body?.song
    if (!s || typeof s.ytId !== 'string' || !s.ytId) {
      const e = new Error('song.ytId required')
      e.statusCode = 400
      throw e
    }
    return {
      ytId: s.ytId,
      title: typeof s.title === 'string' ? s.title : s.ytId,
      channel: typeof s.channel === 'string' ? s.channel : '',
      durationSec: Number.isInteger(s.durationSec) ? s.durationSec : 0,
      thumb: typeof s.thumb === 'string' ? s.thumb : '',
    }
  }

  app.get('/api/me', { preHandler: app.optionalUser }, async (req) => {
    if (!req.user) return { user: null }
    return { user: req.user }
  })

  app.post('/api/login', async (req, reply) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return reply.code(400).send({ error: 'name required' })
    if (name.length > 40) return reply.code(400).send({ error: 'name too long' })
    const user = db.createUser(name)
    setAuthCookie(reply, user.id, secret)
    return { user }
  })

  app.post('/api/logout', async (req, reply) => {
    reply.clearCookie('qm_user', { path: '/' })
    return { ok: true }
  })

  app.get('/api/search', async (req, reply) => {
    const q = String(req.query?.q ?? '').trim()
    if (!q) return reply.code(400).send({ error: 'q required' })
    try {
      const results = await search(q)
      return { results }
    } catch (err) {
      return reply.code(502).send({ error: 'search failed', message: err.message })
    }
  })

  app.get('/api/queue', { preHandler: app.requireAuth }, async (req) => {
    return { items: db.getUserQueue(req.user.id).map((i) => ({ id: i.id, position: i.position, song: songToPayload(i.song) })) }
  })

  app.post('/api/queue', { preHandler: app.requireAuth }, async (req, reply) => {
    const song = db.addSong({ ...songBody(req.body), addedBy: req.user.id })
    const res = db.addToUserQueue(req.user.id, song.id)
    if (res.duplicate) return reply.code(409).send({ error: 'already in your queue' })
    const item = db.getUserQueue(req.user.id).find((i) => i.id === res.id)
    return { item: { id: item.id, position: item.position, song: songToPayload(item.song) } }
  })

  app.delete('/api/queue/:itemId', { preHandler: app.requireAuth }, async (req, reply) => {
    const ok = db.removeFromUserQueue(Number(req.params.itemId), req.user.id)
    if (!ok) return reply.code(404).send({ error: 'item not found' })
    return { ok: true }
  })

  app.post('/api/queue/reorder', { preHandler: app.requireAuth }, async (req, reply) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null
    if (!ids || ids.length === 0 && db.getUserQueue(req.user.id).length > 0) {
      return reply.code(400).send({ error: 'ids required' })
    }
    try {
      const items = db.reorderUserQueue(req.user.id, ids)
      return { items: items.map((i) => ({ id: i.id, position: i.position, song: songToPayload(i.song) })) }
    } catch (err) {
      return reply.code(err.statusCode ?? 400).send({ error: err.message })
    }
  })

  app.get('/api/party', { preHandler: app.optionalUser }, async () => {
    return { items: db.getPartyQueue() }
  })

  app.post('/api/party', { preHandler: app.requireAuth }, async (req) => {
    const song = db.addSong({ ...songBody(req.body), addedBy: req.user.id })
    const item = db.addToPartyQueue(song.id, req.user.id)
    emitParty()
    maybeStartPlayback()
    return { item }
  })

  app.post('/api/party/bump', { preHandler: app.requireAuth }, async (req, reply) => {
    const itemId = Number(req.body?.itemId)
    const mine = db.getUserQueue(req.user.id)
    const item = mine.find((i) => i.id === itemId)
    if (!item) return reply.code(404).send({ error: 'item not found in your queue' })
    const moved = db.addToPartyQueue(item.song.id, req.user.id)
    db.removeFromUserQueue(itemId, req.user.id)
    emitParty()
    maybeStartPlayback()
    return { item: moved }
  })

  app.post('/api/party/skip', { preHandler: app.requireAuth }, async () => {
    player.next()
    return { ok: true }
  })

  app.delete('/api/party/:itemId', { preHandler: app.requireAuth }, async (req, reply) => {
    const ok = db.removePartyItem(Number(req.params.itemId))
    if (!ok) return reply.code(404).send({ error: 'item not found' })
    emitParty()
    return { ok: true }
  })

  app.get('/api/player/state', async () => {
    return { state: player.getState() }
  })

  app.post('/api/player/claim', { preHandler: app.requireAuth }, async (req) => {
    player.claim(req.user)
    maybeStartPlayback()
    return { claimedBy: player.claimedBy }
  })

  app.post('/api/player/play', { preHandler: app.requireAuth }, async () => {
    const state = player.play()
    return { state }
  })

  app.post('/api/player/pause', { preHandler: app.requireAuth }, async () => {
    const state = player.pause()
    return { state }
  })

  app.post('/api/player/resume', { preHandler: app.requireAuth }, async () => {
    const state = player.resume()
    return { state }
  })

  app.post('/api/player/next', { preHandler: app.requireAuth }, async () => {
    const state = player.next()
    return { state }
  })

  app.post('/api/player/prev', { preHandler: app.requireAuth }, async () => {
    const state = player.prev()
    return { state }
  })

  app.post('/api/player/autoplay', { preHandler: app.requireAuth }, async (req) => {
    const state = player.setAutoplay(Boolean(req.body?.on))
    return { state }
  })

  const VALID_YT_ID = /^[A-Za-z0-9_-]{1,50}$/

  app.get('/api/audio/:ytId', async (req, reply) => {
    const { ytId } = req.params
    if (!VALID_YT_ID.test(ytId)) return reply.code(400).send({ error: 'invalid id' })
    const cached = await cacher.isCached(ytId)
    if (!cached) {
      const song = db.getSong(ytId)
      if (song) player.ensureAudio(song)
      return reply.code(404).send({ error: 'audio not ready' })
    }
    return reply.sendFile(ytId + '.mp3', { root: cacheDir })
  })

  const onlineUsers = new Map()
  let onlineTimer = null

  function broadcastOnline() {
    const users = [...new Map([...onlineUsers.values()].map((u) => [u.id, u])).values()]
    bus.emit('online', { users })
  }

  app.get('/api/events', { preHandler: app.optionalUser }, async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const tab = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    if (req.user) onlineUsers.set(tab, req.user)

    const send = (type, payload) => {
      reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)
    }

    send('meta', { me: req.user })
    send('party', { items: db.getPartyQueue() })
    send('player', { state: player.getState() })
    broadcastOnline()

    const unsubscribe = bus.subscribe((event) => {
      send(event.type, event)
    })

    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n')
      broadcastOnline()
    }, 15000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      onlineUsers.delete(tab)
      broadcastOnline()
      if (onlineUsers.size === 0 && onlineTimer) {
        clearInterval(onlineTimer)
        onlineTimer = null
      }
    })
  })

  const distDir = join(ROOT, 'dist')
  const staticDir = existsSync(distDir) ? distDir : PUBLIC_DIR
  app.register(fastifyStatic, { root: staticDir, prefix: '/' })

  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode ?? 500
    reply.code(status).send({ error: status >= 500 ? 'internal' : 'bad request', message: err.message })
  })

  return app
}