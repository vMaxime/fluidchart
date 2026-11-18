import { it, expect } from 'vitest'
import { notesLabel, relativeTime } from './relativeTime'

const now = new Date('2026-11-18T15:00:00').getTime()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

it('says how long ago, in French, then switches to a short date after a week', () => {
  expect(relativeTime(now - 20_000, now)).toBe("à l'instant")
  expect(relativeTime(now - 25 * MIN, now)).toBe('il y a 25 minutes')
  expect(relativeTime(now - 3 * HOUR, now)).toBe('il y a 3 heures')
  expect(relativeTime(now - DAY, now)).toBe('hier')
  expect(relativeTime(now - 3 * DAY, now)).toBe('il y a 3 jours')
  expect(relativeTime(now - 10 * DAY, now)).toBe('8 nov.')
})

it('labels note counts', () => {
  expect(notesLabel(0)).toBe('vide')
  expect(notesLabel(1)).toBe('1 post-it')
  expect(notesLabel(14)).toBe('14 post-it')
})
