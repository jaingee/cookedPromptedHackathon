/**
 * cookedPrompts — PromptScoreRepository Tests (Wave 4, Tasks 4.3–4.7)
 *
 * Covers: save/read round-trip, saveMany transaction behavior,
 * replace/upsert policy, list/filter methods, and aggregate counts.
 *
 * All data synthetic. No real prompts, secrets, or model answers.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { PromptScoreRepository } from '../../../src/storage/sqlite/repositories/prompt-score-repository.js';
import type { SqliteDatabase } from '../../../src/storage/sqlite/index.js';
import type { PromptScore, ScoringIssueLabel } from '../../../src/scoring/types.js';
import {
  createMigratedMemoryDb,
  insertImportBatch,
  insertPromptLog,
  insertDeletedPromptLog,
  makeScore,
  makeScores,
  makeVersionedScores,
  setupTestDb,
  TEST_SCORING_VERSION,
} from './prompt-score-test-helpers.js';

// --- Task 4.3: Save/Read Round-Trip ---

describe('PromptScoreRepository — save/read', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    const setup = setupTestDb(1);
    db = setup.db;
    repo = setup.repo;
  });

  it('save(score) writes and getById returns the expected PromptScore', () => {
    const score = makeScore();
    repo.save(score);
    const result = repo.getById('score-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('score-1');
    expect(result!.prompt_log_id).toBe('prompt-1');
    expect(result!.overall_score).toBe(3);
    expect(result!.clarity_score).toBe(4);
    expect(result!.confidence).toBe('medium');
    expect(result!.scoring_version).toBe(TEST_SCORING_VERSION);
    expect(result!.scored_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('issue_labels round-trip in canonical order', () => {
    const score = makeScore({
      issue_labels: ['overbroad_prompt', 'missing_context'] as ScoringIssueLabel[],
    });
    repo.save(score);
    const result = repo.getById('score-1');
    // Canonical order: missing_context before overbroad_prompt
    expect(result!.issue_labels).toEqual(['missing_context', 'overbroad_prompt']);
  });

  it('explanations round-trip as string arrays', () => {
    const score = makeScore({
      explanations: ['First explanation.', 'Second explanation.'],
    });
    repo.save(score);
    const result = repo.getById('score-1');
    expect(result!.explanations).toEqual(['First explanation.', 'Second explanation.']);
  });

  it('invalid stored explanations_json maps to empty array', () => {
    const score = makeScore();
    repo.save(score);
    // Manually corrupt the explanations_json
    db.prepare("UPDATE prompt_scores SET explanations_json = 'not-json' WHERE id = 'score-1'").run();
    const result = repo.getById('score-1');
    expect(result!.explanations).toEqual([]);
  });

  it('getByPromptLogId returns latest score by default', () => {
    const setup2 = setupTestDb(1);
    const db2 = setup2.db;
    const repo2 = setup2.repo;
    const scores = makeVersionedScores('prompt-1', ['0.9.0', '1.0.0']);
    repo2.saveMany(scores);
    const result = repo2.getByPromptLogId('prompt-1');
    // Latest by scored_at DESC
    expect(result).not.toBeNull();
    expect(result!.scoring_version).toBe('1.0.0');
  });

  it('getByPromptLogId returns exact version when scoringVersion provided', () => {
    const scores = makeVersionedScores('prompt-1', ['0.9.0', '1.0.0']);
    repo.saveMany(scores);
    const result = repo.getByPromptLogId('prompt-1', { scoringVersion: '0.9.0' });
    expect(result).not.toBeNull();
    expect(result!.scoring_version).toBe('0.9.0');
  });

  it('getByPromptLogIds preserves caller order and drops missing rows', () => {
    const setup2 = setupTestDb(3);
    const repo2 = setup2.repo;
    // Save scores for prompt-1 and prompt-3, skip prompt-2
    repo2.save(makeScore({ id: 'score-1', prompt_log_id: 'prompt-1' }));
    repo2.save(makeScore({ id: 'score-3', prompt_log_id: 'prompt-3' }));
    const results = repo2.getByPromptLogIds(['prompt-3', 'prompt-1', 'prompt-2']);
    expect(results).toHaveLength(2);
    // Preserves caller order
    expect(results[0].prompt_log_id).toBe('prompt-3');
    expect(results[1].prompt_log_id).toBe('prompt-1');
  });

  it('returned objects match the public PromptScore shape (no raw rows)', () => {
    repo.save(makeScore());
    const result = repo.getById('score-1')!;
    // Only PromptScore keys should be present
    const keys = Object.keys(result).sort();
    const expectedKeys = [
      'capability_fit_score', 'clarity_score', 'confidence', 'constraints_score',
      'context_score', 'efficiency_score', 'explanations', 'id', 'issue_labels',
      'output_format_score', 'overall_score', 'prompt_log_id',
      'safety_privacy_score', 'scored_at', 'scoring_version',
    ].sort();
    expect(keys).toEqual(expectedKeys);
  });

  it('labels round-trip with empty array', () => {
    const score = makeScore({ issue_labels: [] });
    repo.save(score);
    const result = repo.getById('score-1');
    expect(result!.issue_labels).toEqual([]);
  });
});

// --- Task 4.4: saveMany Transaction Rollback ---

describe('PromptScoreRepository — saveMany transaction', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    const setup = setupTestDb(5);
    db = setup.db;
    repo = setup.repo;
  });

  it('empty batch returns { saved_count: 0, replaced_count: 0 }', () => {
    const result = repo.saveMany([]);
    expect(result).toEqual({ saved_count: 0, replaced_count: 0 });
  });

  it('multiple valid scores save in one operation', () => {
    const scores = makeScores(3);
    const result = repo.saveMany(scores);
    expect(result.saved_count).toBe(3);
    expect(result.replaced_count).toBe(0);
    // Verify all persisted
    for (let i = 1; i <= 3; i++) {
      expect(repo.getById(`score-${i}`)).not.toBeNull();
    }
  });

  it('duplicate PromptScore.id inside batch is rejected before writing', () => {
    const scores = [
      makeScore({ id: 'dup-id', prompt_log_id: 'prompt-1' }),
      makeScore({ id: 'dup-id', prompt_log_id: 'prompt-2' }),
    ];
    expect(() => repo.saveMany(scores)).toThrow('Duplicate PromptScore id in batch.');
    // Nothing written
    expect(repo.getById('dup-id')).toBeNull();
  });

  it('duplicate (prompt_log_id, scoring_version) inside batch is rejected', () => {
    const scores = [
      makeScore({ id: 'score-a', prompt_log_id: 'prompt-1', scoring_version: '1.0.0' }),
      makeScore({ id: 'score-b', prompt_log_id: 'prompt-1', scoring_version: '1.0.0' }),
    ];
    expect(() => repo.saveMany(scores)).toThrow(
      'Duplicate PromptScore in batch for prompt_log_id + scoring_version.',
    );
    expect(repo.getById('score-a')).toBeNull();
    expect(repo.getById('score-b')).toBeNull();
  });

  it('if one score in batch is invalid, no scores from that batch are written', () => {
    const validScore = makeScore({ id: 'score-1', prompt_log_id: 'prompt-1' });
    const invalidScore = makeScore({
      id: 'score-2',
      prompt_log_id: 'prompt-2',
      overall_score: 99 as any, // Invalid: out of 0–5 range
    });
    expect(() => repo.saveMany([validScore, invalidScore])).toThrow();
    // Neither should be persisted
    expect(repo.getById('score-1')).toBeNull();
    expect(repo.getById('score-2')).toBeNull();
  });

  it('if a DB constraint fails during write, the transaction rolls back', () => {
    // Try to save a score referencing a non-existent prompt_log_id (FK violation)
    const score = makeScore({ id: 'score-fk', prompt_log_id: 'nonexistent-prompt' });
    expect(() => repo.save(score)).toThrow();
    expect(repo.getById('score-fk')).toBeNull();
  });

  it('errors remain content-free', () => {
    const invalidScore = makeScore({
      id: 'score-bad',
      prompt_log_id: 'prompt-1',
      confidence: 'invalid' as any,
    });
    try {
      repo.save(invalidScore);
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).not.toContain('synthetic');
      expect(msg).not.toContain('prompt-1');
      expect(msg).toContain('confidence');
    }
  });
});

// --- Task 4.5: Replace/Upsert ---

describe('PromptScoreRepository — replace/upsert', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    const setup = setupTestDb(3);
    db = setup.db;
    repo = setup.repo;
  });

  it('saving the same (prompt_log_id, scoring_version) replaces the old row', () => {
    const original = makeScore({ id: 'orig-id', prompt_log_id: 'prompt-1', overall_score: 2 });
    repo.save(original);
    const replacement = makeScore({ id: 'new-id', prompt_log_id: 'prompt-1', overall_score: 4 });
    const result = repo.save(replacement);
    expect(result.replaced_count).toBe(1);
    expect(result.saved_count).toBe(0);
    // Old id gone
    expect(repo.getById('orig-id')).toBeNull();
    // New id present with new score
    const stored = repo.getById('new-id');
    expect(stored).not.toBeNull();
    expect(stored!.overall_score).toBe(4);
  });

  it('replacement stores the incoming PromptScore.id', () => {
    repo.save(makeScore({ id: 'old-id', prompt_log_id: 'prompt-1' }));
    repo.save(makeScore({ id: 'incoming-id', prompt_log_id: 'prompt-1' }));
    const stored = repo.getByPromptLogId('prompt-1');
    expect(stored).not.toBeNull();
    expect(stored!.id).toBe('incoming-id');
  });

  it('old labels are cascade-deleted and replaced with incoming labels', () => {
    const original = makeScore({
      id: 'orig-id',
      prompt_log_id: 'prompt-1',
      issue_labels: ['missing_context'] as ScoringIssueLabel[],
    });
    repo.save(original);
    const replacement = makeScore({
      id: 'new-id',
      prompt_log_id: 'prompt-1',
      issue_labels: ['unclear_task', 'overbroad_prompt'] as ScoringIssueLabel[],
    });
    repo.save(replacement);
    const stored = repo.getById('new-id');
    expect(stored!.issue_labels).toEqual(['unclear_task', 'overbroad_prompt']);
    // Verify old labels actually gone from DB
    const rows = db
      .prepare("SELECT * FROM prompt_score_labels WHERE prompt_score_id = 'orig-id'")
      .all();
    expect(rows).toHaveLength(0);
  });

  it('saved_count and replaced_count are accurate', () => {
    repo.save(makeScore({ id: 'existing', prompt_log_id: 'prompt-1' }));
    const batch = [
      makeScore({ id: 'replace-existing', prompt_log_id: 'prompt-1' }), // replace
      makeScore({ id: 'new-score', prompt_log_id: 'prompt-2' }), // new
    ];
    const result = repo.saveMany(batch);
    expect(result.saved_count).toBe(1);
    expect(result.replaced_count).toBe(1);
  });

  it('different scoring_version values coexist for the same prompt log', () => {
    const v1 = makeScore({ id: 'v1-id', prompt_log_id: 'prompt-1', scoring_version: '1.0.0' });
    const v2 = makeScore({ id: 'v2-id', prompt_log_id: 'prompt-1', scoring_version: '2.0.0' });
    repo.save(v1);
    repo.save(v2);
    // Both exist
    expect(repo.getById('v1-id')).not.toBeNull();
    expect(repo.getById('v2-id')).not.toBeNull();
    // Can retrieve each by version
    expect(repo.getByPromptLogId('prompt-1', { scoringVersion: '1.0.0' })!.id).toBe('v1-id');
    expect(repo.getByPromptLogId('prompt-1', { scoringVersion: '2.0.0' })!.id).toBe('v2-id');
  });

  it('no duplicate active row exists for the same (prompt_log_id, scoring_version)', () => {
    repo.save(makeScore({ id: 'first', prompt_log_id: 'prompt-1' }));
    repo.save(makeScore({ id: 'second', prompt_log_id: 'prompt-1' }));
    const rows = db
      .prepare("SELECT id FROM prompt_scores WHERE prompt_log_id = 'prompt-1' AND scoring_version = ?")
      .all(TEST_SCORING_VERSION) as Array<{ id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('second');
  });
});

// --- Task 4.6: List/Filter ---

describe('PromptScoreRepository — list/filter', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    db = createMigratedMemoryDb();
    insertImportBatch(db, { id: 'batch-1' });
    insertImportBatch(db, { id: 'batch-2' });
    // Create 5 prompt logs across two batches
    for (let i = 1; i <= 3; i++) {
      insertPromptLog(db, { id: `prompt-${i}`, import_batch_id: 'batch-1' });
    }
    for (let i = 4; i <= 5; i++) {
      insertPromptLog(db, { id: `prompt-${i}`, import_batch_id: 'batch-2' });
    }
    repo = new PromptScoreRepository(db);

    // Save varied scores
    repo.saveMany([
      makeScore({
        id: 'score-1', prompt_log_id: 'prompt-1',
        overall_score: 5, confidence: 'high',
        issue_labels: ['missing_context'] as ScoringIssueLabel[],
        scored_at: '2026-01-05T00:00:00.000Z',
      }),
      makeScore({
        id: 'score-2', prompt_log_id: 'prompt-2',
        overall_score: 2, confidence: 'low',
        issue_labels: ['unclear_task', 'missing_constraints'] as ScoringIssueLabel[],
        scored_at: '2026-01-04T00:00:00.000Z',
      }),
      makeScore({
        id: 'score-3', prompt_log_id: 'prompt-3',
        overall_score: 3, confidence: 'medium',
        issue_labels: ['missing_context', 'overbroad_prompt'] as ScoringIssueLabel[],
        scored_at: '2026-01-03T00:00:00.000Z',
      }),
      makeScore({
        id: 'score-4', prompt_log_id: 'prompt-4',
        overall_score: 4, confidence: 'high',
        issue_labels: [] as ScoringIssueLabel[],
        scored_at: '2026-01-02T00:00:00.000Z',
        scoring_version: '2.0.0',
      }),
      makeScore({
        id: 'score-5', prompt_log_id: 'prompt-5',
        overall_score: 1, confidence: 'low',
        issue_labels: ['privacy_risk'] as ScoringIssueLabel[],
        scored_at: '2026-01-01T00:00:00.000Z',
      }),
    ]);
  });

  it('uses bounded pagination', () => {
    const results = repo.list({ limit: 2 });
    expect(results).toHaveLength(2);
  });

  it('orders newest first by scored_at DESC, id DESC', () => {
    const results = repo.list({ limit: 100 });
    expect(results[0].id).toBe('score-1'); // 2026-01-05
    expect(results[4].id).toBe('score-5'); // 2026-01-01
  });

  it('supports promptLogId filter', () => {
    const results = repo.list({ limit: 100, promptLogId: 'prompt-2' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('score-2');
  });

  it('supports importBatchId filter', () => {
    const results = repo.list({ limit: 100, importBatchId: 'batch-2' });
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-4');
    expect(ids).toContain('score-5');
  });

  it('supports issueLabel filter', () => {
    const results = repo.list({ limit: 100, issueLabel: 'missing_context' });
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-1');
    expect(ids).toContain('score-3');
  });

  it('supports confidence filter', () => {
    const results = repo.list({ limit: 100, confidence: 'high' });
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-1');
    expect(ids).toContain('score-4');
  });

  it('supports scoringVersion filter', () => {
    const results = repo.list({ limit: 100, scoringVersion: '2.0.0' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('score-4');
  });

  it('supports overallScoreMin filter', () => {
    const results = repo.list({ limit: 100, overallScoreMin: 4 });
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-1'); // 5
    expect(ids).toContain('score-4'); // 4
  });

  it('supports overallScoreMax filter', () => {
    const results = repo.list({ limit: 100, overallScoreMax: 2 });
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-2'); // 2
    expect(ids).toContain('score-5'); // 1
  });

  it('filters compose with AND behavior', () => {
    const results = repo.list({
      limit: 100,
      confidence: 'low',
      overallScoreMax: 2,
    });
    expect(results).toHaveLength(2);
    // score-2 (overall 2, low) and score-5 (overall 1, low)
    for (const r of results) {
      expect(r.confidence).toBe('low');
      expect(r.overall_score).toBeLessThanOrEqual(2);
    }
  });

  it('excludes soft-deleted prompt logs by default', () => {
    // Add a deleted prompt log with a score
    insertDeletedPromptLog(db, { id: 'prompt-deleted', import_batch_id: 'batch-1' });
    repo.save(makeScore({
      id: 'score-deleted',
      prompt_log_id: 'prompt-deleted',
      scored_at: '2026-01-06T00:00:00.000Z',
    }));
    const results = repo.list({ limit: 100 });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain('score-deleted');
  });

  it('includeDeletedPromptLogs opts in', () => {
    insertDeletedPromptLog(db, { id: 'prompt-deleted', import_batch_id: 'batch-1' });
    repo.save(makeScore({
      id: 'score-deleted',
      prompt_log_id: 'prompt-deleted',
      scored_at: '2026-01-06T00:00:00.000Z',
    }));
    const results = repo.list({ limit: 100, includeDeletedPromptLogs: true });
    const ids = results.map((r) => r.id);
    expect(ids).toContain('score-deleted');
  });

  it('pagination does not return unbounded results', () => {
    // Even with a large limit, MAX_LIST_LIMIT caps it
    const results = repo.list({ limit: 9999 });
    // We only have 5 scores, so this just verifies no error
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('no query result contains prompt_text', () => {
    const results = repo.list({ limit: 100 });
    for (const r of results) {
      expect(r).not.toHaveProperty('prompt_text');
    }
  });
});

// --- Task 4.7: Aggregate Count Tests ---

describe('PromptScoreRepository — countByIssueLabel', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    db = createMigratedMemoryDb();
    insertImportBatch(db, { id: 'batch-1' });
    insertImportBatch(db, { id: 'batch-2' });
    for (let i = 1; i <= 4; i++) {
      insertPromptLog(db, { id: `prompt-${i}`, import_batch_id: i <= 2 ? 'batch-1' : 'batch-2' });
    }
    repo = new PromptScoreRepository(db);

    repo.saveMany([
      makeScore({
        id: 'score-1', prompt_log_id: 'prompt-1',
        issue_labels: ['missing_context', 'unclear_task'] as ScoringIssueLabel[],
      }),
      makeScore({
        id: 'score-2', prompt_log_id: 'prompt-2',
        issue_labels: ['missing_context'] as ScoringIssueLabel[],
      }),
      makeScore({
        id: 'score-3', prompt_log_id: 'prompt-3',
        issue_labels: ['unclear_task', 'privacy_risk'] as ScoringIssueLabel[],
      }),
      makeScore({
        id: 'score-4', prompt_log_id: 'prompt-4',
        issue_labels: ['privacy_risk'] as ScoringIssueLabel[],
        scoring_version: '2.0.0',
      }),
    ]);
  });

  it('counts grouped by known labels', () => {
    const counts = repo.countByIssueLabel();
    const map = new Map(counts.map((c) => [c.label, c.count]));
    expect(map.get('missing_context')).toBe(2);
    expect(map.get('unclear_task')).toBe(2);
    expect(map.get('privacy_risk')).toBe(2);
  });

  it('filters by importBatchId', () => {
    const counts = repo.countByIssueLabel({ importBatchId: 'batch-1' });
    const map = new Map(counts.map((c) => [c.label, c.count]));
    expect(map.get('missing_context')).toBe(2);
    expect(map.get('unclear_task')).toBe(1);
    expect(map.has('privacy_risk')).toBe(false);
  });

  it('filters by scoringVersion', () => {
    const counts = repo.countByIssueLabel({ scoringVersion: '2.0.0' });
    expect(counts).toHaveLength(1);
    expect(counts[0].label).toBe('privacy_risk');
    expect(counts[0].count).toBe(1);
  });

  it('excludes soft-deleted prompt logs by default', () => {
    insertDeletedPromptLog(db, { id: 'prompt-deleted', import_batch_id: 'batch-1' });
    repo.save(makeScore({
      id: 'score-deleted', prompt_log_id: 'prompt-deleted',
      issue_labels: ['missing_context'] as ScoringIssueLabel[],
    }));
    const counts = repo.countByIssueLabel();
    const map = new Map(counts.map((c) => [c.label, c.count]));
    // Should still be 2, not 3
    expect(map.get('missing_context')).toBe(2);
  });

  it('returns labels in canonical order', () => {
    const counts = repo.countByIssueLabel();
    const labels = counts.map((c) => c.label);
    // Canonical order: missing_context, unclear_task, ..., privacy_risk
    const contextIdx = labels.indexOf('missing_context');
    const taskIdx = labels.indexOf('unclear_task');
    const privacyIdx = labels.indexOf('privacy_risk');
    expect(contextIdx).toBeLessThan(taskIdx);
    expect(taskIdx).toBeLessThan(privacyIdx);
  });

  it('filters out unknown labels if a bad row is manually inserted', () => {
    // Manually insert a bad label row
    db.prepare(
      "INSERT INTO prompt_score_labels (prompt_score_id, label) VALUES ('score-1', 'unknown_label')",
    ).run();
    const counts = repo.countByIssueLabel();
    const labels = counts.map((c) => c.label);
    expect(labels).not.toContain('unknown_label');
  });
});

describe('PromptScoreRepository — countByConfidence', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    db = createMigratedMemoryDb();
    insertImportBatch(db, { id: 'batch-1' });
    insertImportBatch(db, { id: 'batch-2' });
    for (let i = 1; i <= 5; i++) {
      insertPromptLog(db, { id: `prompt-${i}`, import_batch_id: i <= 3 ? 'batch-1' : 'batch-2' });
    }
    repo = new PromptScoreRepository(db);

    repo.saveMany([
      makeScore({ id: 'score-1', prompt_log_id: 'prompt-1', confidence: 'low' }),
      makeScore({ id: 'score-2', prompt_log_id: 'prompt-2', confidence: 'low' }),
      makeScore({ id: 'score-3', prompt_log_id: 'prompt-3', confidence: 'medium' }),
      makeScore({ id: 'score-4', prompt_log_id: 'prompt-4', confidence: 'high' }),
      makeScore({ id: 'score-5', prompt_log_id: 'prompt-5', confidence: 'high', scoring_version: '2.0.0' }),
    ]);
  });

  it('counts grouped by confidence', () => {
    const counts = repo.countByConfidence();
    const map = new Map(counts.map((c) => [c.confidence, c.count]));
    expect(map.get('low')).toBe(2);
    expect(map.get('medium')).toBe(1);
    expect(map.get('high')).toBe(2);
  });

  it('filters by importBatchId', () => {
    const counts = repo.countByConfidence({ importBatchId: 'batch-1' });
    const map = new Map(counts.map((c) => [c.confidence, c.count]));
    expect(map.get('low')).toBe(2);
    expect(map.get('medium')).toBe(1);
    expect(map.has('high')).toBe(false);
  });

  it('filters by scoringVersion', () => {
    const counts = repo.countByConfidence({ scoringVersion: '2.0.0' });
    expect(counts).toHaveLength(1);
    expect(counts[0].confidence).toBe('high');
    expect(counts[0].count).toBe(1);
  });

  it('excludes soft-deleted prompt logs by default', () => {
    insertDeletedPromptLog(db, { id: 'prompt-deleted', import_batch_id: 'batch-1' });
    repo.save(makeScore({
      id: 'score-deleted', prompt_log_id: 'prompt-deleted', confidence: 'low',
    }));
    const counts = repo.countByConfidence();
    const map = new Map(counts.map((c) => [c.confidence, c.count]));
    // Should still be 2, not 3
    expect(map.get('low')).toBe(2);
  });

  it('returns confidence in low, medium, high order', () => {
    const counts = repo.countByConfidence();
    const order = counts.map((c) => c.confidence);
    expect(order).toEqual(['low', 'medium', 'high']);
  });

  it('schema enforces confidence CHECK constraint', () => {
    // Attempting to insert an invalid confidence value directly should fail
    expect(() => {
      db.prepare(
        `INSERT INTO prompt_scores (
          id, prompt_log_id, overall_score, clarity_score, context_score,
          constraints_score, output_format_score, capability_fit_score,
          efficiency_score, safety_privacy_score, confidence, explanations_json,
          scoring_version, scored_at, created_at, updated_at
        ) VALUES (
          'bad-conf', 'prompt-1', 3, 3, 3, 3, 3, 3, 3, 3, 'invalid', '[]',
          '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z'
        )`,
      ).run();
    }).toThrow();
  });
});
