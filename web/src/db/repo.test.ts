import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { db } from './db'
import * as repo from './repo'

beforeEach(async () => {
  await db.delete(); await db.open()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(1000)
})
afterEach(() => vi.useRealTimers())

it('createBoard then listBoards returns it with lastEditedAt = createdAt', async () => {
  const b = await repo.createBoard('Cardio')
  expect(await repo.listBoards()).toEqual([{ ...b, lastEditedAt: 1000 }])
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
  vi.setSystemTime(2000); const b = await repo.createBoard('B')
  vi.setSystemTime(3000); await repo.addNote(a.id, { x: 0, y: 0 }, 'yellow')
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
