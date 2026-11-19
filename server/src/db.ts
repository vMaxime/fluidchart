import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

/** Opens (and if needed creates) the server database. ':memory:' works for tests. */
export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS entities (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      board_id TEXT,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE INDEX IF NOT EXISTS entities_seq ON entities (seq);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, pin_hash TEXT);
    CREATE TABLE IF NOT EXISTS identity (server_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_failures (at INTEGER NOT NULL);
  `)
  if (!db.prepare('SELECT 1 FROM identity').get()) resetServerId(db)
  return db
}

/** A new random identity: clients that knew another one send everything again. */
export function resetServerId(db: DatabaseSync): void {
  db.exec('DELETE FROM identity')
  db.prepare('INSERT INTO identity (server_id) VALUES (?)').run(randomBytes(12).toString('base64url'))
}

/** Runs `fn` inside an immediate transaction. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
