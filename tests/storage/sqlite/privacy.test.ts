/**
 * Wave 6 — Task 6.5: Privacy / no-network guard tests.
 *
 * Covers: banned full-answer fields never persisted even when present on a
 * widened input object; no raw-row storage; no network calls during any
 * operation; error/result payloads contain no prompt content or banned values.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  createSqliteStorage,
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
  runSqliteMigrations,
  SqliteStorageAdapter,
} from '../../../src/storage/sqlite/index.js';
import type { PromptLogEntry } from '../../../src/importers/local/types.js';
import { makeBatch, makePromptLog } from './test-helpers.js';

const MOCK_ANSWER = '[MOCK MODEL ANSWER PLACEHOLDER - SHOULD NOT PERSIST]';
const BANNED_ANSWER_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

/** A PromptLogEntry widened with banned answer fields (as an attacker might). */
function makeEntryWithBannedFields(
  id: string,
  batchId: string,
): PromptLogEntry {
  const withBanned = {
    ...makePromptLog({ id, import_batch_id: batchId }),
    assistant_message: MOCK_ANSWER,
    response: MOCK_ANSWER,
    completion: MOCK_ANSWER,
    model_answer: MOCK_ANSWER,
    output_text: MOCK_ANSWER,
    generated_text: MOCK_ANSWER,
  };
  return withBanned as unknown as PromptLogEntry;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('banned full-answer fields never persist', () => {
  it('drops banned fields even when present on the input object', async () => {
    const db = openSqliteConnection({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    runSqliteMigrations(db);
    const adapter = new SqliteStorageAdapter(db);

    const result = await adapter.saveImportBatch(makeBatch({ id: 'b-priv' }), [
      makeEntryWithBannedFields('p-priv', 'b-priv'),
    ]);
    expect(result.success).toBe(true);

    // Schema has no banned columns.
    const columns = (
      db.pragma('table_info(prompt_logs)') as Array<{ name: string }>
    ).map((c) => c.name);
    for (const banned of BANNED_ANSWER_FIELDS) {
      expect(columns).not.toContain(banned);
    }

    // Stored row does not contain the banned placeholder value anywhere.
    const row = db
      .prepare('SELECT * FROM prompt_logs WHERE id = ?')
      .get('p-priv') as Record<string, unknown>;
    expect(JSON.stringify(row)).not.toContain(MOCK_ANSWER);
    db.close();
  });
});

describe('no raw-row storage', () => {
  it('schema exposes no raw row / source blob tables or columns', () => {
    const db = openSqliteConnection({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    runSqliteMigrations(db);

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'schema_migrations',
        'import_batches',
        'prompt_logs',
        'prompt_log_tags',
      ]),
    );
    // No table dedicated to raw imported rows / source blobs.
    for (const t of tables) {
      expect(t).not.toMatch(/raw|blob|source_row|raw_row/i);
    }

    const promptCols = (
      db.pragma('table_info(prompt_logs)') as Array<{ name: string }>
    ).map((c) => c.name);
    for (const c of promptCols) {
      expect(c).not.toMatch(/raw|blob/i);
    }
    db.close();
  });
});

describe('no network calls during storage operations', () => {
  it('does not call globalThis.fetch during init, save, or duplicate check', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('Network call detected!');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const storage = createSqliteStorage({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    await storage.saveImportBatch(makeBatch({ id: 'b-net' }), [
      makePromptLog({ id: 'e-net', import_batch_id: 'b-net' }),
    ]);
    await storage.checkDuplicateIds(['e-net', 'missing']);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('error payloads contain no prompt content or banned values', () => {
  it('duplicate/mismatch failures leak neither prompt text nor banned placeholder', async () => {
    const storage = createSqliteStorage({
      databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
    });
    const uniquePrompt = 'UNIQUE-SYNTHETIC-PROMPT-privacy-marker-98765';

    // Entry/batch mismatch failure with banned fields attached.
    const widened = {
      ...makePromptLog({
        id: 'mismatch',
        import_batch_id: 'wrong-batch',
        prompt_text: uniquePrompt,
      }),
      response: MOCK_ANSWER,
    } as unknown as PromptLogEntry;

    const result = await storage.saveImportBatch(makeBatch({ id: 'b-err' }), [
      widened,
    ]);
    expect(result.success).toBe(false);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(uniquePrompt);
    expect(serialized).not.toContain(MOCK_ANSWER);
  });
});
