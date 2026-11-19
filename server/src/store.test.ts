import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { newBoard, newNote, type EntityChange, type Note } from '@chart/shared'
import { openDb } from './db'
import { applyChanges, changesSince, serverId } from './store'

let db: DatabaseSync
beforeEach(() => {
  db = openDb(':memory:')
})
const note = (html: string, updatedAt: number): EntityChange => ({ kind: 'note', row: { ...newNote('b1', { x: 0, y: 0 }, 'yellow', updatedAt), id: 'n1', html } })

it('applyChanges stores new rows and changesSince returns them with a cursor', () => {
  const board: EntityChange = { kind: 'board', row: { ...newBoard('Cardio', 1), id: 'b1' } }
  applyChanges(db, [board, note('<p>A</p>', 1)])
  const res = changesSince(db, 0)
  expect(res.changes).toEqual([board, note('<p>A</p>', 1)])
  expect(res.cursor).toBe(2)
  expect(changesSince(db, res.cursor)).toEqual({ cursor: 2, changes: [] })
})

it('an older or equal updatedAt never overwrites', () => {
  applyChanges(db, [note('<p>B</p>', 2)])
  applyChanges(db, [note('<p>A</p>', 1), note('<p>A</p>', 2)])
  expect((changesSince(db, 0).changes[0].row as Note).html).toBe('<p>B</p>')
  expect(changesSince(db, 0).cursor).toBe(1)
})

it('a newer updatedAt overwrites and moves past the cursor', () => {
  applyChanges(db, [note('<p>A</p>', 1)])
  const c1 = changesSince(db, 0).cursor
  applyChanges(db, [note('<p>C</p>', 3)])
  const res = changesSince(db, c1)
  expect(res.changes.map((c) => (c.row as Note).html)).toEqual(['<p>C</p>'])
  expect(res.cursor).toBeGreaterThan(c1)
})

it('tombstones travel like any change', () => {
  applyChanges(db, [note('<p>A</p>', 1)])
  const dead: EntityChange = { kind: 'note', row: { ...(note('<p>A</p>', 5).row as Note), deleted: true } }
  applyChanges(db, [dead])
  expect(changesSince(db, 1).changes).toEqual([dead])
})

it('applyChanges returns the stored winner for each rejected change', () => {
  applyChanges(db, [note('<p>serveur</p>', 5)])
  const rejected = applyChanges(db, [note('<p>ancien</p>', 3), note('<p>égal</p>', 5)])
  expect(rejected.map((c) => (c.row as Note).html)).toEqual(['<p>serveur</p>', '<p>serveur</p>'])
  expect(applyChanges(db, [note('<p>récent</p>', 9)])).toEqual([])
})

it('the server id is stable, and a fresh database gets a different one', () => {
  const id = serverId(db)
  expect(id).toMatch(/^[\w-]{16,}$/)
  expect(serverId(db)).toBe(id)
  expect(serverId(openDb(':memory:'))).not.toBe(id)
})
