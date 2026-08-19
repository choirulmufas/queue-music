import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeSearch } from '../src/search.js'

function fakeSearchResult() {
  return {
    videos: [
      { videoId: 'ID1', title: 'Song One', author: { name: 'Artist A' }, duration: { seconds: 210 }, thumbnail: 't1.jpg' },
      { videoId: 'ID2', title: 'Song Two', author: { name: 'Artist B' }, duration: { seconds: 300 }, thumbnail: 't2.jpg' },
    ],
  }
}

const search = makeSearch({ searchFn: async () => fakeSearchResult() })

test('t50 search normalizes to payload shape', async () => {
  const results = await search('anything')
  assert.equal(results.length, 2)
  assert.deepEqual(results[0], {
    ytId: 'ID1', title: 'Song One', channel: 'Artist A', durationSec: 210, thumb: 't1.jpg',
  })
})

test('t50b limit applied', async () => {
  const s = makeSearch({ searchFn: async () => fakeSearchResult(), limit: 1 })
  assert.equal((await s('q')).length, 1)
})

test('t51 searchFn throwing propagates', async () => {
  const s = makeSearch({ searchFn: async () => { throw new Error('boom') } })
  await assert.rejects(() => s('q'), /boom/)
})

test('t52 empty query rejected', async () => {
  await assert.rejects(() => search(''), /query is required/)
  await assert.rejects(() => search('   '), /query is required/)
})