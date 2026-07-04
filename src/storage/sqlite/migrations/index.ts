/**
 * cookedPrompts — SQLite Migration Runner
 *
 * Applies an ordered, in-code migration list and tracks applied versions in
 * a `schema_migrations` table. Forward-only and idempotent for V1.
 *
 * - No heavy migration framework.
 * - No `.sql` files — migration SQL lives in TypeScript modules.
 * - No network calls, no prompt content in logs/errors.
 */

import type { SqliteDatabase } from '../sqlite-connection.js';
import { migration001Initial } from './migration-001-initial.js';
import { migration002Scoring } from './migration-002-scoring.js';

/** A single forward-only schema migration. */
export interface SqliteMigration {
  version: number;
  name: string;
  up: (db: SqliteDatabase) => void;
}

/**
 * Ordered list of migrations. Append new migrations with the next version.
 * Versions must be unique and strictly increasing.
 */
const MIGRATIONS: readonly SqliteMigration[] = [
  migration001Initial,
  migration002Scoring,
];

/** Create the schema_migrations tracking table if it does not exist. */
function ensureSchemaMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

/** Read the set of already-applied migration versions. */
function getAppliedMigrationVersions(db: SqliteDatabase): Set<number> {
  const rows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: number }>;
  return new Set(rows.map((r) => r.version));
}

/**
 * Run all pending migrations in version order.
 *
 * Each pending migration and its schema_migrations insert run in a single
 * transaction, so a failed migration is never recorded. Idempotent: after
 * all migrations are recorded, repeated runs apply nothing.
 */
export function runSqliteMigrations(db: SqliteDatabase): void {
  ensureSchemaMigrationsTable(db);
  const applied = getAppliedMigrationVersions(db);

  // Validate unique, and apply in ascending version order.
  const ordered = [...MIGRATIONS].sort((a, b) => a.version - b.version);
  const seenVersions = new Set<number>();

  const insertVersion = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const migration of ordered) {
    if (seenVersions.has(migration.version)) {
      throw new Error(
        `Duplicate migration version detected: ${migration.version}`,
      );
    }
    seenVersions.add(migration.version);

    if (applied.has(migration.version)) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      insertVersion.run(migration.version, new Date().toISOString());
    });
    applyMigration();
  }
}
