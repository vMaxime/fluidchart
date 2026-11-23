import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { db } from './db'
import * as repo from './repo'

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1000)
})
afterEach(() => vi.useRealTimers())

it('createBoard then listBoards returns it with lastEditedAt = createdAt', async () => {
  const b = await repo.createBoard('Cardio')
  expect(await repo.listBoards()).toEqual([{ ...b, lastEditedAt: 1000, noteCount: 0, colors: [] }])
})

it('renameBoard normalizes blank names and bumps updatedAt', async () => {
  const b = await repo.createBoard('Cardio')
  vi.setSystemTime(2000)
  await repo.renameBoard(b.id, '   ')
  expect(await repo.getBoard(b.id)).toMatchObject({ name: 'Sans titre', updatedAt: 2000 })
})

it('note edits bump lastEditedAt but never Board.updatedAt', async () => {
  const b = await repo.createBoard('Cardio')
  vi.setSystemTime(3000)
  await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const [s] = await repo.listBoards()
  expect(s.lastEditedAt).toBe(3000)
  expect(s.updatedAt).toBe(1000)
})

it('listBoards sorts by lastEditedAt desc and hides deleted boards', async () => {
  const a = await repo.createBoard('A')
  vi.setSystemTime(2000)
  const b = await repo.createBoard('B')
  vi.setSystemTime(3000)
  await repo.addNote(a.id, { x: 0, y: 0 }, 'yellow')
  expect((await repo.listBoards()).map((x) => x.name)).toEqual(['A', 'B'])
  await repo.deleteBoard(b.id)
  expect((await repo.listBoards()).map((x) => x.name)).toEqual(['A'])
})

it('deleteBoard tombstones the board, its notes and arrows', async () => {
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const a = (await repo.addArrow(b.id, n1.id, n2.id))!
  vi.setSystemTime(5000)
  await repo.deleteBoard(b.id)
  for (const row of [await db.boards.get(b.id), await db.notes.get(n1.id), await db.arrows.get(a.id)])
    expect(row).toMatchObject({ deleted: true, dirty: 1, updatedAt: 5000 })
})

it('deleteNotes also tombstones arrows touching those notes', async () => {
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await repo.addArrow(b.id, n1.id, n2.id)
  await repo.deleteNotes([n2.id])
  expect(await repo.listNotes(b.id)).toHaveLength(1)
  expect(await repo.listArrows(b.id)).toHaveLength(0)
})

it('addArrow rejects self-loops and duplicates', async () => {
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  expect(await repo.addArrow(b.id, n1.id, n1.id)).toBeNull()
  expect(await repo.addArrow(b.id, n1.id, n2.id)).not.toBeNull()
  expect(await repo.addArrow(b.id, n1.id, n2.id)).toBeNull()
})

it('updateNote marks the row dirty with a fresh updatedAt', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await db.notes.update(n.id, { dirty: 0 })
  vi.setSystemTime(9000)
  await repo.updateNote(n.id, { html: '<p>Insuline</p>' })
  expect(await db.notes.get(n.id)).toMatchObject({ html: '<p>Insuline</p>', dirty: 1, updatedAt: 9000 })
})

it('renameBoard with an unchanged name writes nothing', async () => {
  const b = await repo.createBoard('Cardio')
  await db.boards.update(b.id, { dirty: 0 })
  vi.setSystemTime(2000)
  await repo.renameBoard(b.id, '  Cardio ')
  expect(await db.boards.get(b.id)).toMatchObject({ updatedAt: 1000, dirty: 0 })
})

it('listBoards counts live notes and lists their colours, most used first (max 3)', async () => {
  const b = await repo.createBoard('A')
  for (const c of ['pink', 'blue', 'pink', 'green', 'yellow', 'pink', 'blue'] as const)
    await repo.addNote(b.id, { x: 0, y: 0 }, c)
  const gone = await repo.addNote(b.id, { x: 0, y: 0 }, 'purple')
  await repo.deleteNotes([gone.id])
  const [s] = await repo.listBoards()
  expect(s.noteCount).toBe(7)
  expect(s.colors).toEqual(['pink', 'blue', 'yellow']) // ties (green, yellow) follow palette order
})

it('restoreBoard brings back the board with what was deleted with it, not earlier deletions', async () => {
  const b = await repo.createBoard('A')
  const kept = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const other = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const earlier = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await repo.addArrow(b.id, kept.id, other.id)
  vi.setSystemTime(2000)
  await repo.deleteNotes([earlier.id])
  vi.setSystemTime(3000)
  await repo.deleteBoard(b.id)
  vi.setSystemTime(4000)
  await repo.restoreBoard(b.id)
  expect((await repo.listBoards()).map((x) => x.name)).toEqual(['A'])
  expect((await repo.listNotes(b.id)).map((n) => n.id).sort()).toEqual([kept.id, other.id].sort())
  expect(await repo.listArrows(b.id)).toHaveLength(1)
  expect(await db.boards.get(b.id)).toMatchObject({ deleted: false, dirty: 1, updatedAt: 4000 })
})

it('a write never moves updatedAt backwards (device clock behind a pulled version)', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await db.notes.update(n.id, { updatedAt: 10_000, dirty: 0 }) // as if pulled from a device whose clock runs ahead
  vi.setSystemTime(5000)
  await repo.updateNote(n.id, { html: '<p>Mac</p>' })
  expect(await db.notes.get(n.id)).toMatchObject({ html: '<p>Mac</p>', updatedAt: 10_001, dirty: 1 })
})

it('deleting a board with rows from the future still restores them together', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await db.notes.update(n.id, { updatedAt: 50_000 })
  vi.setSystemTime(3000)
  await repo.deleteBoard(b.id)
  await repo.restoreBoard(b.id)
  expect(await repo.listNotes(b.id)).toHaveLength(1)
})

it('usedTextColors reads every board but only notes with that background, skips deleted', async () => {
  const a = await repo.createBoard('A')
  const b = await repo.createBoard('B')
  const n1 = await repo.addNote(a.id, { x: 0, y: 0 }, 'pink')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'pink')
  const other = await repo.addNote(b.id, { x: 0, y: 0 }, 'blue')
  const gone = await repo.addNote(b.id, { x: 0, y: 0 }, 'pink')
  await repo.updateNote(n1.id, { html: '<p><span style="color: #dc2626">x</span></p>' })
  await repo.updateNote(n2.id, { html: '<p><span style="color: #2563eb">y</span></p>' })
  await repo.updateNote(other.id, { html: '<p><span style="color: #16a34a">z</span></p>' })
  await repo.updateNote(gone.id, { html: '<p><span style="color: #9333ea">w</span></p>' })
  await repo.deleteNotes([gone.id])
  expect((await repo.usedTextColors('pink')).sort()).toEqual(['#2563eb', '#dc2626'])
})

it('updateArrow sets the colour, marked dirty with a newer updatedAt', async () => {
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const n2 = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const a = (await repo.addArrow(b.id, n1.id, n2.id))!
  await db.arrows.update(a.id, { dirty: 0 })
  await repo.updateArrow(a.id, { color: 'red' })
  expect(await db.arrows.get(a.id)).toMatchObject({ color: 'red', dirty: 1 })
  expect((await db.arrows.get(a.id))!.updatedAt).toBeGreaterThan(a.updatedAt)
})

it('updateNote sets then clears the minimum height', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await db.notes.update(n.id, { dirty: 0 })
  await repo.updateNote(n.id, { width: 320, height: 180 })
  expect(await db.notes.get(n.id)).toMatchObject({ width: 320, height: 180, dirty: 1 })
  await repo.updateNote(n.id, { height: undefined })
  const row = (await db.notes.get(n.id))!
  expect(row.height).toBeUndefined()
  expect(row.width).toBe(320)
})

it('duplicateNotes copies notes (offset, same text, colour and size) and the arrows between them only', async () => {
  const b = await repo.createBoard('A')
  const n1 = await repo.addNote(b.id, { x: 10, y: 20 }, 'pink')
  const n2 = await repo.addNote(b.id, { x: 300, y: 20 }, 'blue')
  const outside = await repo.addNote(b.id, { x: 600, y: 20 }, 'green')
  await repo.updateNote(n1.id, { html: '<p>Insuline</p>', width: 320, height: 150 })
  const inner = (await repo.addArrow(b.id, n1.id, n2.id))!
  await repo.updateArrow(inner.id, { color: 'red' })
  await repo.addArrow(b.id, n2.id, outside.id)
  const copy = await repo.duplicateNotes([n1.id, n2.id])
  expect(copy.notes).toHaveLength(2)
  const [c1, c2] = copy.notes
  expect(c1).toMatchObject({ x: 42, y: 52, html: '<p>Insuline</p>', color: 'pink', width: 320, height: 150, boardId: b.id })
  expect(c2).toMatchObject({ x: 332, y: 52, color: 'blue' })
  expect(new Set([c1.id, c2.id, n1.id, n2.id]).size).toBe(4)
  expect(copy.arrows).toHaveLength(1)
  expect(copy.arrows[0]).toMatchObject({ from: c1.id, to: c2.id, color: 'red' })
  expect(await db.notes.get(c1.id)).toMatchObject({ dirty: 1, deleted: false })
  expect(await repo.listNotes(b.id)).toHaveLength(5)
  expect(await repo.listArrows(b.id)).toHaveLength(3)
})

it('duplicateNotes skips deleted or unknown notes', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const gone = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await repo.deleteNotes([gone.id])
  const copy = await repo.duplicateNotes([n.id, gone.id, 'nope'])
  expect(copy.notes).toHaveLength(1)
  expect(await repo.duplicateNotes([])).toEqual({ notes: [], arrows: [] })
})
