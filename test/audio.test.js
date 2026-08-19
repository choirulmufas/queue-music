import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCacher, mp3Path } from '../src/audio.js'

function fakeSpawn(bin, args, opts) {
  const child = { stderr: {}, on(evt, cb) {}, stdout: {} }
  child['___ok'] = new Promise((resolve) => resolve(0))
  return child
}

function makeSpawnFinisher({ wantSuccess = true } = {}) {
  const calls = []
  function spawnFn(bin, args, opts) {
    calls.push({ bin, args })
    const child = { stderr: { on() {} }, stdout: {} }
    child.on = (evt, cb) => {
      if (evt === 'close') {
        if (wantSuccess) {
          const out = args[args.indexOf('-o') + 1]
          writeFileSync(out, 'fake-mp3')
        }
        setTimeout(() => cb(wantSuccess ? 0 : 1), 5)
      }
      if (evt === 'error') {}
    }
    return child
  }
  return { spawnFn, calls }
}

test('t40 cache miss spawns yt-dlp then caches', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qm-'))
  const { spawnFn, calls } = makeSpawnFinisher()
  const cache = createCacher({ cacheDir: dir, bin: 'yt-dlp', spawnFn })
  const res = await cache.ensure({ ytId: 'AAA', title: 'First' })
  assert.equal(res.ready, true)
  assert.equal(calls.length, 1)
  assert.match(calls[0].args.join(' '), /AAA/)
  assert.equal(await cache.isCached('AAA'), true)
})

test('t41 cache hit spawns nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qm-'))
  writeFileSync(join(dir, 'X.mp3'), 'fake-mp3')
  const { spawnFn, calls } = makeSpawnFinisher()
  const cache = createCacher({ cacheDir: dir, bin: 'yt-dlp', spawnFn })
  const res = await cache.ensure({ ytId: 'X' })
  assert.equal(res.ready, true)
  assert.equal(calls.length, 0)
  assert.equal(Buffer.from(await cache.read('X')).toString(), 'fake-mp3')
})

test('t42 spawn failure rejects and reports (not ready)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qm-'))
  const { spawnFn } = makeSpawnFinisher({ wantSuccess: false })
  const cache = createCacher({ cacheDir: dir, bin: 'yt-dlp', spawnFn })
  await assert.rejects(() => cache.ensure({ ytId: 'BAD' }), /exit 1/)
  assert.equal(existsSync(mp3Path(dir, 'BAD')), false)
})

test('t43 cache dir created lazily', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'qm-')), 'nested', 'cache')
  const { spawnFn } = makeSpawnFinisher()
  const cache = createCacher({ cacheDir: dir, bin: 'yt-dlp', spawnFn })
  await cache.prepare()
  assert.equal(existsSync(dir), true)
})

test('null song → not ready without spawn', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qm-'))
  const { spawnFn, calls } = makeSpawnFinisher()
  const cache = createCacher({ cacheDir: dir, spawnFn })
  const res = await cache.ensure(null)
  assert.equal(res.ready, false)
  assert.equal(calls.length, 0)
})