import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export function mp3Path(cacheDir, ytId) {
  return join(cacheDir, `${ytId}.mp3`)
}

export function createCacher({ cacheDir, bin = 'yt-dlp', spawnFn = spawn, bus }) {
  const pending = new Map()

  async function prepare() {
    await mkdir(cacheDir, { recursive: true })
  }

  async function isCached(ytId) {
    return existsSync(mp3Path(cacheDir, ytId))
  }

  function ensure(song) {
    if (!song?.ytId) return Promise.resolve({ ready: false })
    if (pending.has(song.ytId)) return pending.get(song.ytId)
    if (existsSync(mp3Path(cacheDir, song.ytId))) {
      return Promise.resolve({ ready: true, path: mp3Path(cacheDir, song.ytId) })
    }
    const p = download(song)
    pending.set(song.ytId, p)
    p.finally(() => pending.delete(song.ytId)).catch(() => {})
    return p
  }

  function download(song) {
    return new Promise((resolve, reject) => {
      const out = mp3Path(cacheDir, song.ytId)
      const url = `https://www.youtube.com/watch?v=${song.ytId}`
      const child = spawnFn(bin, [
        '--extractor-args', 'youtube:player_client=android',
        '-f', 'bestaudio/best',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', out,
        url,
      ], { stdio: ['ignore', 'ignore', 'pipe'] })

      let errBuf = ''
      child.stderr.on('data', (d) => { errBuf += d })
      child.on('error', (err) => reject(new Error(`yt-dlp spawn: ${err.message}`)))
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exit ${code}: ${errBuf.slice(0, 200)}`))
          return
        }
        if (!existsSync(out)) {
          reject(new Error('yt-dlp exited 0 but produced no mp3'))
          return
        }
        bus?.emit('audio', { songId: song.ytId, ready: true })
        resolve({ ready: true, path: out })
      })
    })
  }

  async function read(ytId) {
    const path = mp3Path(cacheDir, ytId)
    if (!existsSync(path)) return null
    return readFile(path)
  }

  return { ensure, isCached, read, prepare, purge: () => pending.clear() }
}