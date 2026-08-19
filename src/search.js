import yts from 'yt-search'

function normalizeVideo(v) {
  return {
    ytId: v.videoId ?? '',
    title: v.title ?? '',
    channel: v.author?.name ?? '',
    durationSec: typeof v.duration?.seconds === 'number' ? v.duration.seconds : 0,
    thumb: v.thumbnail ?? '',
  }
}

export function makeSearch({ searchFn = yts.search, limit = 10 } = {}) {
  return async function search(query) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      const e = new Error('query is required')
      e.statusCode = 400
      throw e
    }
    const res = await searchFn(query)
    const videos = Array.isArray(res)
      ? res
      : (res?.videos ?? [])
    return videos.slice(0, limit).map(normalizeVideo).filter((v) => v.ytId)
  }
}