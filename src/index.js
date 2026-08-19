import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDB } from './db.js'
import { makeSearch } from './search.js'
import { createCacher } from './audio.js'
import { PlaybackManager } from './player.js'
import { EventBus } from './events.js'
import { buildApp } from './server.js'
import { parseArgs, lanIPv4, HELP } from './cli.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function findYtdlp() {
  const checks = [process.env.YT_DLP, 'yt-dlp', join(ROOT, 'bin', 'yt-dlp.exe')]
  for (const cand of checks) {
    if (!cand) continue
    const probe = spawnSync(cand, ['--version'], { timeout: 5000, stdio: 'pipe' })
    if (probe.status === 0) return { bin: cand, version: String(probe.stdout).trim() }
  }
  return { bin: 'yt-dlp', version: null }
}

function printBanner(args, ips) {
  console.log('\nQueue Music — LAN party player')
  console.log('  yt-dlp: ' + (args.ytdlp.version ? `found (${args.ytdlp.version})` : 'NOT FOUND - search & queue still work, playback disabled'))
  if (args.lan) {
    for (const ip of ips) console.log('  LAN:    http://' + ip + ':' + args.port)
  }
  console.log('  Local:  http://127.0.0.1:' + args.port)
  console.log('  Bind:   ' + args.host + ':' + args.port + '\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP)
    return
  }

  const dataDir = args.db ?? join(ROOT, 'data')
  const cacheDir = args.cache ?? join(ROOT, 'cache')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(cacheDir, { recursive: true })

  const ytdlp = findYtdlp()
  const secret = process.env.QM_SECRET ?? randomBytes(32).toString('hex')

  const db = createDB(join(dataDir, 'music.db'))
  const bus = new EventBus()
  const cacher = createCacher({ cacheDir, bin: ytdlp.bin, bus })
  const search = makeSearch()
  const player = new PlaybackManager({ db, bus, audio: cacher })
  const app = buildApp({ db, search, cacher, bus, player, secret, cacheDir })

  args.ytdlp = ytdlp

  try {
    await app.listen({ host: args.host, port: args.port })
  } catch (err) {
    console.error('Failed to start: ' + err.message)
    process.exit(1)
  }

  printBanner(args, lanIPv4())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})