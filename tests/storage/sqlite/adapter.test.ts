/**
 * Wave 6 — Task 6.4: Adapter behavior tests.
 *
 * Covers: StorageHandoffPort contract compliance, saveImportBatch persistence,
 * checkDuplicateIds, in-batch/existing-DB duplicate rejection, entry/batch
 * mismatch rejection, transactional rollback on failure, and content-free
 * error messages.
 */

import { describe, it, expect } from 'vitest';

import {
  createSqliteStorage,
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
  runSqliteMigrations,
  SqliteStorageAdapter,
} from '../../../src/storage/sqlite/index.js';
import type { StorageHandoffPort } from '../../../src/importers/local/ports/storage-handoff-port.js';
import type { PromptLogEntry } from '../../../src/importers/local/types.js';
import { makeBatch, makePromptLog } from './test-helpers.js';

function newStorage(): StorageHandoffPort {
  return createSqliteStorage({ databasePath: IN_MEMORY_SQLITE_DATABASE_PATH });
}

/** Adapter over a caller-owned DB, so tests can inspect rows directly. */
function newAdapterWithDb() {
  const db = openSqliteConnection({
    databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
  });
  runSqliteMigrations(db);
  return { db, adapter: new SqliteStorageAdapter(db) };
}

describe('StorageHandoffPort contract compliance', () => {
  it('factory result is assignable to StorageHandoffPort', () => {
    const storage: StorageHandoffPort = newStorage();
    expect(typeof storage.saveImportBatch).toBe('function');
    expect(typeof storage.checkDuplicateIds).toBe('function');
  });
});

describe('saveImportBatch — success paths', () => {
  it('persists a batch and its entries', async () => {
    const storage = newStorage();
    const batch = makeBatch({ id: 'b-ok', total_rows: 2, valid_rows: 2 });
    const entries = [
      makePromptLog({ id: 'e1', import_batch_id: 'b-ok' }),
      makePromptLog({ id: 'e2', import_batch_id: 'b-ok' }),
    ];
    const result = await storage.saveImportBatch(batch, entries);
    expect(result.success).toBe(true);
    expect(result.entries_saved).toBe(2);

    const existing = await storage.checkDuplicateIds(['e1', 'e2', 'e3']);
    expect(existing).toEqual(['e1', 'e2']);
  });

  it('persists batch metadata with zero entries', async () => {
    const storage = newStorage();
    const result = await storage.saveImportBatch(
      makeBatch({ id: 'b-empty', total_rows: 0, valid_rows: 0 }),
      [],
    );
    expect(result).toEqual({ success: true, entries_saved: 0 });
  });
});

describe('checkDuplicateIds', () => {
  it('returns [] on empty input', async () => {
    const storage = newStorage();
    expect(await storage.checkDuplicateIds([])).toEqual([]);
  });

  it('returns only IDs already stored, preserving order', async () => {
    const storage = newStorage();
    await storage.saveImportBatch(makeBatch({ id: 'b1' }), [
      makePromptLog({ id: 'x', import_batch_id: 'b1' }),
      makePromptLog({ id: 'y', import_batch_id: 'b1' }),
    ]);
    expect(await storage.checkDuplicateIds(['y', 'z', 'x'])).toEqual(['y', 'x']);
  });
});

describe('saveImportBatch — rejection paths (no partial persistence)', () => {
  it('rejects in-batch duplicate entry IDs before any write', async () => {
    const { db, adapter } = newAdapterWithDb();
    const result = await adapter.saveImportBatch(makeBatch({ id: 'b-dup' }), [
      makePromptLog({ id: 'dup', import_batch_id: 'b-dup' }),
      makePromptLog({ id: 'dup', import_batch_id: 'b-dup' }),
    ]);
    expect(result.success).toBe(false);
    expect(result.entries_saved).toBe(0);
    expect(result.error).toContain('Duplicate');

    // Nothing persisted.
    expect(await adapter.checkDuplicateIds(['dup'])).toEqual([]);
    const batchCount = db
      .prepare('SELECT COUNT(*) AS n FROM import_batches')
      .get() as { n: number };
    expect(batchCount.n).toBe(0);
    db.close();
  });

  it('rejects a batch containing an ID that already exists in the DB', async () => {
    const { db, adapter } = newAdapterWithDb();
    await adapter.saveImportBatch(makeBatch({ id: 'b-first' }), [
      makePromptLog({ id: 'shared', import_batch_id: 'b-first' }),
    ]);

    const result = await adapter.saveImportBatch(makeBatch({ id: 'b-second' }), [
      makePromptLog({ id: 'shared', import_batch_id: 'b-second' }),
      makePromptLog({ id: 'new-one', import_batch_id: 'b-second' }),
    ]);
    expect(result.success).toBe(false);
    expect(result.entries_saved).toBe(0);

    // Second batch and its new entry must not persist.
    const secondBatch = db
      .prepare('SELECT id FROM import_batches WHERE id = ?')
      .get('b-second');
    expect(secondBatch).toBeUndefined();
    expect(await adapter.checkDuplicateIds(['new-one'])).toEqual([]);
    db.close();
  });

  it('rejects entries whose import_batch_id does not match the batch', async () => {
    const { db, adapter } = newAdapterWithDb();
    const result = await adapter.saveImportBatch(makeBatch({ id: 'b-real' }), [
      makePromptLog({ id: 'mismatch', import_batch_id: 'b-other' }),
    ]);
    expect(result.success).toBe(false);
    expect(result.entries_saved).toBe(0);

    const batchCount = db
      .prepare('SELECT COUNT(*) AS n FROM import_batches')
      .get() as { n: number };
    expect(batchCount.n).toBe(0);
    expect(await adapter.checkDuplicateIds(['mismatch'])).toEqual([]);
    db.close();
  });
});

describe('saveImportBatch — rollback on constraint failure', () => {
  it('rolls back the whole batch when an entry violates a schema constraint', async () => {
    const { db, adapter } = newAdapterWithDb();
    const batch = makeBatch({ id: 'b-rollback' });
    const goodEntry = makePromptLog({ id: 'good', import_batch_id: 'b-rollback' });
    // user_rating 99 violates CHECK (user_rating BETWEEN 1 AND 5).
    const badEntry = makePromptLog({
      id: 'bad-rating',
      import_batch_id: 'b-rollback',
      user_rating: 99 as unknown as PromptLogEntry['user_rating'],
    });

    const result = await adapter.saveImportBatch(batch, [goodEntry, badEntry]);
    expect(result.success).toBe(false);
    expect(result.entries_saved).toBe(0);
    expect(result.error).toBe('SQLite import batch save failed');

    // Neither the batch nor the good entry should remain.
    const batchRow = db
      .prepare('SELECT id FROM import_batches WHERE id = ?')
      .get('b-rollback');
    expect(batchRow).toBeUndefined();
    expect(await adapter.checkDuplicateIds(['good', 'bad-rating'])).toEqual([]);
    db.close();
  });
});

describe('adapter error messages', () => {
  it('failure errors contain no prompt text', async () => {
    const storage = newStorage();
    const uniquePrompt = 'UNIQUE-SYNTHETIC-PROMPT-marker-12345';
    const result = await storage.saveImportBatch(makeBatch({ id: 'b-e' }), [
      makePromptLog({
        id: 'same',
        import_batch_id: 'b-e',
        prompt_text: uniquePrompt,
      }),
      makePromptLog({
        id: 'same',
        import_batch_id: 'b-e',
        prompt_text: uniquePrompt,
      }),
    ]);
    expect(result.success).toBe(false);
    expect(result.error ?? '').not.toContain(uniquePrompt);
  });
});
