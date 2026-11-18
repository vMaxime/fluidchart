import type { Id } from '@chart/shared'
import { db } from './db'
import { updateNote } from './repo'

// Crash-safe journal for note text being typed. IndexedDB writes started during
// pagehide/unload are dropped by browsers; a synchronous localStorage write survives.
// Each keystroke journals the draft; a successful IndexedDB save clears it; startup replays leftovers.

const PREFIX = 'chart.journal.'

export function journalNoteHtml(id: Id, html: string): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify({ html, at: Date.now() }))
  } catch {
    // storage full or blocked: the debounced IndexedDB save still runs
  }
}

/** Clears the draft only if it is the one that was just saved (a newer draft is kept). */
export function clearJournal(id: Id, savedHtml: string): void {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (raw && JSON.parse(raw).html === savedHtml) localStorage.removeItem(PREFIX + id)
  } catch {
    // unreadable entry: replayJournal will drop it
  }
}

/** Writes leftover drafts into their notes; returns how many were applied. */
export async function replayJournal(): Promise<number> {
  let keys: string[]
  try {
    keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
  } catch {
    return 0
  }
  let applied = 0
  for (const key of keys) {
    const id = key.slice(PREFIX.length)
    try {
      const { html } = JSON.parse(localStorage.getItem(key) ?? '') as { html: unknown }
      const row = await db.notes.get(id)
      if (typeof html === 'string' && row && !row.deleted && row.html !== html) {
        await updateNote(id, { html })
        applied++
      }
    } catch {
      // malformed entry: drop it
    }
    localStorage.removeItem(key)
  }
  return applied
}
