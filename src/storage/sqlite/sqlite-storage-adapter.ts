/**
 * cookedPrompts — SQLite Storage Adapter
 *
 * Concrete implementation of the importer's StorageHandoffPort. Composes the
 * ImportBatchRepository and PromptLogRepository and persists a batch and its
 * entries in a single all-or-nothing transaction.
 *
 * PRIVACY / SAFETY:
 * - Accepts only normalized ImportBatch / PromptLogEntry (never raw rows).
 * - Delegates all SQL to repositories (explicit column allow-list; no spread).
 * - Never logs prompt content; never surfaces raw SQLite errors.
 * - Local-first: no network, no cloud, no telemetry.
 */

import type { ImportBatch, PromptLogEntry } from '../../importers/local/types.js';
import type {
  StorageHandoffPort,
  StorageSaveResult,
} from '../../importers/local/ports/storage-handoff-port.js';
import type { SqliteDatabase } from './sqlite-connection.js';
import {
  ImportBatchRepository,
  PromptLogRepository,
} from './repositories/index.js';

export class SqliteStorageAdapter implements StorageHandoffPort {
  private readonly importBatches: ImportBatchRepository;
  private readonly promptLogs: PromptLogRepository;

  constructor(private readonly db: SqliteDatabase) {
    this.importBatches = new ImportBatchRepository(db);
    this.promptLogs = new PromptLogRepository(db);
  }

  /**
   * Return the subset of IDs that already exist in storage. Read-only.
   */
  async checkDuplicateIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.promptLogs.findExistingIds(ids);
  }

  /**
   * Persist a batch and its entries in one transaction (all-or-nothing).
   *
   * Rejects (before any writes) when:
   * - the incoming entries contain duplicate IDs,
   * - any entry does not belong to the batch,
   * - any entry ID already exists in storage.
   *
   * Returns safe, content-free results/errors.
   */
  async saveImportBatch(
    batch: ImportBatch,
    entries: PromptLogEntry[],
  ): Promise<StorageSaveResult> {
    // Pre-transaction validation on in-memory data (no writes yet).
    const inputDuplicateCount = countDuplicateInputIds(
      entries.map((e) => e.id),
    );
    if (inputDuplicateCount > 0) {
      return {
        success: false,
        entries_saved: 0,
        error: `Duplicate prompt log id(s) detected: ${inputDuplicateCount}`,
      };
    }

    const mismatchCount = entries.filter(
      (e) => e.import_batch_id !== batch.id,
    ).length;
    if (mismatchCount > 0) {
      return {
        success: false,
        entries_saved: 0,
        error: `Import batch save failed: entry batch mismatch count ${mismatchCount}`,
      };
    }

    try {
      const runTransaction = this.db.transaction((): StorageSaveResult => {
        const entryIds = entries.map((e) => e.id);
        const existing =
          entryIds.length > 0 ? this.promptLogs.findExistingIds(entryIds) : [];
        if (existing.length > 0) {
          // Return failure before any writes; nothing is inserted.
          return {
            success: false,
            entries_saved: 0,
            error: `Duplicate prompt log id(s) detected: ${existing.length}`,
          };
        }

        this.importBatches.insert(batch);
        for (const entry of entries) {
          this.promptLogs.insert(entry);
        }

        return { success: true, entries_saved: entries.length };
      });

      return runTransaction();
    } catch {
      // Never surface raw SQLite error messages (may reference row data).
      return {
        success: false,
        entries_saved: 0,
        error: 'SQLite import batch save failed',
      };
    }
  }
}

/** Count how many array entries repeat an already-seen ID. */
function countDuplicateInputIds(ids: string[]): number {
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const id of ids) {
    if (seen.has(id)) {
      duplicateCount += 1;
    } else {
      seen.add(id);
    }
  }
  return duplicateCount;
}
