import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { PIN_COOLDOWN_MS } from '@chart/shared'
import { openDb } from './db'
import { createAuth, samePin } from './auth'

const HOUR = 3_600_000
let db: DatabaseSync
let t: number
const now = () => t
const failures = () => (db.prepare('SELECT COUNT(*) AS n FROM login_failures').get() as { n: number }).n

beforeEach(() => {
  db = openDb(':memory:')
  t = 1_000_000_000
})

it('right PIN returns ok and a session token that checkSession accepts', () => {
  const auth = createAuth(db, { pin: '2468', now })
  const { result, token } = auth.attempt('1.1.1.1', '2468')
  expect(result).toEqual({ ok: true })
  expect(token).toMatch(/^[\w-]{40,}$/)
  expect(auth.checkSession(token)).toBe(true)
})

it('wrong PIN answers wrong with retryAfterMs = PIN_COOLDOWN_MS', () => {
  const auth = createAuth(db, { pin: '2468', now })
  expect(auth.attempt('1.1.1.1', '1111')).toEqual({ result: { ok: false, reason: 'wrong', retryAfterMs: PIN_COOLDOWN_MS } })
  expect(failures()).toBe(1)
})

it('a second attempt from the same IP within 3 s answers cooldown and is not counted', () => {
  const auth = createAuth(db, { pin: '2468', now })
  auth.attempt('1.1.1.1', '1111')
  t += 1000
  expect(auth.attempt('1.1.1.1', '2468').result).toEqual({ ok: false, reason: 'cooldown', retryAfterMs: 2000 })
  expect(failures()).toBe(1)
  t += 2000
  expect(auth.attempt('1.1.1.1', '2468').result).toEqual({ ok: true })
})

it("another IP is not slowed by the first one's cooldown", () => {
  const auth = createAuth(db, { pin: '2468', now })
  auth.attempt('1.1.1.1', '1111')
  expect(auth.attempt('2.2.2.2', '2468').result).toEqual({ ok: true })
})

it('30 failures in 24 h lock new logins for everyone until the oldest leaves the window', () => {
  const auth = createAuth(db, { pin: '2468', now })
  const first = t
  for (let i = 0; i < 30; i++) {
    auth.attempt(`10.0.0.${i}`, '0000')
    t += 60_000
  }
  expect(auth.attempt('9.9.9.9', '2468').result).toEqual({ ok: false, reason: 'locked', retryAfterMs: first + 24 * HOUR - t })
  t = first + 24 * HOUR
  expect(auth.attempt('9.9.9.9', '2468').result).toEqual({ ok: true })
})

it('an unknown or expired session is rejected', () => {
  const auth = createAuth(db, { pin: '2468', now })
  expect(auth.checkSession(undefined)).toBe(false)
  expect(auth.checkSession('not-a-token')).toBe(false)
  const { token } = auth.attempt('1.1.1.1', '2468')
  t += 366 * 24 * HOUR
  expect(auth.checkSession(token)).toBe(false)
})

it('samePin compares without throwing on different lengths', () => {
  expect(samePin('2468', '2468')).toBe(true)
  expect(samePin('2468', '2469')).toBe(false)
  expect(samePin('2468', '24680')).toBe(false)
  expect(samePin('2468', '')).toBe(false)
})

it('changing APP_PIN revokes every session made under the old one', () => {
  const { token } = createAuth(db, { pin: '2468', now }).attempt('1.1.1.1', '2468')
  expect(createAuth(db, { pin: '2468', now }).checkSession(token)).toBe(true)
  expect(createAuth(db, { pin: '1357', now }).checkSession(token)).toBe(false)
})
