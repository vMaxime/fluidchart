import type { Id } from '@chart/shared'
import { db } from '../db/db'
import { applyFieldChanges, type FieldChange, type Fields, type TableName } from '../db/repo'

/**
 * One row in an action, as the fields the action changed: `before` → `after`.
 * `before: null` means the action created the row (undo hides it, redo shows it again).
 */
export type Snapshot = { table: TableName; id: Id; before: Fields | null; after: Fields }

const IGNORED = new Set(['updatedAt', 'dirty', 'id'])

/** Turns the full rows captured during an action into the fields it actually changed. */
function toSnapshot(table: TableName, id: Id, before: Fields | null, after: Fields): Snapshot | null {
  if (before === null) return { table, id, before: null, after: { deleted: false } }
  const keys = Object.keys(after).filter((k) => !IGNORED.has(k) && before[k] !== after[k])
  if (!keys.length) return null
  const pick = (row: Fields) => Object.fromEntries(keys.map((k) => [k, row[k]]))
  return { table, id, before: pick(before), after: pick(after) }
}

// Dexie hooks are per database: one recorder at a time collects the user's writes (dirty = 1)
// made while an action runs. Sync writes (dirty = 0) are never recorded.
type Capture = { table: TableName; id: Id; before: Fields | null; after: Fields }
let recorder: Map<string, Capture> | null = null
const TABLES: TableName[] = ['boards', 'notes', 'arrows']
for (const name of TABLES) {
  const table = db[name] as unknown as typeof db.notes
  table.hook('creating', (_key, obj) => {
    if (!recorder || obj.dirty !== 1) return
    const k = `${name}:${obj.id}`
    recorder.set(k, { table: name, id: obj.id, before: recorder.get(k)?.before ?? null, after: { ...obj } })
  })
  table.hook('updating', (mods, _key, obj) => {
    const merged = { ...obj, ...(mods as Partial<typeof obj>) }
    if (!recorder || merged.dirty !== 1) return
    const k = `${name}:${obj.id}`
    const prev = recorder.get(k)
    recorder.set(k, { table: name, id: obj.id, before: prev ? prev.before : { ...obj }, after: { ...merged } })
  })
}

const undoChange = (s: Snapshot): FieldChange =>
  s.before === null
    ? { table: s.table, id: s.id, from: { deleted: false }, to: { deleted: true } }
    : { table: s.table, id: s.id, from: s.after, to: s.before }
const redoChange = (s: Snapshot): FieldChange =>
  s.before === null
    ? { table: s.table, id: s.id, from: { deleted: true }, to: { deleted: false } }
    : { table: s.table, id: s.id, from: s.before, to: s.after }

/** Undo / redo for one board, in memory. Undo only touches the fields an action changed. */
export function createHistory(limit = 100) {
  const past: Snapshot[][] = []
  const future: Snapshot[][] = []
  const listeners = new Set<() => void>()
  let version = 0
  const changed = () => {
    version++
    for (const l of listeners) l()
  }

  function push(action: Snapshot[]) {
    if (action.length === 0) return
    past.push(action)
    if (past.length > limit) past.shift()
    future.length = 0
    changed()
  }

  /** Runs `fn`, recording the user writes it makes as one action. */
  async function record<T>(fn: () => Promise<T>): Promise<T> {
    if (recorder) return fn() // nested: part of the outer action
    recorder = new Map()
    const mine = recorder
    try {
      return await fn()
    } finally {
      if (recorder === mine) recorder = null
      push([...mine.values()].flatMap((c) => toSnapshot(c.table, c.id, c.before, c.after) ?? []))
    }
  }

  // Undo / redo run one after another (⌘Z pressed twice quickly must undo two steps), and a step
  // leaves its stack only once its writes succeeded.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = (op: () => Promise<boolean>): Promise<boolean> => {
    const next = queue.then(op, op)
    queue = next.catch(() => undefined)
    return next
  }

  const undo = () =>
    serial(async () => {
      const action = past.at(-1)
      if (!action) return false
      await applyFieldChanges(action.map(undoChange))
      past.pop()
      future.push(action)
      changed()
      return true
    })

  const redo = () =>
    serial(async () => {
      const action = future.at(-1)
      if (!action) return false
      await applyFieldChanges(action.map(redoChange))
      future.pop()
      past.push(action)
      changed()
      return true
    })

  return {
    record,
    push,
    undo,
    redo,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    version: () => version,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export type History = ReturnType<typeof createHistory>
