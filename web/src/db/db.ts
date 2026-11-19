import { Dexie, type Table } from 'dexie'
import type { Arrow, Board, Id, Note } from '@chart/shared'

/** A row as stored on this device: the domain object plus local sync state. */
export type Local<T> = T & { dirty: 0 | 1 }

export class ChartDB extends Dexie {
  declare boards: Table<Local<Board>, Id>
  declare notes: Table<Local<Note>, Id>
  declare arrows: Table<Local<Arrow>, Id>
  /** Local sync bookkeeping: 'cursor' (number) and 'serverId' (string). */
  declare meta: Table<{ key: string; value: number | string }, string>

  constructor() {
    super('chart')
    this.version(1).stores({
      boards: 'id, dirty',
      notes: 'id, boardId, dirty',
      arrows: 'id, boardId, from, to, dirty',
    })
    this.version(2).stores({ meta: 'key' })
  }
}

export const db = new ChartDB()
