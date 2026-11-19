import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { createHistory } from './history'

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1000)
})
afterEach(() => vi.useRealTimers())

it('undo / redo a note creation', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  await h.record(() => repo.addNote(b.id, { x: 0, y: 0 }, 'yellow'))
  expect(h.canUndo()).toBe(true)
  await h.undo()
  expect(await repo.listNotes(b.id)).toHaveLength(0)
  expect(h.canRedo()).toBe(true)
  await h.redo()
  expect(await repo.listNotes(b.id)).toHaveLength(1)
})

it('undo a drag of two notes in one step', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 10, y: 10 }, 'yellow')
  vi.setSystemTime(2000)
  await h.record(() =>
    Promise.all([repo.updateNote(n1.id, { x: 100, y: 0 }), repo.updateNote(n2.id, { x: 110, y: 10 })]),
  )
  await h.undo()
  const xs = (await repo.listNotes(b.id)).map((n) => n.x).sort((a, z) => a - z)
  expect(xs).toEqual([0, 10])
  expect(h.canUndo()).toBe(false)
})

it('undo deleting a connected note restores its arrows in one step', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await repo.addArrow(b.id, n1.id, n2.id)
  vi.setSystemTime(3000)
  await h.record(() => repo.deleteNotes([n2.id]))
  await h.undo()
  expect(await repo.listNotes(b.id)).toHaveLength(2)
  expect(await repo.listArrows(b.id)).toHaveLength(1)
})

it('sync writes (dirty 0) made during an action are not recorded', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const remote = await repo.addNote(b.id, { x: 0, y: 0 }, 'pink')
  vi.setSystemTime(4000)
  await h.record(async () => {
    await db.notes.put({
      ...(await db.notes.get(remote.id))!,
      html: '<p>arrivé par la synchro</p>',
      updatedAt: 9000,
      dirty: 0,
    })
    await repo.addNote(b.id, { x: 5, y: 5 }, 'yellow')
  })
  await h.undo()
  expect((await db.notes.get(remote.id))!.html).toBe('<p>arrivé par la synchro</p>')
  expect(await repo.listNotes(b.id)).toHaveLength(1)
})

it('a new action clears the redo stack', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  await h.record(() => repo.addNote(b.id, { x: 0, y: 0 }, 'yellow'))
  await h.undo()
  await h.record(() => repo.addNote(b.id, { x: 1, y: 1 }, 'yellow'))
  expect(h.canRedo()).toBe(false)
})

it('keeps only the last `limit` actions', async () => {
  const h = createHistory(3)
  const b = await repo.createBoard('A')
  for (let i = 0; i < 4; i++) await h.record(() => repo.addNote(b.id, { x: i, y: 0 }, 'yellow'))
  let undone = 0
  while (await h.undo()) undone++
  expect(undone).toBe(3)
  expect(await repo.listNotes(b.id)).toHaveLength(1)
})

it('undoing a move keeps text that arrived from another device since', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  vi.setSystemTime(2000)
  await h.record(() => repo.updateNote(n.id, { x: 100, y: 0 }))
  await db.notes.put({ ...(await db.notes.get(n.id))!, html: '<p>écrit sur l’iPad</p>', updatedAt: 3000, dirty: 0 })
  vi.setSystemTime(4000)
  await h.undo()
  expect(await db.notes.get(n.id)).toMatchObject({ x: 0, html: '<p>écrit sur l’iPad</p>' })
})

it('undoing a move does not bring back a note deleted elsewhere', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  vi.setSystemTime(2000)
  await h.record(() => repo.updateNote(n.id, { x: 100, y: 0 }))
  await db.notes.put({ ...(await db.notes.get(n.id))!, deleted: true, updatedAt: 3000, dirty: 0 })
  vi.setSystemTime(4000)
  await h.undo()
  expect((await db.notes.get(n.id))!.deleted).toBe(true)
})

it('redo of a creation keeps the text typed since', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await h.record(() => repo.addNote(b.id, { x: 0, y: 0 }, 'yellow'))
  vi.setSystemTime(2000)
  await repo.updateNote(n.id, { html: '<p>Insuline</p>' }) // not recorded (e.g. a session that ended oddly)
  await h.undo()
  expect(await repo.listNotes(b.id)).toHaveLength(0)
  await h.redo()
  expect((await repo.listNotes(b.id))[0].html).toBe('<p>Insuline</p>')
})

it('a field changed again since the action is left alone', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  vi.setSystemTime(2000)
  await h.record(() => repo.updateNote(n.id, { color: 'pink' }))
  vi.setSystemTime(3000)
  await repo.updateNote(n.id, { color: 'blue' })
  await h.undo()
  expect((await db.notes.get(n.id))!.color).toBe('blue')
})

it('a writing session pushed by hand is one step that only touches the text', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  vi.setSystemTime(2000)
  await repo.updateNote(n.id, { html: '<p>Insuline</p>', x: 50 })
  h.push([{ table: 'notes', id: n.id, before: { html: '<p></p>' }, after: { html: '<p>Insuline</p>' } }])
  vi.setSystemTime(3000)
  await h.undo()
  expect(await db.notes.get(n.id)).toMatchObject({ html: '<p></p>', x: 50 })
})

it('two undos fired back to back undo two different steps', async () => {
  const h = createHistory()
  const b = await repo.createBoard('A')
  const n = await h.record(() => repo.addNote(b.id, { x: 0, y: 0 }, 'yellow'))
  vi.setSystemTime(2000)
  await h.record(() => repo.updateNote(n.id, { color: 'pink' }))
  vi.setSystemTime(3000)
  await Promise.all([h.undo(), h.undo()])
  expect(await repo.listNotes(b.id)).toHaveLength(0)
  expect(h.canUndo()).toBe(false)
})
