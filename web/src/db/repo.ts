import {
  NOTE_COLOR_ORDER,
  newArrow,
  newBoard,
  newNote,
  normalizeBoardName,
  type Arrow,
  type Board,
  type Id,
  type Note,
  type NoteColor,
} from '@chart/shared'
import { db, type Local } from './db'

// Sync contract: every write goes through this module, sets updatedAt = Date.now()
// and dirty = 1 on each touched row, and never hard-deletes (deleted = true).

export type BoardSummary = Board & {
  lastEditedAt: number
  /** Live notes on the board. */
  noteCount: number
  /** Up to three colours, most used first (ties in palette order). */
  colors: NoteColor[]
}

function strip<T>(row: Local<T>): T {
  const { dirty: _dirty, ...rest } = row
  return rest as T
}

const touched = () => ({ updatedAt: Date.now(), dirty: 1 as const })

export async function listBoards(): Promise<BoardSummary[]> {
  const [boards, notes, arrows] = await Promise.all([db.boards.toArray(), db.notes.toArray(), db.arrows.toArray()])
  const lastEdit = new Map<Id, number>()
  for (const row of [...notes, ...arrows]) {
    lastEdit.set(row.boardId, Math.max(lastEdit.get(row.boardId) ?? 0, row.updatedAt))
  }
  const colorCounts = new Map<Id, Map<NoteColor, number>>()
  for (const n of notes) {
    if (n.deleted) continue
    const counts = colorCounts.get(n.boardId) ?? new Map<NoteColor, number>()
    counts.set(n.color, (counts.get(n.color) ?? 0) + 1)
    colorCounts.set(n.boardId, counts)
  }
  const summarize = (id: Id) => {
    const counts = colorCounts.get(id) ?? new Map<NoteColor, number>()
    const colors = [...counts.keys()]
      .sort((a, b) => counts.get(b)! - counts.get(a)! || NOTE_COLOR_ORDER.indexOf(a) - NOTE_COLOR_ORDER.indexOf(b))
      .slice(0, 3)
    return { noteCount: [...counts.values()].reduce((sum, c) => sum + c, 0), colors }
  }
  return boards
    .filter((b) => !b.deleted)
    .map((b) => ({ ...strip(b), lastEditedAt: Math.max(b.updatedAt, lastEdit.get(b.id) ?? 0), ...summarize(b.id) }))
    .sort((a, b) => b.lastEditedAt - a.lastEditedAt)
}

export async function getBoard(id: Id): Promise<Board | undefined> {
  const row = await db.boards.get(id)
  return row && strip(row)
}

export async function createBoard(name: string): Promise<Board> {
  const board = newBoard(name, Date.now())
  await db.boards.add({ ...board, dirty: 1 })
  return board
}

export async function renameBoard(id: Id, name: string): Promise<void> {
  const next = normalizeBoardName(name)
  await db.transaction('rw', db.boards, async () => {
    const row = await db.boards.get(id)
    // An unchanged name must not bump updatedAt: under last-write-wins it would undo a real rename elsewhere.
    if (!row || row.name === next) return
    await db.boards.update(id, { name: next, ...touched() })
  })
}

export async function deleteBoard(id: Id): Promise<void> {
  await db.transaction('rw', db.boards, db.notes, db.arrows, async () => {
    const tomb = { deleted: true, ...touched() }
    await db.boards.update(id, tomb)
    await db.notes.where('boardId').equals(id).filter((n) => !n.deleted).modify(tomb)
    await db.arrows.where('boardId').equals(id).filter((a) => !a.deleted).modify(tomb)
  })
}

/** Undo for deleteBoard: un-tombstones the board and the notes/arrows deleted in that same operation. */
export async function restoreBoard(id: Id): Promise<void> {
  await db.transaction('rw', db.boards, db.notes, db.arrows, async () => {
    const board = await db.boards.get(id)
    if (!board?.deleted) return
    const deletedAt = board.updatedAt
    const alive = { deleted: false, ...touched() }
    await db.boards.update(id, alive)
    await db.notes.where('boardId').equals(id).filter((n) => n.deleted && n.updatedAt === deletedAt).modify(alive)
    await db.arrows.where('boardId').equals(id).filter((a) => a.deleted && a.updatedAt === deletedAt).modify(alive)
  })
}

export async function listNotes(boardId: Id): Promise<Note[]> {
  const rows = await db.notes.where('boardId').equals(boardId).filter((n) => !n.deleted).toArray()
  return rows.map(strip)
}

export async function listArrows(boardId: Id): Promise<Arrow[]> {
  const rows = await db.arrows.where('boardId').equals(boardId).filter((a) => !a.deleted).toArray()
  return rows.map(strip)
}

export async function addNote(boardId: Id, pos: { x: number; y: number }, color: NoteColor): Promise<Note> {
  const note = newNote(boardId, pos, color, Date.now())
  await db.notes.add({ ...note, dirty: 1 })
  return note
}

export async function updateNote(
  id: Id,
  patch: Partial<Pick<Note, 'x' | 'y' | 'width' | 'color' | 'html'>>,
): Promise<void> {
  await db.notes.update(id, { ...patch, ...touched() })
}

export async function deleteNotes(ids: Id[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.notes, db.arrows, async () => {
    const tomb = { deleted: true, ...touched() }
    await db.notes.where('id').anyOf(ids).filter((n) => !n.deleted).modify(tomb)
    await db.arrows.where('from').anyOf(ids).filter((a) => !a.deleted).modify(tomb)
    await db.arrows.where('to').anyOf(ids).filter((a) => !a.deleted).modify(tomb)
  })
}

export async function addArrow(boardId: Id, from: Id, to: Id): Promise<Arrow | null> {
  if (from === to) return null
  return db.transaction('rw', db.arrows, async () => {
    const duplicate = await db.arrows
      .where('from')
      .equals(from)
      .filter((a) => a.to === to && !a.deleted)
      .first()
    if (duplicate) return null
    const arrow = newArrow(boardId, from, to, Date.now())
    await db.arrows.add({ ...arrow, dirty: 1 })
    return arrow
  })
}

export async function deleteArrows(ids: Id[]): Promise<void> {
  if (ids.length === 0) return
  await db.arrows.where('id').anyOf(ids).filter((a) => !a.deleted).modify({ deleted: true, ...touched() })
}
