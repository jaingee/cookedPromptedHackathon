/**
 * cookedPrompts — Dashboard Test Helpers
 *
 * Synthetic fixtures and helper functions for dashboard data service tests.
 * Reuses existing prompt-score-test-helpers. All data synthetic.
 * No real prompts, secrets, full-answer fields, or model answers.
 */

import {
  createMigratedMemoryDb,
  insertPromptLog,
  insertImportBatch,
  insertDeletedPromptLog,
  makeScore,
} from '../storage/sqlite/prompt-score-test-helpers.js';
import { PromptScoreRepository } from '../../src/storage/sqlite/repositories/prompt-score-repository.js';
import { PromptLogRepository } from '../../src/storage/sqlite/repositories/prompt-log-repository.js';
import { DashboardDataService } from '../../src/dashboard/dashboard-data-service.js';
import type { SqliteDatabase } from '../../src/storage/sqlite/sqlite-connection.js';
import type { ScoreValue, ScoreConfidence, ScoringIssueLabel } from '../../src/scoring/types.js';

/** Re-export shared helpers for convenience. */
export {
  createMigratedMemoryDb,
  insertImportBatch,
  insertPromptLog,
  insertDeletedPromptLog,
  makeScore,
};

/** Synthetic prompt text used in tests — must never appear in aggregate/list DTOs. */
export const SYNTHETIC_PROMPT_TEXT = 'SYNTHETIC_LOCAL_DETAIL_PROMPT_DO_NOT_LEAK';

/** Set up a dashboard test database with migrations, import batch, and wired service. */
export function setupDashboardTestDb(): {
  db: SqliteDatabase;
  scoreRepo: PromptScoreRepository;
  logRepo: PromptLogRepository;
  service: DashboardDataService;
} {
  const db = createMigratedMemoryDb();
  insertImportBatch(db);
  const scoreRepo = new PromptScoreRepository(db);
  const logRepo = new PromptLogRepository(db);
  const service = new DashboardDataService(scoreRepo, logRepo);
  return { db, scoreRepo, logRepo, service };
}

/** Options for insertPromptWithScore. */
export interface InsertPromptWithScoreOptions {
  promptId?: string;
  scoreId?: string;
  overallScore?: ScoreValue;
  confidence?: ScoreConfidence;
  issueLabels?: ScoringIssueLabel[];
  scoringVersion?: string;
  scoredAt?: string;
  timestamp?: string;
  importBatchId?: string;
  promptText?: string;
  clarityScore?: ScoreValue;
  contextScore?: ScoreValue;
  constraintsScore?: ScoreValue;
  outputFormatScore?: ScoreValue;
  capabilityFitScore?: ScoreValue;
  efficiencyScore?: ScoreValue;
  safetyPrivacyScore?: ScoreValue;
}

/**
 * Insert a prompt log and save a score for it in one call.
 * Uses deterministic synthetic data. Requires an import batch already inserted.
 */
export function insertPromptWithScore(
  db: SqliteDatabase,
  options: InsertPromptWithScoreOptions = {},
): void {
  const promptId = options.promptId ?? 'prompt-1';
  const scoreId = options.scoreId ?? 'score-1';
  const importBatchId = options.importBatchId ?? 'batch-1';

  insertPromptLog(db, {
    id: promptId,
    timestamp: options.timestamp ?? '2026-01-01T00:00:00.000Z',
    import_batch_id: importBatchId,
    prompt_text: options.promptText ?? SYNTHETIC_PROMPT_TEXT,
  });

  const scoreRepo = new PromptScoreRepository(db);
  scoreRepo.save(
    makeScore({
      id: scoreId,
      prompt_log_id: promptId,
      overall_score: options.overallScore ?? 3,
      confidence: options.confidence ?? 'medium',
      issue_labels: options.issueLabels ?? ['missing_constraints'],
      scoring_version: options.scoringVersion ?? '1.0.0',
      scored_at: options.scoredAt ?? '2026-01-01T00:00:00.000Z',
      clarity_score: options.clarityScore ?? 4,
      context_score: options.contextScore ?? 3,
      constraints_score: options.constraintsScore ?? 2,
      output_format_score: options.outputFormatScore ?? 3,
      capability_fit_score: options.capabilityFitScore ?? 4,
      efficiency_score: options.efficiencyScore ?? 3,
      safety_privacy_score: options.safetyPrivacyScore ?? 5,
    }),
  );
}

/** Assert that JSON.stringify(value) does not contain 'prompt_text' key or the synthetic text. */
export function expectNoPromptText(value: unknown): void {
  const json = JSON.stringify(value);
  if (json.includes('"prompt_text"')) {
    throw new Error('Privacy violation: result contains "prompt_text" key');
  }
  if (json.includes(SYNTHETIC_PROMPT_TEXT)) {
    throw new Error('Privacy violation: result contains synthetic prompt text string');
  }
}

/** Banned full-answer field names that must never appear in dashboard DTOs. */
const BANNED_ANSWER_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

/** Assert that JSON.stringify(value) does not contain any banned full-answer fields. */
export function expectNoBannedAnswerFields(value: unknown): void {
  const json = JSON.stringify(value);
  for (const field of BANNED_ANSWER_FIELDS) {
    if (json.includes(`"${field}"`)) {
      throw new Error(`Privacy violation: result contains banned field "${field}"`);
    }
  }
}
