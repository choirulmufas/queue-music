export function tailPosition(items) {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.position)) + 1
}

export function renumber(items) {
  return items
    .slice()
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .map((item, i) => ({ ...item, position: i }))
}

export function positionsFromOrderedIds(ids) {
  return ids.map((id, i) => ({ id, position: i }))
}

export function songToPayload(song) {
  if (!song) return null
  return {
    id: song.id,
    ytId: song.ytId,
    title: song.title,
    channel: song.channel,
    durationSec: song.durationSec,
    thumb: song.thumb,
  }
}