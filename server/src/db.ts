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
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_failures (at INTEGER NOT NULL);
  `)
  return db
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
