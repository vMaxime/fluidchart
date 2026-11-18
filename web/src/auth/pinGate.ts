import { PIN_LENGTH, type PinResult } from '@chart/shared'

export type PinStatus = 'idle' | 'checking' | 'cooldown' | 'locked' | 'open'

export type PinState = {
  status: PinStatus
  digits: string
  /** When the cooldown or lock ends (ms since epoch). */
  retryAt: number | null
  /** The last answer was a wrong code. */
  wrong: boolean
  offline: boolean
  /** Bumps on every wrong code, so the dots can shake again. */
  wrongCount: number
}

export type PinAction =
  | { type: 'digit'; digit: string }
  | { type: 'erase' }
  | { type: 'result'; result: PinResult; now: number }
  | { type: 'tick'; now: number }

export const initialPinState: PinState = {
  status: 'idle',
  digits: '',
  retryAt: null,
  wrong: false,
  offline: false,
  wrongCount: 0,
}

/** The PIN screen's rules: 4 digits, then the server decides; cooldowns and locks freeze the keypad. */
export function pinReducer(s: PinState, a: PinAction): PinState {
  switch (a.type) {
    case 'digit': {
      if (s.status !== 'idle' || !/^\d$/.test(a.digit)) return s
      const digits = s.digits + a.digit
      return { ...s, digits, offline: false, status: digits.length === PIN_LENGTH ? 'checking' : 'idle' }
    }
    case 'erase':
      return s.status === 'idle' ? { ...s, digits: s.digits.slice(0, -1) } : s
    case 'tick':
      return (s.status === 'cooldown' || s.status === 'locked') && s.retryAt !== null && a.now >= s.retryAt
        ? { ...s, status: 'idle', retryAt: null }
        : s
    case 'result': {
      const r = a.result
      if (r.ok) return { ...s, status: 'open', digits: '', wrong: false }
      switch (r.reason) {
        case 'wrong':
          return {
            ...s,
            status: 'cooldown',
            digits: '',
            retryAt: a.now + r.retryAfterMs,
            wrong: true,
            wrongCount: s.wrongCount + 1,
          }
        case 'cooldown':
          return { ...s, status: 'cooldown', digits: '', retryAt: a.now + r.retryAfterMs }
        case 'locked':
          return {
            ...s,
            status: 'locked',
            digits: '',
            retryAt: a.now + r.retryAfterMs,
            wrong: true,
            wrongCount: s.wrongCount + 1,
          }
        case 'offline':
          return { ...s, status: 'idle', digits: '', offline: true }
      }
    }
  }
}

const readableDelay = (ms: number) => {
  const s = Math.max(1, Math.ceil(ms / 1000))
  if (s >= 3600) return `${Math.ceil(s / 3600)} h`
  if (s >= 60) return `${Math.ceil(s / 60)} min`
  return `${s} s`
}

/** The line under the dots. */
export function pinMessage(s: PinState, now: number): string | null {
  if (s.status === 'locked' && s.retryAt !== null)
    return `Trop de codes incorrects pour le moment. Réessayez dans ${readableDelay(s.retryAt - now)}.`
  if (s.offline) return 'Connexion impossible. Le premier déverrouillage de cet appareil demande une connexion.'
  const parts: string[] = []
  if (s.wrong) parts.push('Code incorrect.')
  if (s.status === 'cooldown' && s.retryAt !== null)
    parts.push(`Nouvel essai dans ${Math.max(1, Math.ceil((s.retryAt - now) / 1000))} s`)
  return parts.length ? parts.join(' ') : null
}
