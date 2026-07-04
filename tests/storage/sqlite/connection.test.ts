/**
 * Wave 6 — Task 6.1: Connection + initialization tests.
 *
 * Covers: fresh DB opens, foreign_keys enabled, safe error on blank path,
 * factory returns a StorageHandoffPort, and repeated init is idempotent
 * against a temp-file DB.
 */

import { describe, it, expect } from 'vitest';

import {
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
  runSqliteMigrations,
  createSqliteStorage,
} from '../../../src/storage/sqlite/index.js';
import { createTempDbPath } from './test-helpers.js';

describe('openSqliteConnection', () => {
  it('opens an in-memory database', () => {
    const db = openSqliteConnection({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    expect(db.open).toBe(true);
    db.close();
  });

  it('enables foreign_keys', () => {
    const db = openSqliteConnection({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
    db.close();
  });

  it('throws a safe error when databasePath is empty', () => {
    expect(() => openSqliteConnection({ databasePath: '' })).toThrow(
      'SQLite databasePath is required',
    );
  });

  it('throws a safe error when databasePath is whitespace only', () => {
    expect(() => openSqliteConnection({ databasePath: '   ' })).toThrow(
      'SQLite databasePath is required',
    );
  });

  it('throws a safe error when config is missing databasePath', () => {
    expect(() =>
      openSqliteConnection({} as { databasePath: string }),
    ).toThrow('SQLite databasePath is required');
  });
});

describe('createSqliteStorage factory', () => {
  it('returns an object implementing the StorageHandoffPort surface', () => {
    const storage = createSqliteStorage({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    expect(typeof storage.saveImportBatch).toBe('function');
    expect(typeof storage.checkDuplicateIds).toBe('function');
  });

  it('checkDuplicateIds returns [] on a fresh initialized DB', async () => {
    const storage = createSqliteStorage({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    await expect(storage.checkDuplicateIds(['x', 'y'])).resolves.toEqual([]);
  });

  it('creates a usable storage port on a fresh temp-file DB', () => {
    const { databasePath, cleanup } = createTempDbPath();
    try {
      const storage = createSqliteStorage({ databasePath });
      expect(typeof storage.saveImportBatch).toBe('function');
      expect(typeof storage.checkDuplicateIds).toBe('function');
    } finally {
      cleanup();
    }
  });

  it('repeated initialization against the same temp-file DB is idempotent', () => {
    const { databasePath, cleanup } = createTempDbPath();
    try {
      // First init creates schema + records all applied migration versions.
      const first = openSqliteConnection({ databasePath });
      runSqliteMigrations(first);
      first.close();

      // Second init against the persisted file must not throw and must not
      // duplicate migration rows (forward-only, idempotent).
      const second = openSqliteConnection({ databasePath });
      expect(() => runSqliteMigrations(second)).not.toThrow();
      const rows = second
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number }>;
      expect(rows.map((r) => r.version)).toEqual([1, 2]);
      second.close();
    } finally {
      cleanup();
    }
  });
});
