/**
 * cookedPrompts — Scoring Persistence Test Helpers
 *
 * Synthetic PromptScore and PromptLogEntry fixtures for Wave 4 persistence tests.
 * All data is synthetic. No real prompts, secrets, full-answer fields, or model answers.
 * Reusable across migration, repository, and privacy tests.
 */

import type { PromptScore, ScoringIssueLabel, ScoreConfidence } from '../../../src/scoring/types.js';
import type { ImportBatch, PromptLogEntry } from '../../../src/importers/local/types.js';
import type { SqliteDatabase } from '../../../src/storage/sqlite/index.js';
import { createMigratedMemoryDb, makeBatch, makePromptLog } from './test-helpers.js';
import { PromptScoreRepository } from '../../../src/storage/sqlite/repositories/prompt-score-repository.js';

/** Re-export shared helpers for convenience. */
export { createMigratedMemoryDb, makeBatch, makePromptLog };

/** Default scoring version for fixtures. */
export const TEST_SCORING_VERSION = '1.0.0';

/** Build a synthetic PromptScore, overridable per test. */
export function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-1',
    prompt_log_id: 'prompt-1',
    overall_score: 3,
    clarity_score: 4,
    context_score: 3,
    constraints_score: 2,
    output_format_score: 3,
    capability_fit_score: 4,
    efficiency_score: 3,
    safety_privacy_score: 5,
    issue_labels: ['missing_constraints'] as ScoringIssueLabel[],
    explanations: ['Constraints could be more specific.'],
    confidence: 'medium' as ScoreConfidence,
    scoring_version: TEST_SCORING_VERSION,
    scored_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build multiple scores for different prompt logs.
 * Each score gets a unique id and prompt_log_id based on index.
 */
export function makeScores(count: number, overrides: Partial<PromptScore> = {}): PromptScore[] {
  return Array.from({ length: count }, (_, i) =>
    makeScore({
      id: `score-${i + 1}`,
      prompt_log_id: `prompt-${i + 1}`,
      ...overrides,
    }),
  );
}

/**
 * Build multiple versions of a score for the same prompt log.
 * Each version has a unique scoring_version and score id.
 */
export function makeVersionedScores(
  promptLogId: string,
  versions: string[],
): PromptScore[] {
  return versions.map((version, i) =>
    makeScore({
      id: `score-${promptLogId}-v${i + 1}`,
      prompt_log_id: promptLogId,
      scoring_version: version,
      scored_at: `2026-01-0${i + 1}T00:00:00.000Z`,
    }),
  );
}

/**
 * Insert a prompt log into the database (required before inserting scores
 * due to the FK on prompt_scores.prompt_log_id).
 */
export function insertPromptLog(db: SqliteDatabase, overrides: Partial<PromptLogEntry> = {}): void {
  const entry = makePromptLog(overrides);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO prompt_logs (
      id, timestamp, source, provider, model_used, prompt_text,
      import_batch_id, prompt_hash, session_id, follow_up_index,
      parent_prompt_id, input_tokens, output_tokens, total_tokens,
      estimated_cost, latency_ms, solved_status, user_rating,
      redaction_status, created_at, updated_at, deleted_at,
      user_id, workspace_id, sync_status
    ) VALUES (
      @id, @timestamp, @source, @provider, @model_used, @prompt_text,
      @import_batch_id, @prompt_hash, @session_id, @follow_up_index,
      @parent_prompt_id, @input_tokens, @output_tokens, @total_tokens,
      @estimated_cost, @latency_ms, @solved_status, @user_rating,
      @redaction_status, @created_at, @updated_at, @deleted_at,
      @user_id, @workspace_id, @sync_status
    )`,
  ).run({
    id: entry.id,
    timestamp: entry.timestamp,
    source: entry.source,
    provider: entry.provider,
    model_used: entry.model_used,
    prompt_text: entry.prompt_text,
    import_batch_id: entry.import_batch_id,
    prompt_hash: entry.prompt_hash ?? null,
    session_id: entry.session_id ?? null,
    follow_up_index: entry.follow_up_index ?? null,
    parent_prompt_id: entry.parent_prompt_id ?? null,
    input_tokens: entry.input_tokens ?? null,
    output_tokens: entry.output_tokens ?? null,
    total_tokens: entry.total_tokens ?? null,
    estimated_cost: entry.estimated_cost ?? null,
    latency_ms: entry.latency_ms ?? null,
    solved_status: entry.solved_status ?? null,
    user_rating: entry.user_rating ?? null,
    redaction_status: entry.redaction_status ?? 'none',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    user_id: null,
    workspace_id: null,
    sync_status: null,
  });
}

/** Insert a prompt log marked as soft-deleted. */
export function insertDeletedPromptLog(
  db: SqliteDatabase,
  overrides: Partial<PromptLogEntry> = {},
): void {
  const entry = makePromptLog(overrides);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO prompt_logs (
      id, timestamp, source, provider, model_used, prompt_text,
      import_batch_id, prompt_hash, session_id, follow_up_index,
      parent_prompt_id, input_tokens, output_tokens, total_tokens,
      estimated_cost, latency_ms, solved_status, user_rating,
      redaction_status, created_at, updated_at, deleted_at,
      user_id, workspace_id, sync_status
    ) VALUES (
      @id, @timestamp, @source, @provider, @model_used, @prompt_text,
      @import_batch_id, @prompt_hash, @session_id, @follow_up_index,
      @parent_prompt_id, @input_tokens, @output_tokens, @total_tokens,
      @estimated_cost, @latency_ms, @solved_status, @user_rating,
      @redaction_status, @created_at, @updated_at, @deleted_at,
      @user_id, @workspace_id, @sync_status
    )`,
  ).run({
    id: entry.id,
    timestamp: entry.timestamp,
    source: entry.source,
    provider: entry.provider,
    model_used: entry.model_used,
    prompt_text: entry.prompt_text,
    import_batch_id: entry.import_batch_id,
    prompt_hash: entry.prompt_hash ?? null,
    session_id: entry.session_id ?? null,
    follow_up_index: entry.follow_up_index ?? null,
    parent_prompt_id: entry.parent_prompt_id ?? null,
    input_tokens: entry.input_tokens ?? null,
    output_tokens: entry.output_tokens ?? null,
    total_tokens: entry.total_tokens ?? null,
    estimated_cost: entry.estimated_cost ?? null,
    latency_ms: entry.latency_ms ?? null,
    solved_status: entry.solved_status ?? null,
    user_rating: entry.user_rating ?? null,
    redaction_status: entry.redaction_status ?? 'none',
    created_at: now,
    updated_at: now,
    deleted_at: now, // Soft-deleted
    user_id: null,
    workspace_id: null,
    sync_status: null,
  });
}

/** Insert an import batch into the database (required for importBatchId filtering). */
export function insertImportBatch(db: SqliteDatabase, overrides: Partial<ImportBatch> = {}): void {
  const batch = makeBatch(overrides);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO import_batches (
      id, source_type, source_filename, total_rows, valid_rows,
      invalid_rows, warnings_count, created_at
    ) VALUES (
      @id, @source_type, @source_filename, @total_rows, @valid_rows,
      @invalid_rows, @warnings_count, @created_at
    )`,
  ).run({
    id: batch.id,
    source_type: batch.source_type,
    source_filename: batch.source_filename,
    total_rows: batch.total_rows,
    valid_rows: batch.valid_rows,
    invalid_rows: batch.invalid_rows,
    warnings_count: batch.warnings_count,
    created_at: now,
  });
}

/**
 * Set up a standard test database with an import batch and prompt logs.
 * Returns the db and repository for immediate use.
 */
export function setupTestDb(promptLogCount = 1): {
  db: SqliteDatabase;
  repo: PromptScoreRepository;
} {
  const db = createMigratedMemoryDb();
  insertImportBatch(db);
  for (let i = 1; i <= promptLogCount; i++) {
    insertPromptLog(db, { id: `prompt-${i}` });
  }
  const repo = new PromptScoreRepository(db);
  return { db, repo };
}
