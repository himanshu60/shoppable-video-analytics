import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

let db;

/**
 * Opens (and memoises) the SQLite connection.
 *
 * `:memory:` is honoured so the test suite can run against a throwaway
 * database without touching the developer's data file.
 */
export function getDb() {
  if (db) return db;

  const file = config.databasePath;
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  db = new Database(file);

  // Foreign keys are OFF by default in SQLite and must be enabled per
  // connection, otherwise the REFERENCES clauses in the schema are inert.
  db.pragma('foreign_keys = ON');
  // WAL lets the dashboard keep reading while simulated traffic writes.
  if (file !== ':memory:') db.pragma('journal_mode = WAL');

  return db;
}

/** Closes the connection. Used by tests; never called in normal operation. */
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
