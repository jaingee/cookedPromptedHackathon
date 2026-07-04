/**
 * cookedPrompts — SQLite Storage Module Boundary
 *
 * Public exports for the local SQLite data layer.
 * Connection, migration runner, repositories, adapter, and the
 * createSqliteStorage factory are implemented.
 *
 * Prefer `createSqliteStorage(config)` as the public entry point.
 */

export {
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
} from './sqlite-connection.js';

export type {
  SqliteConnectionConfig,
  SqliteDatabase,
} from './sqlite-connection.js';

export { runSqliteMigrations } from './migrations/index.js';
export type { SqliteMigration } from './migrations/index.js';

export { ImportBatchRepository, PromptLogRepository } from './repositories/index.js';
export { PromptScoreRepository } from './repositories/index.js';
export type {
  SqliteListOptions,
  PromptLogReadOptions,
  PromptScoreListOptions,
  PromptScoreSaveResult,
} from './repositories/index.js';

export { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

export { createSqliteStorage } from './sqlite-storage-factory.js';
