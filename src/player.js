export class PlaybackManager {
  constructor({ db, bus, audio = null }) {
    this.db = db
    this.bus = bus
    this.audio = audio
    this.claimedBy = null
  }

  getState() {
    const st = this.db.getPlayerState()
    return {
      status: st.status,
      index: st.index,
      autoplay: Boolean(st.autoplay),
      positionSec: st.positionSec,
      currentSong: st.currentSong,
      claimedBy: this.claimedBy,
    }
  }

  _set(partial) {
    const state = this.db.setPlayerState(partial)
    this.bus.emit('player', { state: { ...state, claimedBy: this.claimedBy } })
    return state
  }

  claim(user) {
    this.claimedBy = user ? { id: user.id, name: user.name } : null
    this.bus.emit('player', { state: this.getState() })
    return this.claimedBy
  }

  play() {
    const st = this.db.getPlayerState()
    const count = this.db.partyCount()
    if (count === 0) return this.db.setPlayerState({ status: 'idle', index: 0, currentSongId: null })
    const index = Math.min(st.index, count - 1)
    const item = this.db.partyAtPosition(index)
    const next = this.db.setPlayerState({ status: 'loading', currentSongId: item.song.id, index })
    if (this.audio) this.ensureAudio(item.song)
    this.bus.emit('player', { state: { ...next, claimedBy: this.claimedBy } })
    return next
  }

  ensureAudio(song) {
    if (!song) return
    this.audio.ensure(song).then(({ ready }) => {
      if (!ready) return
      const st = this.db.getPlayerState()
      if (st.currentSong && st.currentSong.id === song.id && st.status === 'loading') {
        this.db.setPlayerState({ status: 'playing', positionSec: 0 })
        this.bus.emit('player', { state: this.getState() })
      }
    }).catch(() => {
      this.bus.emit('toast', { msg: `Audio failed: ${song.title}` })
    })
  }

  onTrackEnd() {
    const current = this.db.getPlayerState()
    const nextIndex = current.index + 1
    const next = this.db.partyAtPosition(nextIndex)
    if (next) {
      const st = this.db.setPlayerState({ status: 'loading', currentSongId: next.song.id, index: nextIndex, positionSec: 0 })
      if (this.audio) this.ensureAudio(next.song)
      this.bus.emit('player', { state: { ...st, claimedBy: this.claimedBy } })
      return st
    }
    if (current.autoplay) {
      const first = this.db.partyAtPosition(0)
      if (first) {
        const st = this.db.setPlayerState({ status: 'loading', currentSongId: first.song.id, index: 0, positionSec: 0 })
        if (this.audio) this.ensureAudio(first.song)
        this.bus.emit('player', { state: { ...st, claimedBy: this.claimedBy } })
        return st
      }
    }
    return this.db.setPlayerState({ status: 'idle', currentSongId: null, index: 0, positionSec: 0 })
  }

  next() {
    const st = this.onTrackEnd()
    this.bus.emit('player', { state: { ...st, claimedBy: this.claimedBy } })
    return st
  }

  pause() {
    const st = this.db.getPlayerState()
    if (st.status === 'playing' || st.status === 'loading') return this._set({ status: 'paused' })
    return st
  }

  resume() {
    const st = this.db.getPlayerState()
    if (st.status === 'paused') {
      if (this.audio && st.currentSong) this.ensureAudio(st.currentSong)
      return this._set({ status: 'playing' })
    }
    return st
  }

  setAutoplay(on) {
    return this._set({ autoplay: Boolean(on) })
  }

  setPosition(sec) {
    return this._set({ positionSec: sec })
  }
}