/**
 * cookedPrompts — Storage Handoff Port (Interface Only)
 *
 * ARCHITECTURE BOUNDARY MODULE.
 *
 * This port defines the typed contract for persisting normalized prompt-log
 * entries. The importer hands confirmed entries to this port; the actual
 * storage implementation (local SQLite in V1) lives in 02-sqlite-data-layer.
 *
 * Design constraints:
 * - Implementation-agnostic: no SQLite, Supabase, or file-system assumptions.
 * - Accepts ONLY normalized PromptLogEntry records (banned fields stripped).
 * - Never stores full model answers.
 * - No cloud/auth/team concepts baked into the interface.
 * - Narrow enough for in-memory fakes or real SQLite adapters.
 * - Local-first: no network calls in the contract.
 * - Does not include raw parsed rows.
 *
 * The 02-sqlite-data-layer spec will implement this interface.
 */

import type { PromptLogEntry, ImportBatch } from '../types.js';

/**
 * Result of a storage save operation.
 */
export interface StorageSaveResult {
  success: boolean;
  /** Number of entries actually persisted. */
  entries_saved: number;
  /** Error message if success is false. */
  error?: string;
}

/**
 * Port interface for storing normalized prompt-log entries.
 *
 * Implementations:
 * - V1: local SQLite adapter (02-sqlite-data-layer)
 * - Test: in-memory fake for unit/integration tests
 * - V2+: optional Supabase adapter (future)
 */
export interface StorageHandoffPort {
  /**
   * Persist a batch of confirmed, normalized entries.
   *
   * Entries passed here MUST:
   * - Be fully normalized PromptLogEntry records.
   * - Have banned full-answer fields already stripped.
   * - Have prompt_hash computed.
   * - Belong to the given ImportBatch.
   *
   * @param batch The import batch metadata.
   * @param entries The confirmed normalized entries.
   * @returns Result indicating success/failure and count.
   */
  saveImportBatch(
    batch: ImportBatch,
    entries: PromptLogEntry[],
  ): Promise<StorageSaveResult>;

  /**
   * Check which IDs from a list already exist in storage.
   *
   * Used during preview to warn about cross-batch duplicates.
   * Returns IDs that already exist. If the port is not yet implemented
   * or storage is empty, returns an empty array.
   *
   * @param ids Array of entry IDs to check.
   * @returns Array of IDs that already exist in storage.
   */
  checkDuplicateIds(ids: string[]): Promise<string[]>;
}
