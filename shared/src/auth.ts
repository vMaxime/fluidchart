/** PIN rules shared by the app and the server, so both enforce the same values. */
export const PIN_LENGTH = 4
/** Minimum delay between two PIN attempts from the same IP. */
export const PIN_COOLDOWN_MS = 3000

/** What the server answers to a PIN attempt. */
export type PinResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; retryAfterMs: number }
  | { ok: false; reason: 'cooldown'; retryAfterMs: number }
  /** Too many failures overall (all IPs, rolling 24 h): new logins wait until the window frees up. */
  | { ok: false; reason: 'locked'; retryAfterMs: number }
  | { ok: false; reason: 'offline' }
