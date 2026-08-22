'use strict'
;(function () {
  const $ = (sel) => document.querySelector(sel)
  const $$ = (sel) => document.querySelectorAll(sel)

  const audio = new Audio()
  audio.preload = 'auto'

  let me = null
  let partyItems = []
  let searchResults = []
  let currentAudioYtId = null
  let playerState = { status: 'idle', currentSong: null, autoplay: false, claimedBy: null }

  /* ---------------- helpers ---------------- */

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
    if (view === 'login') $('#login-name').focus()
  }

  function toast(msg) {
    const t = $('#toast')
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(t._timer)
    t._timer = setTimeout(() => t.classList.remove('show'), 2800)
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
    } catch (err) { /* no body */ }
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

  let audioRetryTimer = null

  async function loadAudioFor(ytId) {
    if (!ytId) return
    const url = '/api/audio/' + encodeURIComponent(ytId)
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) {
        audio.src = url
        audio.currentTime = 0
        await audio.play()
        return true
      }
    } catch (err) { /* ignore */ }
    return false
  }

  function scheduleAudioRetry(ytId) {
    clearTimeout(audioRetryTimer)
    audioRetryTimer = setTimeout(async () => {
      if (playerState.status !== 'loading' || !playerState.currentSong || playerState.currentSong.ytId !== ytId) return
      const ok = await loadAudioFor(ytId)
      if (!ok) scheduleAudioRetry(ytId)
    }, 1500)
  }

  async function syncAudio(st) {
    if (!isClaimed(st)) {
      if (!audio.paused) audio.pause()
      clearTimeout(audioRetryTimer)
      return
    }
    try {
      if ((st.status === 'playing' || st.status === 'loading') && st.currentSong) {
        const yt = st.currentSong.ytId
        if (st.status === 'playing') {
          clearTimeout(audioRetryTimer)
          if (yt !== currentAudioYtId) {
            currentAudioYtId = yt
            audio.src = '/api/audio/' + encodeURIComponent(yt)
            audio.currentTime = 0
            await audio.play()
          } else if (audio.paused) {
            await audio.play()
          }
        } else if (st.status === 'loading' && yt !== currentAudioYtId) {
          currentAudioYtId = yt
          audio.src = ''
          scheduleAudioRetry(yt)
        }
      } else if (st.status === 'paused') {
        audio.pause()
      } else if (st.status === 'idle') {
        audio.pause()
        audio.src = ''
        currentAudioYtId = null
        clearTimeout(audioRetryTimer)
      }
    } catch (err) {
      toast('Tap to start playback')
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
      toast('Still blocked — tap again')
    }
  }

  audio.addEventListener('ended', () => {
    if (isClaimed(playerState)) {
      fetch('/api/player/next', { method: 'POST' }).catch(() => {})
    }
  })

  audio.addEventListener('error', () => {
    if (audio.src && currentAudioYtId) {
      scheduleAudioRetry(currentAudioYtId)
    }
  })

  /* ---------------- renderers ---------------- */

  function renderHero() {
    const st = playerState
    const song = st.currentSong
    const isEmpty = !song
    const claimed = isClaimed(st)

    $('#hero-empty').classList.toggle('hidden', !isEmpty)
    $('#hero-active').classList.toggle('hidden', isEmpty)

    if (!isEmpty) {
      $('#hero-art').src = song.thumb || ''
      $('#hero-art').style.display = song.thumb ? '' : 'none'
      $('#hero-title').textContent = song.title || ''
      $('#hero-artist').textContent = song.channel || ''

      const statusMap = { idle: '', loading: 'Preparing\u2026', playing: 'Playing now', paused: 'Paused' }
      const statusEl = $('#hero-status')
      statusEl.textContent = statusMap[st.status] || ''
      statusEl.className = 'hero-status ' + (st.status || '')

      if (song.addedBy) {
        $('#hero-addedby').textContent = 'Added by ' + song.addedBy.name
        $('#hero-addedby').style.display = ''
      } else {
        $('#hero-addedby').style.display = 'none'
      }
    }

    // claim / speaker label / controls
    const claimBtn = $('#claim-btn')
    const speakerLbl = $('#speaker-label')
    const playbackCtrls = $('#playback-controls')
    const autoplayToggle = $('#autoplay-toggle')

    if (claimed) {
      claimBtn.classList.add('hidden')
      speakerLbl.classList.remove('hidden')
      speakerLbl.classList.add('is-me')
      speakerLbl.textContent = '\uD83D\uDD0A You\u2019re on aux'
      playbackCtrls.classList.remove('hidden')
      autoplayToggle.classList.remove('hidden')
    } else if (st.claimedBy) {
      claimBtn.classList.add('hidden')
      speakerLbl.classList.remove('hidden')
      speakerLbl.classList.remove('is-me')
      speakerLbl.textContent = 'Playing from ' + st.claimedBy.name + '\u2019s device'
      playbackCtrls.classList.add('hidden')
      autoplayToggle.classList.add('hidden')
    } else {
      claimBtn.classList.remove('hidden')
      speakerLbl.classList.add('hidden')
      playbackCtrls.classList.add('hidden')
      autoplayToggle.classList.add('hidden')
    }

    // playback buttons
    if (claimed) {
      const showPlay = st.status === 'idle' || st.status === 'paused' || st.status === 'loading'
      const showPause = st.status === 'playing'
      $('#btn-play').classList.toggle('hidden', !showPlay)
      $('#btn-pause').classList.toggle('hidden', !showPause)
      $('#btn-autoplay').checked = !!st.autoplay
    }
  }

  function renderParty() {
    const ul = $('#party-queue')
    const curId = playerState.currentSong ? playerState.currentSong.ytId : null

    const count = partyItems.length
    const countEl = $('#queue-count')
    countEl.textContent = count ? count + ' song' + (count === 1 ? '' : 's') : ''

    if (!count) {
      ul.innerHTML =
        '<li class="empty">' +
        'The room is quiet \uD83D\uDC40' +
        '<br>Add the first song and set the mood.' +
        '<br><a href="#" class="empty-action" id="empty-find">Find a song</a>' +
        '</li>'
      return
    }

    ul.innerHTML = partyItems
      .map((item) => {
        const s = item.song
        const isCurrent = s && s.ytId === curId
        const by = item.addedBy ? item.addedBy.name : ''
        return (
          '<li class="item' + (isCurrent ? ' current' : '') + '">' +
          '<img class="thumb" src="' + esc(s.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
          '<div class="meta">' +
          '<div class="title">' + esc(s.title) + '</div>' +
          '<div class="sub">' + esc(s.channel || '') + (by ? ' &middot; by ' + esc(by) : '') + '</div>' +
          '</div>' +
          '<div class="actions">' +
          (isCurrent ? '<button data-action="skip" title="Skip">&#9197;</button>' : '') +
          '<button class="btn-remove" data-action="party-remove" data-id="' + item.id + '" title="Remove from room">&#10005;</button>' +
          '</div>' +
          '</li>'
        )
      })
      .join('')
  }

  function renderResults(results) {
    const ul = $('#search-results')
    const emptyEl = $('#search-empty')

    if (!results.length && !ul.children.length) {
      ul.innerHTML = ''
      emptyEl.classList.remove('hidden')
      return
    }
    emptyEl.classList.add('hidden')

    if (!results.length) {
      ul.innerHTML = '<li class="empty">No matches this time.<br>Try a different title or artist.</li>'
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
          '<button class="btn-add" data-index="' + i + '" title="Add to room">+</button>' +
          '</div>' +
          '</li>'
        )
      })
      .join('')
  }

  function renderOnline(users) {
    const n = users.length
    const countEl = $('#online-count')
    countEl.textContent = n + ' people'
    const badge = $('#online-badge')
    badge.title = users.map((u) => u.name).join(', ')
  }

  /* ---------------- actions ---------------- */

  function applyPlayerState(st) {
    if (!st) return
    playerState = st
    renderHero()
    syncAudio(playerState)
  }

  async function loadParty() {
    try {
      const d = await api('/api/party')
      partyItems = d.items || []
      renderParty()
    } catch (err) {
      toast(err.message || 'Failed to load queue')
    }
  }

  async function loadPlayer() {
    try {
      const d = await api('/api/player/state')
      applyPlayerState(d.state)
    } catch (err) { /* ignore */ }
  }

  async function login() {
    const name = $('#login-name').value.trim()
    if (!name) {
      $('#login-error').textContent = 'Enter a name to join.'
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
    } catch (err) {
      $('#login-error').textContent = err.message || 'Login failed'
    }
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch (err) { /* ignore */ }
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
      toast(err.message || 'Search failed')
    }
  }

  async function addToRoom(song, btn) {
    if (!song) return
    btn.disabled = true
    try {
      await api('/api/party', jsonBody({ song }))
      btn.textContent = '\u2713'
      btn.classList.add('added')
      toast('Added to the room')
      loadParty()
    } catch (err) {
      if (err.status === 409) {
        toast('Already in the room')
        btn.textContent = '\u2713'
        btn.classList.add('added')
        loadParty()
      } else {
        toast(err.message || 'Failed to add')
        btn.disabled = false
      }
    }
  }

  async function skipParty() {
    try {
      await api('/api/party/skip', { method: 'POST' })
    } catch (err) {
      toast(err.message || 'Skip failed')
    }
  }

  async function removeParty(id) {
    try {
      await api('/api/party/' + id, { method: 'DELETE' })
      toast('Removed from the room')
    } catch (err) {
      toast(err.message || 'Remove failed')
    }
  }

  async function claim() {
    try {
      await api('/api/player/claim', { method: 'POST' })
      toast('You\u2019re on aux')
      await loadPlayer()
      await tryPlayNow()
    } catch (err) {
      toast(err.message || 'Failed to claim')
    }
  }

  async function ctlPlay() {
    try {
      const d = await api('/api/player/play', { method: 'POST' })
      applyPlayerState(d.state)
      await tryPlayNow()
    } catch (err) {
      toast(err.message || 'Play failed')
    }
  }

  async function ctlPause() {
    try {
      const d = await api('/api/player/pause', { method: 'POST' })
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'Pause failed')
    }
  }

  async function ctlNext() {
    try {
      const d = await api('/api/player/next', { method: 'POST' })
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'Next failed')
    }
  }

  async function ctlPrev() {
    try {
      const d = await api('/api/player/prev', { method: 'POST' })
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'Previous failed')
    }
  }

  async function toggleAutoplay(on) {
    try {
      const d = await api('/api/player/autoplay', jsonBody({ on }))
      applyPlayerState(d.state)
    } catch (err) {
      toast(err.message || 'Autoplay update failed')
      renderHero()
    }
  }

  /* ---------------- boot ---------------- */

  ;(async function boot() {
    try {
      const res = await fetch('/api/me')
      if (res.status === 401) { show('login'); return }
      const d = await res.json()
      if (d.user) {
        me = d.user
        show('home')
        loadParty()
        loadPlayer()
      } else {
        show('login')
      }
    } catch (err) {
      show('login')
    }
  })()

  /* ---------------- SSE ---------------- */

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
          }
        }
      } catch (err) { /* ignore */ }
    },
    party(e) {
      try {
        const d = JSON.parse(e.data)
        partyItems = d.items || []
        renderParty()
      } catch (err) { /* ignore */ }
    },
    player(e) {
      try {
        const d = JSON.parse(e.data)
        if (d.state) applyPlayerState(d.state)
      } catch (err) { /* ignore */ }
    },
    online(e) {
      try {
        const d = JSON.parse(e.data)
        renderOnline(d.users || [])
      } catch (err) { /* ignore */ }
    },
    toast(e) {
      try {
        const d = JSON.parse(e.data)
        if (d.msg) toast(d.msg)
      } catch (err) { /* ignore */ }
    },
  }

  for (const evt of Object.keys(esHandlers)) {
    es.addEventListener(evt, esHandlers[evt])
  }

  es.onopen = () => { $('#conn-banner').classList.add('hidden') }
  es.onerror = () => { $('#conn-banner').classList.remove('hidden') }

  /* ---------------- events ---------------- */

  // login
  $('#login-btn').addEventListener('click', login)
  $('#login-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') login() })

  // menu
  $('#menu-btn').addEventListener('click', () => {
    $('#overflow-menu').classList.toggle('hidden')
  })
  $('#leave-btn').addEventListener('click', logout)

  // close menu on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-btn') && !e.target.closest('#overflow-menu')) {
      $('#overflow-menu').classList.add('hidden')
    }
  })

  // search
  $('#search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch() })

  // hero controls
  $('#claim-btn').addEventListener('click', claim)
  $('#btn-play').addEventListener('click', ctlPlay)
  $('#btn-pause').addEventListener('click', ctlPause)
  $('#btn-next').addEventListener('click', ctlNext)
  $('#btn-prev').addEventListener('click', ctlPrev)
  $('#btn-autoplay').addEventListener('change', (e) => toggleAutoplay(e.target.checked))

  // queue & search result actions (delegated)
  document.addEventListener('click', (e) => {
    // empty state "Find a song" link
    if (e.target.id === 'empty-find' || e.target.closest('#empty-find')) {
      e.preventDefault()
      const input = $('#search-input')
      input.focus()
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const btn = e.target.closest('button[data-action], button.btn-add')
    if (!btn) return
    const action = btn.dataset.action
    if (action === 'skip') skipParty()
    else if (action === 'party-remove') removeParty(btn.dataset.id)
    else if (btn.classList.contains('btn-add')) addToRoom(searchResults[Number(btn.dataset.index)], btn)
  })
})()
