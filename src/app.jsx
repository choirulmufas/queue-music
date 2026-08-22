import { h } from 'preact'
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks'

/* ==================== helpers ==================== */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0))
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
}

async function api(path, opts) {
  const res = await fetch(path, opts || {})
  let data = null
  try { data = await res.json() } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || 'HTTP ' + res.status)
    err.status = res.status
    throw err
  }
  return data
}

function jsonBody(obj) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }
}

/* ==================== Spinner ==================== */

function Spinner({ size = 16 }) {
  return h('span', { class: 'spinner', style: { width: size + 'px', height: size + 'px' } })
}

/* ==================== Toast ==================== */

function Toast({ msg, type }) {
  if (!msg) return null
  const cls = 'toast show' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '')
  return h('div', { class: cls }, msg)
}

/* ==================== Skeleton ==================== */

function SkeletonCard() {
  return h('div', { class: 'card skeleton-card' },
    h('div', { class: 'skeleton-line skeleton-title' }),
    h('div', { class: 'skeleton-row' },
      h('div', { class: 'skeleton-thumb' }),
      h('div', { class: 'skeleton-text' },
        h('div', { class: 'skeleton-line' }),
        h('div', { class: 'skeleton-line skeleton-short' }),
      ),
    ),
    h('div', { class: 'skeleton-row' },
      h('div', { class: 'skeleton-thumb' }),
      h('div', { class: 'skeleton-text' },
        h('div', { class: 'skeleton-line' }),
        h('div', { class: 'skeleton-line skeleton-short' }),
      ),
    ),
  )
}

/* ==================== Login ==================== */

function LoginView({ onLogin }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async () => {
    const n = name.trim()
    if (!n) { setError('Enter a name to join.'); return }
    if (n.length > 40) { setError('Name is too long.'); return }
    setLoading(true)
    setError('')
    try {
      const d = await api('/api/login', jsonBody({ name: n }))
      onLogin(d.user)
    } catch (e) {
      setError(e.message || 'Login failed')
      setLoading(false)
    }
  }

  return h('section', { class: 'view view-login' },
    h('div', { class: 'login-box' },
      h('div', { class: 'login-kicker' }, 'Shared music room'),
      h('h1', { class: 'logo' }, 'Queue Music'),
      h('p', { class: 'tagline' }, 'Drop a song. Shape the vibe.'),
      h('label', { class: 'field-label', for: 'login-name' }, 'Your name'),
      h('input', {
        ref: inputRef,
        id: 'login-name',
        type: 'text',
        maxlength: 40,
        placeholder: 'How should we call you?',
        autocomplete: 'name',
        value: name,
        onInput: (e) => { setName(e.target.value); setError('') },
        onKeyDown: (e) => { if (e.key === 'Enter') submit() },
        disabled: loading,
      }),
      h('button', {
        class: 'primary btn-lg',
        onClick: submit,
        disabled: loading,
      }, loading ? h(Spinner, { size: 18 }) : 'Enter the room'),
      h('p', { class: 'login-hint' }, 'Join the room and pick what plays next.'),
      error && h('p', { class: 'error', role: 'alert' }, error),
    )
  )
}

/* ==================== Now Playing Hero ==================== */

function NowPlaying({ player, me, onClaim, onPlay, onPause, onNext, onPrev, onAutoplay, loading }) {
  const song = player.currentSong
  const claimed = me && player.claimedBy && player.claimedBy.id === me.id
  const isEmpty = !song
  const isPlaying = player.status === 'playing'
  const isLoading = player.status === 'loading'

  const statusMap = {
    idle: '',
    loading: 'Getting the track ready\u2026',
    playing: 'Playing now',
    paused: 'Paused',
  }
  const statusText = statusMap[player.status] || ''

  return h('section', { class: 'hero-card' },
    isEmpty
      ? h('div', { class: 'hero-empty' },
          h('div', { class: 'hero-empty-icon' }, '\uD83C\uDFB5'),
          h('div', { class: 'hero-empty-title' }, 'Nothing playing yet'),
          h('div', { class: 'hero-empty-sub' }, 'Be the first to set the vibe.'),
        )
      : h('div', { class: 'hero-active' },
          h('div', { class: 'hero-art-wrap' },
            song.thumb && h('img', { class: 'hero-art', src: song.thumb, alt: '', onError: (e) => e.target.style.display = 'none' }),
            isPlaying && h('div', { class: 'playing-indicator' },
              h('span'), h('span'), h('span'),
            ),
          ),
          h('div', { class: 'hero-info' },
            h('div', { class: 'hero-status ' + (player.status || '') }, statusText),
            h('div', { class: 'hero-title' }, song.title || ''),
            h('div', { class: 'hero-artist' }, song.channel || ''),
            song.addedBy && h('div', { class: 'hero-addedby' }, 'Added by ' + song.addedBy.name),
          ),
        ),
    h('div', { class: 'hero-controls' },
      h('div', { class: 'hero-ctrl-row' },
        !claimed && !player.claimedBy && h('button', {
          class: 'btn-claim',
          onClick: onClaim,
          disabled: loading.claim,
        }, loading.claim ? h(Spinner, { size: 16 }) : 'Take the aux'),
        !claimed && player.claimedBy && h('div', { class: 'speaker-label' },
          'Playing from ' + player.claimedBy.name + '\u2019s device',
        ),
        claimed && h('div', { class: 'speaker-label is-me' },
          '\uD83D\uDD0A You\u2019re on aux',
        ),
        claimed && h('div', { class: 'autoplay-row' },
          h('label', { class: 'autoplay-label' },
            h('input', {
              type: 'checkbox',
              checked: player.autoplay,
              onChange: (e) => onAutoplay(e.target.checked),
            }),
            h('span', null, 'Auto-play'),
          ),
        ),
      ),
      claimed && h('div', { class: 'playback-controls' },
        h('button', {
          class: 'ctrl-btn',
          onClick: onPrev,
          title: 'Previous',
          disabled: loading.prev,
        }, loading.prev ? h(Spinner, { size: 16 }) : '\u23EE'),
        (player.status === 'idle' || player.status === 'paused' || player.status === 'loading')
          ? h('button', {
              class: 'ctrl-btn ctrl-primary',
              onClick: onPlay,
              title: 'Play',
              disabled: loading.play,
            }, loading.play ? h(Spinner, { size: 20 }) : '\u25B6')
          : h('button', {
              class: 'ctrl-btn ctrl-primary',
              onClick: onPause,
              title: 'Pause',
              disabled: loading.pause,
            }, loading.pause ? h(Spinner, { size: 20 }) : '\u23F8'),
        h('button', {
          class: 'ctrl-btn',
          onClick: onNext,
          title: 'Next',
          disabled: loading.next,
        }, loading.next ? h(Spinner, { size: 16 }) : '\u23ED'),
      ),
    ),
  )
}

/* ==================== Search ==================== */

function SearchView({ onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState({})
  const [added, setAdded] = useState({})
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const doSearch = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError('')
    setResults([])
    try {
      const d = await api('/api/search?q=' + encodeURIComponent(q))
      setResults(d.results || [])
      if (!d.results || d.results.length === 0) {
        setError('No matches. Try a different title or artist.')
      }
    } catch (e) {
      setError('Search failed. Try again.')
      setResults([])
    }
    setSearching(false)
  }

  const addSong = async (song, idx) => {
    if (added[idx] || adding[idx]) return
    setAdding(prev => ({ ...prev, [idx]: true }))
    try {
      await api('/api/party', jsonBody({ song }))
      setAdded(prev => ({ ...prev, [idx]: true }))
      setAdding(prev => { const n = { ...prev }; delete n[idx]; return n })
      onAdd()
    } catch (e) {
      setAdding(prev => { const n = { ...prev }; delete n[idx]; return n })
      if (e.status === 409) {
        setAdded(prev => ({ ...prev, [idx]: true }))
      }
    }
  }

  return h('section', { class: 'card search-card' },
    h('h2', { class: 'card-heading' }, 'What should we play next?'),
    h('div', { class: 'search-row' },
      h('div', { class: 'search-input-wrap' },
        h('span', { class: 'search-icon' }, '\uD83D\uDD0D'),
        h('input', {
          ref: inputRef,
          type: 'text',
          placeholder: 'Search a song, artist, or vibe\u2026',
          autocomplete: 'off',
          value: query,
          onInput: (e) => setQuery(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') doSearch() },
        }),
      ),
    ),
    // Status messages
    searching && h('div', { class: 'search-status' },
      h(Spinner, { size: 16 }),
      h('span', null, 'Searching\u2026'),
    ),
    !searching && error && h('div', { class: 'search-status search-error' }, error),
    !searching && !error && results.length === 0 && !query &&
      h('div', { class: 'search-empty' }, 'Search for a song, artist, or vibe.'),
    // Results
    h('ul', { class: 'list' },
      results.map((s, i) =>
        h('li', { class: 'item item-appear', key: s.ytId + i, style: { animationDelay: (i * 30) + 'ms' } },
          s.thumb && h('img', { class: 'thumb', src: s.thumb, alt: '', loading: 'lazy', onError: (e) => e.target.style.display = 'none' }),
          h('div', { class: 'meta' },
            h('div', { class: 'title' }, s.title),
            h('div', { class: 'sub' }, (s.channel || '') + ' \u00B7 ' + fmtDuration(s.durationSec)),
          ),
          h('div', { class: 'actions' },
            added[i]
              ? h('button', { class: 'btn-add added', disabled: true }, '\u2713')
              : h('button', {
                  class: 'btn-add',
                  onClick: () => addSong(s, i),
                  title: 'Add to room',
                  disabled: adding[i],
                }, adding[i] ? h(Spinner, { size: 14 }) : '+'),
          ),
        )
      )
    ),
  )
}

/* ==================== Queue ==================== */

function Queue({ items, currentSong, onSkip, onRemove, loading }) {
  const curId = currentSong ? currentSong.ytId : null
  const count = items.length

  return h('section', { class: 'card queue-card' },
    h('div', { class: 'card-header' },
      h('h2', { class: 'card-heading' }, 'Up next'),
      count > 0 && h('span', { class: 'queue-count' }, count + ' song' + (count === 1 ? '' : 's')),
    ),
    h('ul', { class: 'list' },
      count === 0
        ? h('li', { class: 'empty' },
            h('div', { class: 'empty-icon' }, '\uD83D\uDC40'),
            h('div', null, 'The room is quiet'),
            h('div', { class: 'empty-sub' }, 'Add the first song and set the mood.'),
          )
        : items.map((item, idx) => {
            const s = item.song
            const isCurrent = s && s.ytId === curId
            const by = item.addedBy ? item.addedBy.name : ''
            return h('li', {
              class: 'item item-appear' + (isCurrent ? ' current' : ''),
              key: item.id,
              style: { animationDelay: (idx * 20) + 'ms' },
            },
              s.thumb && h('img', { class: 'thumb', src: s.thumb, alt: '', loading: 'lazy', onError: (e) => e.target.style.display = 'none' }),
              h('div', { class: 'meta' },
                h('div', { class: 'title' }, s.title),
                h('div', { class: 'sub' }, (s.channel || '') + (by ? ' \u00B7 by ' + by : '')),
              ),
              h('div', { class: 'actions' },
                isCurrent && h('button', {
                  onClick: onSkip,
                  title: 'Skip',
                  disabled: loading.skip,
                }, loading.skip ? h(Spinner, { size: 14 }) : '\u23ED'),
                h('button', {
                  class: 'btn-remove',
                  onClick: () => onRemove(item.id),
                  title: 'Remove from room',
                  disabled: loading.remove,
                }, '\u2715'),
              ),
            )
          })
    ),
  )
}

/* ==================== Connection Banner ==================== */

function ConnBanner({ connected }) {
  if (connected) return null
  return h('div', { class: 'conn-banner' },
    h('span', { class: 'conn-dot' }),
    'Connection lost \u2014 trying again',
  )
}

/* ==================== Main App ==================== */

export default function App() {
  const [me, setMe] = useState(null)
  const [booting, setBooting] = useState(true)
  const [party, setParty] = useState([])
  const [player, setPlayer] = useState({ status: 'idle', currentSong: null, autoplay: false, claimedBy: null })
  const [online, setOnline] = useState([])
  const [connected, setConnected] = useState(true)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const [loading, setLoading] = useState({
    claim: false, play: false, pause: false, next: false, prev: false, skip: false, remove: false,
  })

  const audioRef = useRef(null)
  const currentAudioYtId = useRef(null)
  const audioRetryTimer = useRef(null)
  const toastTimer = useRef(null)
  const playerRef = useRef(player)
  const meRef = useRef(me)

  // Keep refs in sync
  useEffect(() => { playerRef.current = player }, [player])
  useEffect(() => { meRef.current = me }, [me])

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'
  }, [])

  // Reset audio completely when user changes (new login session)
  useEffect(() => {
    if (!me) return
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
      audio.load()
    }
    currentAudioYtId.current = null
    clearTimeout(audioRetryTimer.current)
  }, [me])

  const toastMsg = useCallback((msg, type = '') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast({ msg: '', type: '' }), 3000)
  }, [])

  const setLoad = useCallback((key, val) => {
    setLoading(prev => ({ ...prev, [key]: val }))
  }, [])

  const isClaimed = useCallback((st) => {
    st = st || player
    return !!(me && st.claimedBy && st.claimedBy.id === me.id)
  }, [me, player])

  // Audio sync
  const scheduleAudioRetry = useCallback((ytId) => {
    clearTimeout(audioRetryTimer.current)
    audioRetryTimer.current = setTimeout(async () => {
      const ok = await loadAudioFor(ytId)
      if (!ok) scheduleAudioRetry(ytId)
    }, 1500)
  }, [])

  const loadAudioFor = useCallback(async (ytId) => {
    if (!ytId || !audioRef.current) return false
    const url = '/api/audio/' + encodeURIComponent(ytId)
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) {
        audioRef.current.src = url
        audioRef.current.currentTime = 0
        await audioRef.current.play()
        currentAudioYtId.current = ytId
        return true
      }
    } catch (e) { /* ignore */ }
    return false
  }, [])

  const syncAudio = useCallback((st) => {
    const audio = audioRef.current
    if (!audio) return

    if (!isClaimed(st)) {
      if (!audio.paused) audio.pause()
      clearTimeout(audioRetryTimer.current)
      return
    }

    if ((st.status === 'playing' || st.status === 'loading') && st.currentSong) {
      const yt = st.currentSong.ytId
      if (st.status === 'playing') {
        clearTimeout(audioRetryTimer.current)
        // Always reset audio when song changes or audio is in error/empty state
        if (yt !== currentAudioYtId.current || audio.error || !audio.src) {
          currentAudioYtId.current = yt
          audio.src = '/api/audio/' + encodeURIComponent(yt)
          audio.currentTime = 0
          audio.play().catch(() => toastMsg('Tap to start playback'))
        } else if (audio.paused) {
          audio.play().catch(() => toastMsg('Tap to start playback'))
        }
      } else if (st.status === 'loading' && yt !== currentAudioYtId.current) {
        currentAudioYtId.current = yt
        audio.src = ''
        scheduleAudioRetry(yt)
      }
    } else if (st.status === 'paused') {
      audio.pause()
    } else if (st.status === 'idle') {
      audio.pause()
      audio.src = ''
      currentAudioYtId.current = null
      clearTimeout(audioRetryTimer.current)
    }
  }, [isClaimed, scheduleAudioRetry, toastMsg])

  const applyPlayer = useCallback((st) => {
    if (!st) return
    setPlayer(st)
    syncAudio(st)
  }, [syncAudio])

  // SSE connection
  useEffect(() => {
    let es = null
    let retryTimeout = null

    function connect() {
      es = new EventSource('/api/events')

      es.addEventListener('meta', (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.me) setMe(d.me)
        } catch (err) { /* ignore */ }
      })

      es.addEventListener('party', (e) => {
        try {
          const d = JSON.parse(e.data)
          setParty(d.items || [])
        } catch (err) { /* ignore */ }
      })

      es.addEventListener('player', (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.state) applyPlayer(d.state)
        } catch (err) { /* ignore */ }
      })

      es.addEventListener('online', (e) => {
        try {
          const d = JSON.parse(e.data)
          setOnline(d.users || [])
        } catch (err) { /* ignore */ }
      })

      es.addEventListener('toast', (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.msg) toastMsg(d.msg)
        } catch (err) { /* ignore */ }
      })

      es.onopen = () => {
        setConnected(true)
        // On reconnect, fetch fresh player state and sync audio
        api('/api/player/state').then(d => {
          if (d.state) {
            applyPlayer(d.state)
            // Force audio sync on reconnect
            const st = d.state
            const u = meRef.current
            if (u && st.claimedBy && st.claimedBy.id === u.id && st.currentSong && st.status === 'playing') {
              const yt = st.currentSong.ytId
              if (yt !== currentAudioYtId.current) {
                currentAudioYtId.current = yt
                const audio = audioRef.current
                if (audio) {
                  audio.src = '/api/audio/' + encodeURIComponent(yt)
                  audio.currentTime = 0
                  audio.play().catch(() => toastMsg('Tap to start playback'))
                }
              }
            }
          }
        }).catch(() => {})
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Auto-reconnect SSE after 3s
        retryTimeout = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimeout)
      if (es) es.close()
    }
  }, [applyPlayer, toastMsg])

  // Audio ended → auto next (use refs to avoid stale closures)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      const st = playerRef.current
      const u = meRef.current
      if (u && st.claimedBy && st.claimedBy.id === u.id) {
        fetch('/api/player/next', { method: 'POST' }).catch(() => {})
      }
    }
    const onError = () => {
      if (currentAudioYtId.current) scheduleAudioRetry(currentAudioYtId.current)
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [scheduleAudioRetry])

  // Boot: check if logged in
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me')
        if (res.status === 401) { setBooting(false); return }
        const d = await res.json()
        if (d.user) setMe(d.user)
      } catch (e) { /* stay on login */ }
      setBooting(false)
    })()
  }, [])

  // Load party + player when me changes
  useEffect(() => {
    if (!me) return
    api('/api/party').then(d => setParty(d.items || [])).catch(() => {})
    api('/api/player/state').then(d => applyPlayer(d.state)).catch(() => {})
  }, [me, applyPlayer])

  // ====== Actions with loading states ======

  // Helper: force-load and play audio for a song
  const forcePlay = useCallback(async (ytId) => {
    const audio = audioRef.current
    if (!audio || !ytId) return
    // Always reset src to force fresh load
    currentAudioYtId.current = ytId
    audio.src = '/api/audio/' + encodeURIComponent(ytId)
    audio.currentTime = 0
    try {
      await audio.play()
    } catch (e) {
      toastMsg('Tap to start playback')
    }
  }, [toastMsg])

  const handleClaim = async () => {
    setLoad('claim', true)
    try {
      await api('/api/player/claim', { method: 'POST' })
      toastMsg('You\u2019re on aux', 'success')
      const d = await api('/api/player/state')
      applyPlayer(d.state)
      const st = d.state
      if (st.currentSong) forcePlay(st.currentSong.ytId)
    } catch (e) {
      toastMsg(e.message || 'Failed to claim', 'error')
    }
    setLoad('claim', false)
  }

  const handlePlay = async () => {
    setLoad('play', true)
    try {
      const d = await api('/api/player/play', { method: 'POST' })
      applyPlayer(d.state)
      const st = d.state
      if (st.currentSong) forcePlay(st.currentSong.ytId)
    } catch (e) {
      toastMsg(e.message || 'Play failed', 'error')
    }
    setLoad('play', false)
  }

  const handlePause = async () => {
    setLoad('pause', true)
    try {
      const d = await api('/api/player/pause', { method: 'POST' })
      applyPlayer(d.state)
    } catch (e) {
      toastMsg(e.message || 'Pause failed', 'error')
    }
    setLoad('pause', false)
  }

  const handleNext = async () => {
    setLoad('next', true)
    try {
      const d = await api('/api/player/next', { method: 'POST' })
      applyPlayer(d.state)
    } catch (e) {
      toastMsg(e.message || 'Next failed', 'error')
    }
    setLoad('next', false)
  }

  const handlePrev = async () => {
    setLoad('prev', true)
    try {
      const d = await api('/api/player/prev', { method: 'POST' })
      applyPlayer(d.state)
    } catch (e) {
      toastMsg(e.message || 'Previous failed', 'error')
    }
    setLoad('prev', false)
  }

  const handleAutoplay = async (on) => {
    try {
      const d = await api('/api/player/autoplay', jsonBody({ on }))
      applyPlayer(d.state)
    } catch (e) {
      toastMsg('Autoplay update failed', 'error')
    }
  }

  const handleSkip = async () => {
    setLoad('skip', true)
    try { await api('/api/party/skip', { method: 'POST' }) }
    catch (e) { toastMsg(e.message || 'Skip failed', 'error') }
    setLoad('skip', false)
  }

  const handleRemove = async (id) => {
    setLoad('remove', true)
    try {
      await api('/api/party/' + id, { method: 'DELETE' })
      toastMsg('Removed from the room', 'success')
    } catch (e) {
      toastMsg(e.message || 'Remove failed', 'error')
    }
    setLoad('remove', false)
  }

  const handleLogout = async () => {
    try { await api('/api/logout', { method: 'POST' }) } catch (e) { /* ignore */ }
    location.reload()
  }

  const handleAdd = () => { /* SSE updates party list */ }

  // ====== Boot screen ======
  if (booting) {
    return h('div', { class: 'boot-screen' },
      h('div', { class: 'boot-logo' }, 'Queue Music'),
      h(Spinner, { size: 24 }),
    )
  }

  // ====== Login ======
  if (!me) {
    return h('div', null,
      h(ConnBanner, { connected }),
      h(LoginView, { onLogin: (user) => setMe(user) }),
      h(Toast, { msg: toast.msg, type: toast.type }),
    )
  }

  // ====== Room ======
  return h('div', null,
    h(ConnBanner, { connected }),
    h('section', { class: 'view view-home' },
      // Topbar
      h('header', { class: 'topbar' },
        h('div', { class: 'topbar-left' },
          h('span', { class: 'appname' }, 'Queue Music'),
          h('span', { class: 'room-label' }, 'This room'),
        ),
        h('div', { class: 'topbar-right' },
          h('span', { class: 'online-badge', title: online.map(u => u.name).join(', ') },
            h('span', { class: 'online-dot' }),
            h('span', null, online.length + ' people'),
          ),
          h('button', { class: 'icon-btn', onClick: handleLogout, title: 'Leave room', 'aria-label': 'Leave room' }, '\u22EE'),
        ),
      ),
      // Content
      h('main', { class: 'content' },
        h(NowPlaying, {
          player, me, loading,
          onClaim: handleClaim,
          onPlay: handlePlay,
          onPause: handlePause,
          onNext: handleNext,
          onPrev: handlePrev,
          onAutoplay: handleAutoplay,
        }),
        h(SearchView, { onAdd: handleAdd }),
        h(Queue, {
          items: party,
          currentSong: player.currentSong,
          loading,
          onSkip: handleSkip,
          onRemove: handleRemove,
        }),
      ),
    ),
    h(Toast, { msg: toast.msg, type: toast.type }),
  )
}
