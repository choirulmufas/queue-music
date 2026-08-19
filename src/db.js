import Database from 'better-sqlite3'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  yt_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  thumb TEXT NOT NULL DEFAULT '',
  added_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS user_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  song_id INTEGER NOT NULL REFERENCES songs(id),
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, song_id)
);
CREATE TABLE IF NOT EXISTS party_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id),
  added_by INTEGER REFERENCES users(id),
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS player_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'idle',
  current_song_id INTEGER REFERENCES songs(id),
  position_index INTEGER NOT NULL DEFAULT 0,
  position_sec INTEGER NOT NULL DEFAULT 0,
  autoplay INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO player_state (id) VALUES (1);
`

function toSong(row) {
  if (!row) return null
  return {
    id: row.id,
    ytId: row.yt_id,
    title: row.title,
    channel: row.channel,
    durationSec: row.duration_sec,
    thumb: row.thumb,
    addedBy: row.added_by ?? null,
  }
}

export function createDB(file = ':memory:') {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  function createUser(name) {
    db.prepare('INSERT INTO users (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name = excluded.name').run(name)
    return db.prepare('SELECT id, name FROM users WHERE name = ?').get(name)
  }

  function getUser(id) {
    return db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) ?? null
  }

  function addSong({ ytId, title, channel = '', durationSec = 0, thumb = '', addedBy = null }) {
    db.prepare(
      `INSERT INTO songs (yt_id, title, channel, duration_sec, thumb, added_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(yt_id) DO UPDATE SET
         title = excluded.title,
         channel = excluded.channel,
         duration_sec = excluded.duration_sec,
         thumb = excluded.thumb,
         added_by = COALESCE(excluded.added_by, songs.added_by)`
    ).run(ytId, title, channel, durationSec, thumb, addedBy)
    return toSong(db.prepare('SELECT * FROM songs WHERE yt_id = ?').get(ytId))
  }

  function getSong(ytId) {
    return toSong(db.prepare('SELECT * FROM songs WHERE yt_id = ?').get(ytId))
  }

  function getSongById(id) {
    return toSong(db.prepare('SELECT * FROM songs WHERE id = ?').get(id))
  }

  function addToUserQueue(userId, songId) {
    const exists = db.prepare('SELECT id FROM user_queue WHERE user_id = ? AND song_id = ?').get(userId, songId)
    if (exists) return { id: exists.id, songId, duplicate: true }
    const pos = (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM user_queue WHERE user_id = ?').get(userId).m) + 1
    const info = db.prepare('INSERT INTO user_queue (user_id, song_id, position) VALUES (?, ?, ?)').run(userId, songId, pos)
    return { id: info.lastInsertRowid, songId, duplicate: false }
  }

  function getUserQueue(userId) {
    return db.prepare(
      `SELECT q.id AS qid, s.* FROM user_queue q
       JOIN songs s ON s.id = q.song_id
       WHERE q.user_id = ?
       ORDER BY q.position ASC, q.id ASC`
    ).all(userId).map((row, i) => ({ id: row.qid, position: i, song: toSong(row) }))
  }

  function removeFromUserQueue(itemId, userId) {
    const info = db.prepare('DELETE FROM user_queue WHERE id = ? AND user_id = ?').run(itemId, userId)
    renumberUser(userId)
    return info.changes > 0
  }

  function renumberUser(userId) {
    const rows = db.prepare('SELECT id FROM user_queue WHERE user_id = ? ORDER BY position ASC, id ASC').all(userId)
    const upd = db.prepare('UPDATE user_queue SET position = ? WHERE id = ?')
    rows.forEach((r, i) => upd.run(i, r.id))
  }

  function reorderUserQueue(userId, orderedIds) {
    const owned = new Set(db.prepare('SELECT id FROM user_queue WHERE user_id = ?').all(userId).map((r) => r.id))
    if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
      const e = new Error('reorder ids must match current queue exactly')
      e.statusCode = 400
      throw e
    }
    const upd = db.prepare('UPDATE user_queue SET position = ? WHERE id = ? AND user_id = ?')
    orderedIds.forEach((id, i) => upd.run(i, id, userId))
    return getUserQueue(userId)
  }

  function addToPartyQueue(songId, addedBy = null) {
    const pos = (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM party_queue').get().m) + 1
    const info = db.prepare('INSERT INTO party_queue (song_id, added_by, position) VALUES (?, ?, ?)').run(songId, addedBy, pos)
    return getPartyItem(info.lastInsertRowid)
  }

  function getPartyItem(id) {
    const row = db.prepare(
      `SELECT q.id AS qid, q.added_by AS author_id, q.position AS qpos, s.*
       FROM party_queue q JOIN songs s ON s.id = q.song_id
       WHERE q.id = ?`
    ).get(id)
    if (!row) return null
    return {
      id: row.qid,
      position: row.qpos,
      addedBy: row.author_id == null ? null : db.prepare('SELECT id, name FROM users WHERE id = ?').get(row.author_id),
      song: toSong(row),
    }
  }

  function getPartyQueue() {
    const rows = db.prepare(
      `SELECT q.id AS qid, q.added_by AS author_id, q.position AS qpos, s.*
       FROM party_queue q JOIN songs s ON s.id = q.song_id
       ORDER BY q.position ASC, q.id ASC`
    ).all()
    const users = new Map(db.prepare('SELECT id, name FROM users').all().map((u) => [u.id, u]))
    return rows.map((row) => ({
      id: row.qid,
      position: row.qpos,
      addedBy: row.author_id == null ? null : users.get(row.author_id) ?? null,
      song: toSong(row),
    }))
  }

  function partyCount() {
    return db.prepare('SELECT COUNT(*) AS c FROM party_queue').get().c
  }

  function partyAtPosition(index) {
    const row = db.prepare(
      `SELECT q.id AS qid, s.* FROM party_queue q
       JOIN songs s ON s.id = q.song_id
       ORDER BY q.position ASC, q.id ASC LIMIT 1 OFFSET ?`
    ).get(index)
    if (!row) return null
    return { id: row.qid, index, song: toSong(row) }
  }

  function removePartyItem(itemId) {
    const info = db.prepare('DELETE FROM party_queue WHERE id = ?').run(itemId)
    renumberParty()
    return info.changes > 0
  }

  function renumberParty() {
    const rows = db.prepare('SELECT id FROM party_queue ORDER BY position ASC, id ASC').all()
    const upd = db.prepare('UPDATE party_queue SET position = ? WHERE id = ?')
    rows.forEach((r, i) => upd.run(i, r.id))
  }

  function getPlayerState() {
    const row = db.prepare('SELECT * FROM player_state WHERE id = 1').get()
    if (!row) return { status: 'idle', index: 0, autoplay: 0, positionSec: 0, currentSong: null }
    return {
      status: row.status,
      index: row.position_index,
      autoplay: Boolean(row.autoplay),
      positionSec: row.position_sec,
      currentSong: row.current_song_id != null ? getSongById(row.current_song_id) : null,
    }
  }

  function setPlayerState(partial) {
    const now = Date.now() / 1000 | 0
    const cur = getPlayerState()
    const songId = partial.currentSongId === undefined
      ? (cur.currentSong ? cur.currentSong.id : null)
      : partial.currentSongId
    db.prepare(
      `UPDATE player_state SET
         status = ?, current_song_id = ?, position_index = ?, position_sec = ?, autoplay = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      partial.status ?? cur.status,
      songId,
      partial.index ?? cur.index,
      partial.positionSec ?? cur.positionSec,
      partial.autoplay === undefined ? +Boolean(cur.autoplay) : +Boolean(partial.autoplay),
      now
    )
    return getPlayerState()
  }

  return {
    createUser, getUser, addSong, getSong, getSongById,
    addToUserQueue, getUserQueue, removeFromUserQueue, reorderUserQueue,
    addToPartyQueue, getPartyQueue, partyCount, partyAtPosition, removePartyItem,
    getPlayerState, setPlayerState,
    raw: db,
  }
}