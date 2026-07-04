/**
 * cookedPrompts — SQLite Storage Factory
 *
 * Public entry point for the local SQLite data layer. Opens the connection,
 * runs migrations, and returns an initialized StorageHandoffPort.
 *
 * Infrastructure wiring only — no prompt data handled here. Local-first:
 * no network, no cloud, no telemetry. Caller owns the DB lifecycle.
 */

import type { StorageHandoffPort } from '../../importers/local/ports/storage-handoff-port.js';
import {
  openSqliteConnection,
  type SqliteConnectionConfig,
} from './sqlite-connection.js';
import { runSqliteMigrations } from './migrations/index.js';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

/**
 * Create an initialized local SQLite storage port.
 *
 * Opens the database from `config.databasePath` (supports `:memory:`),
 * applies pending migrations idempotently, and returns a ready adapter.
 *
 * Errors from connection validation or migrations propagate as-is; they
 * are safe (no prompt content) because initialization handles no prompt data.
 */
export function createSqliteStorage(
  config: SqliteConnectionConfig,
): StorageHandoffPort {
  const db = openSqliteConnection(config);
  runSqliteMigrations(db);
  return new SqliteStorageAdapter(db);
}
