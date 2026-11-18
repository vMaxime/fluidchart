import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { PIN_COOLDOWN_MS, type PinResult } from '@chart/shared'

const DAY = 24 * 3_600_000
const SESSION_MS = 365 * DAY
const GLOBAL_WINDOW_MS = DAY
const GLOBAL_MAX_FAILURES = 30

const sha256 = (s: string) => createHash('sha256').update(s).digest()

/** Constant-time PIN comparison (hashing first gives equal-length buffers). */
export function samePin(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

/**
 * PIN login rules: a shared cooldown between attempts per IP (an attempt during it is refused but not
 * counted), a global cap of 30 failures per rolling 24 h for all IPs, and long-lived sessions.
 */
export function createAuth(db: DatabaseSync, opts: { pin: string; now?: () => number }) {
  const now = opts.now ?? Date.now
  const lastAttempt = new Map<string, number>()

  const purge = db.prepare('DELETE FROM login_failures WHERE at <= ?')
  const recentFailures = db.prepare('SELECT COUNT(*) AS n, MIN(at) AS oldest FROM login_failures WHERE at > ?')
  const recordFailure = db.prepare('INSERT INTO login_failures (at) VALUES (?)')
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)')
  const findSession = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
  const purgeSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?')

  function attempt(ip: string, pin: string): { result: PinResult; token?: string } {
    const t = now()
    purge.run(t - GLOBAL_WINDOW_MS)
    const { n, oldest } = recentFailures.get(t - GLOBAL_WINDOW_MS) as { n: number; oldest: number | null }
    if (n >= GLOBAL_MAX_FAILURES && oldest !== null)
      return { result: { ok: false, reason: 'locked', retryAfterMs: oldest + GLOBAL_WINDOW_MS - t } }

    const last = lastAttempt.get(ip)
    if (last !== undefined && t - last < PIN_COOLDOWN_MS)
      return { result: { ok: false, reason: 'cooldown', retryAfterMs: PIN_COOLDOWN_MS - (t - last) } }
    lastAttempt.set(ip, t)

    if (!samePin(pin, opts.pin)) {
      recordFailure.run(t)
      return { result: { ok: false, reason: 'wrong', retryAfterMs: PIN_COOLDOWN_MS } }
    }
    purgeSessions.run(t)
    const token = randomBytes(32).toString('base64url')
    insertSession.run(sha256(token).toString('hex'), t + SESSION_MS)
    return { result: { ok: true }, token }
  }

  function checkSession(token: string | undefined): boolean {
    if (!token) return false
    const row = findSession.get(sha256(token).toString('hex')) as { expires_at: number } | undefined
    return !!row && row.expires_at > now()
  }

  return { attempt, checkSession }
}
