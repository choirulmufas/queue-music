import os from 'node:os'

export function parseArgs(argv) {
  const args = { host: '127.0.0.1', port: 8080, lan: false, db: null, cache: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--host') args.lan = true
    else if (a === '--port') args.port = Number(argv[++i]) || 8080
    else if (a === '--db') args.db = argv[++i]
    else if (a === '--cache') args.cache = argv[++i]
    else if (a === '--help') args.help = true
  }
  if (process.env.PORT) args.port = Number(process.env.PORT) || args.port
  const host = process.env.HOST
  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    args.lan = true
    args.host = host
  }
  if (args.lan) args.host = '0.0.0.0'
  return args
}

export function lanIPv4() {
  const out = []
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const iface of os.networkInterfaces()[name]) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address)
    }
  }
  return out
}

export const HELP = `Queue Music server

Usage:
  npm start                       local only (127.0.0.1:8080)
  npm start -- --host             reachable on your LAN (binds 0.0.0.0)
  npm start -- --host --port 9000 reachable on LAN, port 9000

Flags:
  --host         bind 0.0.0.0 so other devices can connect
  --port <n>     port (default 8080, or $PORT)
  --db <dir>     where music.db lives (default ./data)
  --cache <dir>  yt-dlp mp3 cache dir (default ./cache)

Env:
  HOST, PORT     same as flags
  QM_SECRET      cookie signing secret (random per boot if unset)
`