import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'qm_user'

function sign(id, secret) {
  return `${id}.${createHmac('sha256', secret).update(String(id)).digest('base64url')}`
}

function verify(token, secret) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const id = Number(parts[0])
  if (!Number.isInteger(id) || id < 1) return null
  const expected = sign(id, secret)
  const a = Buffer.from(parts[1])
  const b = Buffer.from(expected.split('.')[1])
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? id : null
}

export function setAuthCookie(reply, id, secret) {
  return reply.setCookie(COOKIE_NAME, sign(id, secret), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function identityFromRequest(request, secret) {
  const token = request.cookies?.[COOKIE_NAME]
  return verify(token, secret)
}

export const COOKIE = COOKIE_NAME
export { sign, verify }