import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tailPosition, renumber, positionsFromOrderedIds, songToPayload } from '../src/queue.js'

test('t30 tailPosition is max+1', () => {
  assert.equal(tailPosition([]), 0)
  assert.equal(tailPosition([{ position: 0 }, { position: 2 }]), 3)
})

test('t31 renumber fills gaps, stable by id on ties', () => {
  const out = renumber([
    { id: 3, position: 5 },
    { id: 1, position: 0 },
    { id: 2, position: 0 },
  ])
  assert.deepEqual(out.map((i) => i.position), [0, 1, 2])
  assert.deepEqual(out.map((i) => i.id), [1, 2, 3])
})

test('t32 positionsFromOrderedIds maps index', () => {
  assert.deepEqual(positionsFromOrderedIds([10, 20]), [{ id: 10, position: 0 }, { id: 20, position: 1 }])
})

test('songToPayload null-safe & shaped', () => {
  assert.equal(songToPayload(null), null)
  assert.deepEqual(songToPayload({ id: 1, ytId: 'ABC', title: 'T', channel: 'C', durationSec: 5, thumb: 'x' }), {
    id: 1, ytId: 'ABC', title: 'T', channel: 'C', durationSec: 5, thumb: 'x',
  })
})