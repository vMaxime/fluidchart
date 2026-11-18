import { Dexie, type Table } from 'dexie'
import type { Arrow, Board, Id, Note } from '@chart/shared'

/** A row as stored on this device: the domain object plus local sync state. */
export type Local<T> = T & { dirty: 0 | 1 }

export class ChartDB extends Dexie {
  declare boards: Table<Local<Board>, Id>
  declare notes: Table<Local<Note>, Id>
  declare arrows: Table<Local<Arrow>, Id>

  constructor() {
    super('chart')
    this.version(1).stores({
      boards: 'id, dirty',
      notes: 'id, boardId, dirty',
      arrows: 'id, boardId, from, to, dirty',
    })
  }
}

export const db = new ChartDB()
