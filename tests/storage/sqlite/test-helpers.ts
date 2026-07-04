/**
 * cookedPrompts — SQLite Storage Test Helpers
 *
 * Shared synthetic fixtures and DB setup for Wave 6 storage tests.
 * All data here is synthetic. No real prompts, secrets, or model answers.
 * Fresh in-memory DBs per test; no global shared state.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ImportBatch, PromptLogEntry } from '../../../src/importers/local/types.js';
import {
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
  runSqliteMigrations,
  type SqliteDatabase,
} from '../../../src/storage/sqlite/index.js';

/** Open a fresh in-memory DB with migrations applied. */
export function createMigratedMemoryDb(): SqliteDatabase {
  const db = openSqliteConnection({
    databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
  });
  runSqliteMigrations(db);
  return db;
}

/**
 * Create a unique temp-file database path (for repeated-init/idempotency
 * tests where each `:memory:` connection would otherwise be isolated).
 * Returns the path plus a cleanup function that removes the temp directory.
 */
export function createTempDbPath(): { databasePath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'cookedprompts-sqlite-'));
  const databasePath = join(dir, 'test.db');
  return {
    databasePath,
    cleanup: () => {
      // Best-effort cleanup. On Windows a lingering DB handle can briefly
      // hold a file lock (EPERM); ignore since it is a temp-dir artifact.
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore temp cleanup errors */
      }
    },
  };
}

/** Build a synthetic ImportBatch, overridable per test. */
export function makeBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: 'batch-1',
    source_type: 'jsonl',
    source_filename: 'synthetic.jsonl',
    total_rows: 2,
    valid_rows: 2,
    invalid_rows: 0,
    warnings_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Build a synthetic normalized PromptLogEntry, overridable per test. */
export function makePromptLog(overrides: Partial<PromptLogEntry> = {}): PromptLogEntry {
  return {
    id: 'prompt-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'manual',
    provider: 'synthetic-provider',
    model_used: 'synthetic-model',
    prompt_text: 'Write a short synthetic test prompt.',
    import_batch_id: 'batch-1',
    prompt_hash: 'a'.repeat(64),
    session_id: null,
    follow_up_index: null,
    parent_prompt_id: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: null,
    estimated_cost: null,
    latency_ms: null,
    solved_status: null,
    user_rating: null,
    tags: [],
    redaction_status: 'none',
    ...overrides,
  };
}
