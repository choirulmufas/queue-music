'use strict'
;(function () {
  const $ = (sel) => document.querySelector(sel)

  const audio = new Audio()
  audio.preload = 'auto'

  let me = null
  let partyItems = []
  let myItems = []
  let searchResults = []
  let currentAudioYtId = null
  let playerState = { status: 'idle', currentSong: null, autoplay: false, claimedBy: null }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0))
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
  }

  function show(view) {
    $('#view-login').classList.toggle('hidden', view !== 'login')
    $('#view-home').classList.toggle('hidden', view !== 'home')
  }

  function toast(msg) {
    const t = $('#toast')
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(t._timer)
    t._timer = setTimeout(() => t.classList.remove('show'), 2500)
  }

  function isClaimed(st) {
    st = st || playerState
    return !!(me && st.claimedBy && st.claimedBy.id === me.id)
  }

  async function api(path, opts) {
    let res
    try {
      res = await fetch(path, opts || {})
    } catch (err) {
      throw new Error('network error')
    }
    let data = null
    try {
      data = await res.json()
    } catch (err) {
      /* no body */
    }
    if (!res.ok) {
      const e = new Error((data && (data.message || data.error)) || 'HTTP ' + res.status)
      e.status = res.status
      throw e
    }
    return data
  }

  function jsonBody(obj) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }
  }

  /* ---------------- audio ---------------- */

  async function syncAudio(st) {
    if (!isClaimed(st)) {
      if (!audio.paused) audio.pause()
      return
    }
    try {
      if (st.status === 'playing' && st.currentSong) {
        const yt = st.currentSong.ytId
        if (yt !== currentAudioYtId) {
          currentAudioYtId = yt
          audio.src = '/api/audio/' + encodeURIComponent(yt)
          audio.currentTime = 0
          await audio.play()
        } else if (audio.paused) {
          await audio.play()
        }
      } else if (st.status === 'paused') {
        audio.pause()
      } else if (st.status === 'idle') {
        audio.pause()
        audio.src = ''
        currentAudioYtId = null
      }
    } catch (err) {
      toast('tap to start playback')
    }
  }

  async function tryPlayNow() {
    const st = playerState
    if (!isClaimed(st) || !st.currentSong) return
    try {
      if (st.currentSong.ytId !== currentAudioYtId) {
        currentAudioYtId = st.currentSong.ytId
        audio.src = '/api/audio/' + encodeURIComponent(st.currentSong.ytId)
        audio.currentTime = 0
      }
      await audio.play()
    } catch (err) {
      toast('still blocked — tap again')
    }
  }

  audio.addEventListener('ended', () => {
    if (isClaimed(playerState)) {
      fetch('/api/player/next', { method: 'POST' }).catch(() => {})
    }
  })

  audio.addEventListener('error', () => {
    if (audio.src) toast('audio not ready — try again')
  })

  /* ---------------- renderers ---------------- */

  function renderParty() {
    const ul = $('#party-queue')
    const curId = playerState.currentSong ? playerState.currentSong.ytId : null
    if (!partyItems.length) {
      ul.innerHTML = '<li class="empty">Party queue is empty — bump a song from your queue!</li>'
      return
    }
    ul.innerHTML = partyItems
      .map((item) => {
        const s = item.song
        const isCurrent = s && s.ytId === curId
        const by = item.addedBy ? item.addedBy.name : 'anon'
        return (
          '<li class="item' + (isCurrent ? ' current' : '') + '">' +
          '<img class="thumb" src="' + esc(s.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
          '<div class="meta">' +
          '<div class="title">' + esc(s.title) + '</div>' +
          '<div class="sub">' + esc(s.channel || '') + ' &middot; by ' + esc(by) + '</div>' +
          '</div>' +
          '<div class="actions">' +
          (isCurrent ? '<button data-action="skip" title="Skip">&#9197;</button>' : '') +
          '<button class="btn-remove" data-action="party-remove" data-id="' + item.id + '" title="Remove">&#10005;</button>' +
          '</div>' +
          '</li>'
        )
      })
      .join('')
  }

  function renderMyQueue() {
    const ul = $('#my-queue')
    if (!myItems.length) {
      ul.innerHTML = '<li class="empty">Your queue is empty — search and add a song.</li>'
      return
    }
    ul.innerHTML = myItems
      .map((item, i) => {
        const s = item.song
        return (
          '<li class="item">' +
          '<img class="thumb" src="' + esc(s.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
          '<div class="meta">' +
          '<div class="title">' + esc(s.title) + '</div>' +
          '<div class="sub">' + esc(s.channel || '') + '</div>' +
          '</div>' +
          '<div class="actions">' +
          '<button data-action="move" data-id="' + item.id + '" data-dir="-1" title="Up" ' + (i === 0 ? 'disabled' : '') + '>&#8593;</button>' +
          '<button data-action="move" data-id="' + item.id + '" data-dir="1" title="Down" ' + (i === myItems.length - 1 ? 'disabled' : '') + '>&#8595;</button>' +
          '<button class="btn-bump" data-action="bump" data-id="' + item.id + '" title="Bump to party">&#127881;</button>' +
          '<button class="btn-remove" data-action="mine-remove" data-id="' + item.id + '" title="Remove">&#10005;</button>' +
          '</div>' +
          '</li>'
        )
      })
      .join('')
  }

  function renderResults(results) {
    const ul = $('#search-results')
    if (!results.length) {
      ul.innerHTML = '<li class="empty">No results.</li>'
      return
    }
    ul.innerHTML = results
      .map((s, i) => {
        return (
          '<li class="item">' +
          '<img class="thumb" src="' + esc(s.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
          '<div class="meta">' +
          '<div class="title">' + esc(s.title) + '</div>' +
          '<div class="sub">' + esc(s.channel || '') + ' &middot; ' + fmtDuration(s.durationSec) + '</div>' +
          '</div>' +
          '<div class="actions">' +
          '<button class="btn-add" data-index="' + i + '" title="Add to my queue">+</button>' +
          '</div>' +
          '</li>'
        )
      })
      .join('')
  }

  function renderPlayerBar() {
    const bar = $('#player-bar')
    const st = playerState
    const song = st.currentSong
    const badgeMap = { idle: 'idle', loading: 'preparing…', playing: 'now playing', paused: 'paused' }
    const badge = badgeMap[st.status] || st.status
    const claimed = isClaimed(st)

    let claimHtml
    if (claimed) {
      claimHtml = '<button id="speaker-note" class="speaker-note">&#128266; YOU ARE THE SPEAKER</button>'
    } else if (st.claimedBy) {
      claimHtml = '<div class="claim-hint">Playing on <strong>' + esc(st.claimedBy.name) + '</strong>&#39;s tab</div>'
    } else {
      claimHtml = '<button id="claim-btn" class="claim-btn">Become the Player</button>'
    }

    let songHtml
    if (song) {
      songHtml =
        '<img class="thumb" src="' + esc(song.thumb) + '" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="meta">' +
        '<div class="title">' + esc(song.title) + '</div>' +
        '<div class="sub">' + esc(song.channel || '') + '</div>' +
        '</div>'
    } else {
      songHtml = '<div class="meta dim">Nothing playing</div>'
    }

    bar.innerHTML =
      '<div class="pb-inner">' +
      '<div class="pb-top">' +
      '<span class="badge ' + esc(st.status) + '">' + esc(badge) + '</span>' +
      claimHtml +
      '</div>' +
      '<div class="pb-song">' + songHtml + '</div>' +
      '<div class="pb-controls">' +
      '<button id="btn-play" title="Play">&#9654;</button>' +
      '<button id="btn-pause" title="Pause">&#9208;</button>' +
      '<button id="btn-next" title="Next">&#9197;</button>' +
      '<label class="auto"><input type="checkbox" id="btn-autoplay"' + (st.autoplay ? ' checked' : '') + '> Autoplay</label>' +
      '</div>' +
      '</div>'
  }

  /* ---------------- actions ---------------- */

  function applyPlayerState(st) {
    if (!st) return
    playerState = st
    renderPlayerBar()
    syncAudio(playerState)
  }

  async function loadParty() {
    try {
      const d = await api('/api/party')
      partyItems = d.items || []
      renderParty()
    } catch (err) {
      toast(err.message || 'failed to load party')
    }
  }

  async function loadQueue() {
    try {
      const d = await api('/api/queue')
      myItems = d.items || []
      renderMyQueue()
    } catch (err) {
      toast(err.message || 'failed to load your queue')
    }
  }

  async function loadPlayer() {
    try {
      const d = await api('/api/player/state')
      applyPlayerState(d.state)
    } catch (err) {
      /* ignore boot errors */
    }
  }

  async function login() {
    const name = $('#login-name').value.trim()
    if (!name) {
      $('#login-error').textContent = 'Enter a name'
      return
    }
    try {
      const d = await api('/api/login', jsonBody({ name }))
      me = d.user
      $('#login-error').textContent = ''
      connectEvents()
      show('home')
      loadParty()
      loadPlayer()
      loadQueue()
    } catch (err) {
      $('#login-error').textContent = err.message || 'login failed'
    }
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch (err) {
      /* ignore */
    }
    location.reload()
  }

  async function doSearch() {
    const q = $('#search-input').value.trim()
    if (!q) return
    try {
      const d = await api('/api/search?q=' + encodeURIComponent(q))
      searchResults = d.results || []
      renderResults(searchResults)
    } catch (err) {
      toast(err.message || 'search failed')
    }
  }

  async function addToMyQueue(song, btn) {
    if (!song) return
    try {
      await api('/api/queue', jsonBody({ song }))
      btn.textContent = '\u2713'
      loadQueue()
    } catch (err) {
      if (err.status === 409) {
        toast('already in your queue')
        btn.textContent = '\u2713'
        loadQueue()
      } else {
        toast(err.message || 'failed to add')
      }
    }
  }

  async function moveItem(id, dir) {
    const idx = myItems.findIndex((i) => i.id === Number(id))
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= myItems.length) return
    const arr = myItems.slice()
    const tmp = arr[idx]
    arr[idx] = arr[j]
    arr[j] = tmp
    try {
      const d = await api('/api/queue/reorder', jsonBody({ ids: arr.map((i) => i.id) }))
      myItems = d.items || []
      renderMyQueue()
    } catch (err) {
      toast(err.message || 'reorder failed')
    }
  }

  async function bumpItem(id) {
    try {
      await api('/api/party/bump', jsonBody({ itemId: Number(id) }))
      toast('bumped to party')
      loadQueue()
    } catch (err) {
      toast(err.message || 'bump failed')
    }
  }

  async function removeMine(id) {
    try {
      await api('/api/queue/' + id, { method: 'DELETE' })
      loadQueue()
    } catch (err) {
      toast(err.message || 'remove failed')
    }
  }

  async function skipParty() {
    try {
      await api('/api/party/skip', { method: 'POST' })
    } catch (err) {
      toast(err.message || 'skip failed')
    }
  }

  async function removeParty(id) {
    try {
      await api('/api/party/' + id, { method: 'DELETE' })
    } catch (err) {
      toast(err.message || 'remove failed')
    }
  }

  async function claim() {
    try {
      await api('/api/player/claim', { method: 'POST' })
      toast('you are now the speaker')
      await loadPlayer()
      await tryPlayNow()
    } catch (err) {
      toast(err.message || 'claim failed')
    }
  }

  async function ctlPlay() {
    try {
      const d = await api('/api/player/play', { method: 'POST' })
      applyPlayerState(d.state)
      await tryPlayNow()
    } catch (err) {
      toast(err.message || 'play failed')
    }
  }

  async function ctlPause() {
    try {
      const d = await api('/api/player/pause', { method: 'POST' })
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'pause failed')
    }
  }

  async function ctlNext() {
    try {
      const d = await api('/api/player/next', { method: 'POST' })
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'next failed')
    }
  }

  async function toggleAutoplay(on) {
    try {
      const d = await api('/api/player/autoplay', jsonBody({ on }))
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'failed to update autoplay')
      renderPlayerBar()
    }
  }

  function renderOnline(users) {
    const n = users.length
    const badge = $('#online-badge')
    badge.textContent = '● ' + n + ' friend' + (n === 1 ? '' : 's')
    badge.title = users.map((u) => u.name).join(', ')
  }

  /* ---------------- boot ---------------- */

  ;(async function boot() {
    try {
      const res = await fetch('/api/me')
      if (res.status === 401) {
        show('login')
        return
      }
      const d = await res.json()
      if (d.user) {
        me = d.user
        show('home')
        loadParty()
        loadPlayer()
        loadQueue()
      } else {
        show('login')
      }
    } catch (err) {
      show('login')
    }
  })()

  const es = new EventSource('/api/events')

  function connectEvents() {
    es.close()
    const fresh = new EventSource('/api/events')
    for (const evt of ['meta', 'party', 'player', 'online', 'toast']) {
      fresh.addEventListener(evt, esHandlers[evt])
    }
    fresh.onopen = es.onopen
    fresh.onerror = es.onerror
    window.__es = fresh
  }

  const esHandlers = {
    meta(e) {
      try {
        const d = JSON.parse(e.data)
        if (d.me) {
          me = d.me
          if (!$('#view-login').classList.contains('hidden')) {
            show('home')
            loadParty()
            loadPlayer()
            loadQueue()
          }
        }
      } catch (err) {
        /* ignore */
      }
    },
    party(e) {
      try {
        const d = JSON.parse(e.data)
        partyItems = d.items || []
        renderParty()
      } catch (err) {
        /* ignore */
      }
    },
    player(e) {
      try {
        const d = JSON.parse(e.data)
        if (d.state) applyPlayerState(d.state)
      } catch (err) {
        /* ignore */
      }
    },
    online(e) {
      try {
        const d = JSON.parse(e.data)
        renderOnline(d.users || [])
      } catch (err) {
        /* ignore */
      }
    },
    toast(e) {
      try {
        const d = JSON.parse(e.data)
        if (d.msg) toast(d.msg)
      } catch (err) {
        /* ignore */
      }
    },
  }

  for (const evt of Object.keys(esHandlers)) {
    es.addEventListener(evt, esHandlers[evt])
  }

  es.onopen = () => {
    $('#conn-banner').classList.add('hidden')
  }
  es.onerror = () => {
    $('#conn-banner').classList.remove('hidden')
  }

  /* ---------------- events ---------------- */

  $('#login-btn').addEventListener('click', login)
  $('#login-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login()
  })
  $('#logout-btn').addEventListener('click', logout)
  $('#search-btn').addEventListener('click', doSearch)
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch()
  })

  $('#player-bar').addEventListener('click', (e) => {
    if (e.target.closest('#claim-btn')) claim()
    else if (e.target.closest('#speaker-note')) tryPlayNow()
    else if (e.target.closest('#btn-play')) ctlPlay()
    else if (e.target.closest('#btn-pause')) ctlPause()
    else if (e.target.closest('#btn-next')) ctlNext()
  })

  $('#player-bar').addEventListener('change', (e) => {
    if (e.target.id === 'btn-autoplay') toggleAutoplay(e.target.checked)
  })

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action], button.btn-add')
    if (!btn) return
    const action = btn.dataset.action
    if (action === 'skip') skipParty()
    else if (action === 'party-remove') removeParty(btn.dataset.id)
    else if (action === 'move') moveItem(btn.dataset.id, Number(btn.dataset.dir))
    else if (action === 'bump') bumpItem(btn.dataset.id)
    else if (action === 'mine-remove') removeMine(btn.dataset.id)
    else if (btn.classList.contains('btn-add')) addToMyQueue(searchResults[Number(btn.dataset.index)], btn)
  })
})()