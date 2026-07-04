/**
 * cookedPrompts — SQLite Connection
 *
 * Opens a local better-sqlite3 database connection from a config-driven path.
 * Local-first: no network, no telemetry, no cloud.
 *
 * This module does NOT:
 * - run migrations (Wave 2)
 * - own a global singleton (caller owns lifecycle)
 * - persist prompt logs or any product data
 */

import Database from 'better-sqlite3';

/** Sentinel path for an in-memory SQLite database (used in tests). */
export const IN_MEMORY_SQLITE_DATABASE_PATH = ':memory:';

/** Configuration for opening a local SQLite connection. */
export interface SqliteConnectionConfig {
  /** A real file path, or ':memory:' for an in-memory (test) database. */
  databasePath: string;
}

/** The concrete better-sqlite3 database handle. */
export type SqliteDatabase = Database.Database;

/**
 * Open a local SQLite connection from config.
 *
 * - Supports `:memory:` for tests.
 * - Enables `PRAGMA foreign_keys = ON`.
 * - Does not run migrations.
 * - Does not own a global singleton; the caller must close the DB.
 *
 * Throws a safe error if `databasePath` is missing/empty. Error messages
 * never contain prompt content or private data.
 */
export function openSqliteConnection(
  config: SqliteConnectionConfig,
): SqliteDatabase {
  if (
    config === undefined ||
    config === null ||
    typeof config.databasePath !== 'string' ||
    config.databasePath.trim() === ''
  ) {
    throw new Error('SQLite databasePath is required');
  }

  const db = new Database(config.databasePath);
  db.pragma('foreign_keys = ON');
  return db;
}
