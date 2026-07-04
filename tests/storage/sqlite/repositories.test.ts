/**
 * Wave 6 — Task 6.3: Repository tests.
 *
 * Covers: batch + prompt-log round-trips, nullable fields, tag
 * normalization/hydration, listByBatch scoping, findExistingIds ordering,
 * bounded pagination validation, and soft-delete default exclusion.
 */

import { describe, it, expect } from 'vitest';

import {
  ImportBatchRepository,
  PromptLogRepository,
} from '../../../src/storage/sqlite/index.js';
import { MAX_LIST_LIMIT } from '../../../src/storage/sqlite/repositories/index.js';
import { createMigratedMemoryDb, makeBatch, makePromptLog } from './test-helpers.js';

describe('ImportBatchRepository', () => {
  it('insert + getById round-trips all fields', () => {
    const db = createMigratedMemoryDb();
    const repo = new ImportBatchRepository(db);
    const batch = makeBatch({
      id: 'b-round-trip',
      source_type: 'csv',
      source_filename: 'data.csv',
      total_rows: 5,
      valid_rows: 4,
      invalid_rows: 1,
      warnings_count: 2,
    });
    repo.insert(batch);
    expect(repo.getById('b-round-trip')).toEqual(batch);
    db.close();
  });

  it('getById returns null for a missing batch', () => {
    const db = createMigratedMemoryDb();
    const repo = new ImportBatchRepository(db);
    expect(repo.getById('nope')).toBeNull();
    db.close();
  });

  it('list returns bounded deterministic results (newest first)', () => {
    const db = createMigratedMemoryDb();
    const repo = new ImportBatchRepository(db);
    repo.insert(makeBatch({ id: 'b1', created_at: '2026-01-01T00:00:00.000Z' }));
    repo.insert(makeBatch({ id: 'b2', created_at: '2026-01-02T00:00:00.000Z' }));
    repo.insert(makeBatch({ id: 'b3', created_at: '2026-01-03T00:00:00.000Z' }));

    const all = repo.list({ limit: 10 });
    expect(all.map((b) => b.id)).toEqual(['b3', 'b2', 'b1']);

    const firstTwo = repo.list({ limit: 2 });
    expect(firstTwo.map((b) => b.id)).toEqual(['b3', 'b2']);

    const nextPage = repo.list({ limit: 2, offset: 2 });
    expect(nextPage.map((b) => b.id)).toEqual(['b1']);
    db.close();
  });

  it('list returns [] on an empty DB', () => {
    const db = createMigratedMemoryDb();
    const repo = new ImportBatchRepository(db);
    expect(repo.list({ limit: 10 })).toEqual([]);
    db.close();
  });
});

describe('PromptLogRepository — round-trips', () => {
  it('insert + getById round-trips required fields', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    const entry = makePromptLog({
      id: 'p-required',
      prompt_text: 'Summarize this synthetic note.',
    });
    repo.insert(entry);
    expect(repo.getById('p-required')).toEqual(entry);
    db.close();
  });

  it('nullable fields round-trip as null', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    const entry = makePromptLog({ id: 'p-nulls' });
    repo.insert(entry);
    const read = repo.getById('p-nulls');
    expect(read).not.toBeNull();
    expect(read!.session_id).toBeNull();
    expect(read!.follow_up_index).toBeNull();
    expect(read!.parent_prompt_id).toBeNull();
    expect(read!.input_tokens).toBeNull();
    expect(read!.output_tokens).toBeNull();
    expect(read!.total_tokens).toBeNull();
    expect(read!.estimated_cost).toBeNull();
    expect(read!.latency_ms).toBeNull();
    expect(read!.solved_status).toBeNull();
    expect(read!.user_rating).toBeNull();
    db.close();
  });

  it('populated optional fields round-trip', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    const entry = makePromptLog({
      id: 'p-full',
      session_id: 'sess-1',
      follow_up_index: 2,
      parent_prompt_id: 'p-parent',
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      estimated_cost: 0.0012,
      latency_ms: 450,
      solved_status: 'solved',
      user_rating: 4,
      redaction_status: 'partial',
    });
    repo.insert(entry);
    expect(repo.getById('p-full')).toEqual(entry);
    db.close();
  });

  it('getById returns null for a missing prompt log', () => {
    const db = createMigratedMemoryDb();
    const repo = new PromptLogRepository(db);
    expect(repo.getById('missing')).toBeNull();
    db.close();
  });

  it('list returns [] on an empty DB', () => {
    const db = createMigratedMemoryDb();
    const repo = new PromptLogRepository(db);
    expect(repo.list({ limit: 10 })).toEqual([]);
    db.close();
  });
});

describe('PromptLogRepository — tags', () => {
  it('trims, drops empties, de-duplicates, and hydrates ordered string[]', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    repo.insert(
      makePromptLog({
        id: 'p-tags',
        tags: ['  beta ', 'alpha', 'alpha', '', '   ', 'beta'],
      }),
    );
    const read = repo.getById('p-tags');
    // Deduped + trimmed + empties dropped; hydration ORDER BY tag ASC.
    expect(read!.tags).toEqual(['alpha', 'beta']);
    db.close();
  });

  it('empty tag list round-trips as []', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    repo.insert(makePromptLog({ id: 'p-notags', tags: [] }));
    expect(repo.getById('p-notags')!.tags).toEqual([]);
    db.close();
  });
});

describe('PromptLogRepository — listByBatch and findExistingIds', () => {
  it('listByBatch returns only that batch entries', () => {
    const db = createMigratedMemoryDb();
    const batchRepo = new ImportBatchRepository(db);
    batchRepo.insert(makeBatch({ id: 'batch-a' }));
    batchRepo.insert(makeBatch({ id: 'batch-b' }));
    const repo = new PromptLogRepository(db);
    repo.insert(makePromptLog({ id: 'a1', import_batch_id: 'batch-a' }));
    repo.insert(makePromptLog({ id: 'a2', import_batch_id: 'batch-a' }));
    repo.insert(makePromptLog({ id: 'b1', import_batch_id: 'batch-b' }));

    const aEntries = repo.listByBatch('batch-a', { limit: 10 });
    expect(aEntries.map((e) => e.id).sort()).toEqual(['a1', 'a2']);
    const bEntries = repo.listByBatch('batch-b', { limit: 10 });
    expect(bEntries.map((e) => e.id)).toEqual(['b1']);
    db.close();
  });

  it('findExistingIds returns [] on empty input', () => {
    const db = createMigratedMemoryDb();
    const repo = new PromptLogRepository(db);
    expect(repo.findExistingIds([])).toEqual([]);
    db.close();
  });

  it('findExistingIds returns only existing IDs and preserves caller order', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    repo.insert(makePromptLog({ id: 'exists-1' }));
    repo.insert(makePromptLog({ id: 'exists-2' }));

    const result = repo.findExistingIds([
      'exists-2',
      'missing',
      'exists-1',
      'also-missing',
    ]);
    expect(result).toEqual(['exists-2', 'exists-1']);
    db.close();
  });
});

describe('pagination validation via repositories', () => {
  it('throws a safe option-only error for invalid limit', () => {
    const db = createMigratedMemoryDb();
    const repo = new PromptLogRepository(db);
    expect(() => repo.list({ limit: 0 })).toThrow(
      'list option "limit" must be a positive integer',
    );
    expect(() => repo.list({ limit: -5 })).toThrow(
      'list option "limit" must be a positive integer',
    );
    expect(() => repo.list({ limit: 2.5 })).toThrow(
      'list option "limit" must be a positive integer',
    );
    db.close();
  });

  it('throws a safe option-only error for invalid offset', () => {
    const db = createMigratedMemoryDb();
    const repo = new PromptLogRepository(db);
    expect(() => repo.list({ limit: 10, offset: -1 })).toThrow(
      'list option "offset" must be a non-negative integer',
    );
    db.close();
  });

  it('caps an oversized limit at MAX_LIST_LIMIT without throwing', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    repo.insert(makePromptLog({ id: 'p-cap' }));
    // Oversized limit should not throw; capped internally.
    expect(() => repo.list({ limit: MAX_LIST_LIMIT + 5000 })).not.toThrow();
    expect(repo.list({ limit: MAX_LIST_LIMIT + 5000 })).toHaveLength(1);
    db.close();
  });
});

describe('soft-delete default behavior', () => {
  it('excludes soft-deleted rows by default and includes them on request', () => {
    const db = createMigratedMemoryDb();
    new ImportBatchRepository(db).insert(makeBatch());
    const repo = new PromptLogRepository(db);
    repo.insert(makePromptLog({ id: 'p-soft' }));

    // Manually soft-delete (test setup only).
    db.prepare('UPDATE prompt_logs SET deleted_at = ? WHERE id = ?').run(
      '2026-02-01T00:00:00.000Z',
      'p-soft',
    );

    expect(repo.getById('p-soft')).toBeNull();
    expect(repo.getById('p-soft', { includeDeleted: true })).not.toBeNull();

    expect(repo.list({ limit: 10 })).toEqual([]);
    expect(repo.list({ limit: 10, includeDeleted: true })).toHaveLength(1);

    expect(repo.listByBatch('batch-1', { limit: 10 })).toEqual([]);
    expect(
      repo.listByBatch('batch-1', { limit: 10, includeDeleted: true }),
    ).toHaveLength(1);
    db.close();
  });
});
