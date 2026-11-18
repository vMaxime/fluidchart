const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** "à l'instant", "il y a 25 minutes", "hier", "il y a 3 jours", then "8 nov." after a week. */
export function relativeTime(t: number, now = Date.now()): string {
  const d = now - t
  if (d < MIN) return "à l'instant"
  if (d < HOUR) return rtf.format(-Math.round(d / MIN), 'minute')
  if (d < DAY) return rtf.format(-Math.round(d / HOUR), 'hour')
  if (d < 7 * DAY) return rtf.format(-Math.round(d / DAY), 'day')
  return dateFmt.format(t)
}

export const notesLabel = (n: number) => (n === 0 ? 'vide' : n === 1 ? '1 post-it' : `${n} post-it`)
