import type { Id } from '@chart/shared'
import { db, type Local } from '../db/db'
import { applySnapshots, type AnyRow, type TableName } from '../db/repo'

/** One row in an action: the version before (null = it didn't exist) and after. */
export type Snapshot = { table: TableName; id: Id; before: AnyRow | null; after: AnyRow }

function strip(row: Local<AnyRow>): AnyRow {
  const { dirty: _dirty, ...rest } = row
  return rest as AnyRow
}

// Dexie hooks are per database: one recorder at a time collects the user's writes (dirty = 1)
// made while an action runs. Sync writes (dirty = 0) are never recorded.
let recorder: Map<string, Snapshot> | null = null
const TABLES: TableName[] = ['boards', 'notes', 'arrows']
for (const name of TABLES) {
  const table = db[name] as unknown as typeof db.notes
  table.hook('creating', (_key, obj) => {
    if (!recorder || obj.dirty !== 1) return
    const k = `${name}:${obj.id}`
    const prev = recorder.get(k)
    recorder.set(k, { table: name, id: obj.id, before: prev ? prev.before : null, after: strip(obj) })
  })
  table.hook('updating', (mods, _key, obj) => {
    const merged = { ...obj, ...(mods as Partial<typeof obj>) }
    if (!recorder || merged.dirty !== 1) return
    const k = `${name}:${obj.id}`
    const prev = recorder.get(k)
    recorder.set(k, { table: name, id: obj.id, before: prev ? prev.before : strip(obj), after: strip(merged) })
  })
}

/** Undo / redo for one board, in memory. */
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
      push([...mine.values()])
    }
  }

  async function undo(): Promise<boolean> {
    const action = past.pop()
    if (!action) return false
    await applySnapshots(action.map((s) => ({ table: s.table, id: s.id, row: s.before })))
    future.push(action)
    changed()
    return true
  }

  async function redo(): Promise<boolean> {
    const action = future.pop()
    if (!action) return false
    await applySnapshots(action.map((s) => ({ table: s.table, id: s.id, row: s.after })))
    past.push(action)
    changed()
    return true
  }

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
