/** PIN rules shared by the app and the server, so both enforce the same values. */
export const PIN_LENGTH = 4
/** Minimum delay between two PIN attempts from the same IP. */
export const PIN_COOLDOWN_MS = 3000
/** Failed attempts after which an IP is banned for good (unban through the API). */
export const PIN_MAX_FAILURES = 3

/** What the server answers to a PIN attempt. */
export type PinResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number; retryAfterMs: number }
  | { ok: false; reason: 'cooldown'; retryAfterMs: number }
  | { ok: false; reason: 'banned' }
  | { ok: false; reason: 'offline' }
