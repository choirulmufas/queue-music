import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sign, verify, identityFromRequest } from '../src/auth.js'

const SECRET = 'test-secret'

test('t10 sign/verify round-trips', () => {
  const token = sign(7, SECRET)
  assert.equal(verify(token, SECRET), 7)
})

test('t11 forged or malformed token rejected', () => {
  assert.equal(verify(`${sign(7, SECRET)}x`, SECRET), null)
  assert.equal(verify('nonsense.token', SECRET), null)
  assert.equal(verify('', SECRET), null)
  assert.equal(verify(null, SECRET), null)
  assert.equal(verify('abc', SECRET), null)
})

test('t12 identityFromRequest reads cookie', () => {
  const token = sign(3, SECRET)
  const req = { cookies: { qm_user: token } }
  assert.equal(identityFromRequest(req, SECRET), 3)
  assert.equal(identityFromRequest({ cookies: {} }, SECRET), null)
})

test('different secret rejects', () => {
  const token = sign(1, SECRET)
  assert.equal(verify(token, 'other'), null)
})