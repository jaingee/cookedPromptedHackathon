/**
 * cookedPrompts — Integration Demo Orchestrator
 *
 * Full V1 coaching pipeline: import/normalize → per-prompt score → persist →
 * safety scan → model recommendation → rewrite suggestion → template suggestion.
 *
 * PRIVACY BOUNDARY:
 * - prompt_text is passed to engines for local in-memory processing only.
 * - prompt_text appears in PromptResult only when include_prompt_text === true.
 * - BatchSummary and PipelineMetadata never contain prompt_text.
 * - Errors are content-free (no prompt text, no stack traces, no secrets).
 * - No banned full-answer fields in any output.
 * - No network, no cloud, no telemetry, no LLM calls.
 *
 * DETERMINISM:
 * - Injected now/idFactory/database_path → reproducible output in tests.
 * - Same input + same options → same output.
 *
 * OUTPUT:
 * - Returns structured data only. No console output, file writing, or rendering.
 */

import { readFile } from 'node:fs/promises';

import type { PromptLogEntry } from '../importers/local/types.js';
import type {
  DemoInput,
  PipelineOptions,
  PipelineMetadata,
  PromptResult,
  UnifiedDemoOutput,
} from './types.js';
import { computeBatchSummary } from './batch-summary.js';
import { shouldIncludePromptText, makeContentFreeError } from './privacy-guards.js';

// Importer
import { buildImportPreview, commitImportPreview } from '../importers/local/controller/index.js';

// Storage
import {
  openSqliteConnection,
  runSqliteMigrations,
  SqliteStorageAdapter,
  PromptScoreRepository,
  IN_MEMORY_SQLITE_DATABASE_PATH,
} from '../storage/sqlite/index.js';
import type { SqliteDatabase } from '../storage/sqlite/index.js';

// Scoring
import { scorePrompt, SCORING_VERSION } from '../scoring/index.js';

// Safety
import { scanPromptSafety, SAFETY_SCANNER_VERSION } from '../safety/index.js';

// Model Recommendation
import { recommendModel, MODEL_RECOMMENDER_VERSION } from '../model-recommendation/index.js';

// Rewrite/Template
import { generateRewriteSuggestion, REWRITE_ENGINE_VERSION, generateTemplateSuggestion, TEMPLATE_GENERATOR_VERSION } from '../rewrite-template/index.js';

/** Orchestrator version identifier. Defined here to avoid circular imports. */
export const ORCHESTRATOR_VERSION = 'integration-demo-v1';

/**
 * Run the full V1 coaching pipeline on a set of prompt logs.
 *
 * Modes:
 * - 'demo': loads the built-in synthetic demo dataset.
 * - 'file': reads a local file and imports via the standard pipeline.
 * - 'entries': accepts pre-normalized PromptLogEntry[] directly.
 *
 * Returns UnifiedDemoOutput with per-prompt results, batch summary, and metadata.
 * On storage initialization failure, returns a top-level error with empty results.
 */
export async function runIntegrationDemo(
  input: DemoInput,
  options?: PipelineOptions,
): Promise<UnifiedDemoOutput> {
  const nowFn = options?.now ?? (() => new Date().toISOString());
  const startedAt = nowFn();
  const includePromptText = shouldIncludePromptText(options);
  const dbPath = options?.database_path ?? IN_MEMORY_SQLITE_DATABASE_PATH;

  // Determine input_source for metadata
  const inputSource = resolveInputSource(input);

  // --- Storage lifecycle ---
  let db: SqliteDatabase;
  try {
    db = openSqliteConnection({ databasePath: dbPath });
    runSqliteMigrations(db);
  } catch {
    const completedAt = nowFn();
    return {
      prompt_results: [],
      batch_summary: computeBatchSummary([]),
      metadata: buildMetadata(startedAt, completedAt, inputSource),
      error: makeContentFreeError('store'),
    };
  }

  const storageAdapter = new SqliteStorageAdapter(db);
  const scoreRepo = new PromptScoreRepository(db);

  try {
    // --- Get normalized entries ---
    let entries: PromptLogEntry[];
    try {
      entries = await getEntries(input, storageAdapter, nowFn);
    } catch {
      const completedAt = nowFn();
      return {
        prompt_results: [],
        batch_summary: computeBatchSummary([]),
        metadata: buildMetadata(startedAt, completedAt, inputSource),
        error: makeContentFreeError('store'),
      };
    }

    // --- Per-prompt pipeline ---
    const promptResults: PromptResult[] = [];

    for (const entry of entries) {
      const result = processPrompt(entry, scoreRepo, options, includePromptText);
      promptResults.push(result);
    }

    const completedAt = nowFn();
    return {
      prompt_results: promptResults,
      batch_summary: computeBatchSummary(promptResults),
      metadata: buildMetadata(startedAt, completedAt, inputSource),
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve a human-readable input_source string for metadata. */
function resolveInputSource(input: DemoInput): string {
  if (input.mode === 'demo') return 'demo';
  if (input.mode === 'file') return `file:${input.source_type}`;
  return 'entries';
}

/**
 * Get normalized PromptLogEntry[] from the input source.
 *
 * - 'demo': builds import preview from demo dataset, commits to storage.
 * - 'file': reads local file, builds import preview, commits to storage.
 * - 'entries': stores entries in SQLite before returning (FK safety for scores).
 */
async function getEntries(
  input: DemoInput,
  storageAdapter: SqliteStorageAdapter,
  nowFn: () => string,
): Promise<PromptLogEntry[]> {
  if (input.mode === 'demo') {
    const preview = await buildImportPreview({
      source_type: 'demo',
      storage_port: storageAdapter,
    });
    const commitResult = await commitImportPreview(preview, storageAdapter);
    if (!commitResult.success) {
      throw new Error('Storage commit failed.');
    }
    return commitResult.entries;
  }

  if (input.mode === 'file') {
    const content = await readFile(input.file_path, 'utf-8');
    const preview = await buildImportPreview({
      source_type: input.source_type,
      content,
      source_filename: input.file_path,
      storage_port: storageAdapter,
    });
    const commitResult = await commitImportPreview(preview, storageAdapter);
    if (!commitResult.success) {
      throw new Error('Storage commit failed.');
    }
    return commitResult.entries;
  }

  // 'entries' mode: store entries in SQLite before scoring (FK safety).
  const entries = input.entries;
  if (entries.length === 0) {
    return [];
  }

  // All entries must share one import_batch_id.
  const batchIds = new Set(entries.map((e) => e.import_batch_id));
  if (batchIds.size > 1) {
    throw new Error('Multiple import batch IDs in entries.');
  }

  const sharedBatchId = entries[0].import_batch_id;
  const syntheticBatch = {
    id: sharedBatchId,
    source_type: 'demo' as const,
    source_filename: 'entries' as string | null,
    total_rows: entries.length,
    valid_rows: entries.length,
    invalid_rows: 0,
    warnings_count: 0,
    created_at: nowFn(),
  };

  const saveResult = await storageAdapter.saveImportBatch(syntheticBatch, entries);
  if (!saveResult.success) {
    throw new Error('Storage save failed.');
  }

  return entries;
}

/**
 * Process a single prompt through the full pipeline.
 *
 * Steps: score → persist_score → safety → model_recommendation → rewrite → template.
 *
 * On any step failure, records a content-free error and the failed step,
 * preserves partial results from completed steps, and returns immediately.
 */
function processPrompt(
  entry: PromptLogEntry,
  scoreRepo: PromptScoreRepository,
  options: PipelineOptions | undefined,
  includePromptText: boolean,
): PromptResult {
  const result: PromptResult = {
    prompt_log_id: entry.id,
    do_not_send_external: false,
  };

  if (includePromptText) {
    result.prompt_text = entry.prompt_text;
  }

  // Build per-engine options from pipeline options
  const scoringOptions = {
    clock: options?.now ? { now: options.now } : undefined,
    idFactory: options?.idFactory,
  };
  const safetyOptions = {
    now: options?.now,
  };
  const modelRecOptions = {
    now: options?.now,
  };
  const rewriteOptions = {
    now: options?.now,
    idFactory: options?.idFactory,
  };

  // Step: score
  let score;
  try {
    score = scorePrompt(entry, scoringOptions);
    result.score = score;
  } catch {
    result.error = makeContentFreeError('score');
    result.failed_step = 'score';
    return result;
  }

  // Step: persist_score
  try {
    scoreRepo.save(score);
  } catch {
    result.error = makeContentFreeError('persist_score');
    result.failed_step = 'persist_score';
    return result;
  }

  // Step: safety
  let safetyResult;
  try {
    safetyResult = scanPromptSafety(
      {
        prompt_log_id: entry.id,
        prompt_text: entry.prompt_text,
        source: entry.source,
        provider: entry.provider,
        model_used: entry.model_used,
        tags: entry.tags,
      },
      safetyOptions,
    );
    result.safety_result = safetyResult;
  } catch {
    result.error = makeContentFreeError('safety');
    result.failed_step = 'safety';
    return result;
  }

  // Step: model_recommendation
  let modelRec;
  try {
    modelRec = recommendModel(
      {
        score,
        safety_result: safetyResult,
        prompt_metadata: {
          source: entry.source,
          provider: entry.provider,
          model_used: entry.model_used,
          tags: entry.tags,
        },
        user_constraints: options?.user_model_constraints,
      },
      modelRecOptions,
    );
    result.model_recommendation = modelRec;

    // do_not_send_external flag
    if (
      modelRec.safety_posture === 'do_not_route_until_redacted' ||
      modelRec.recommended_class === 'do_not_send_external'
    ) {
      result.do_not_send_external = true;
    }
  } catch {
    result.error = makeContentFreeError('model_recommendation');
    result.failed_step = 'model_recommendation';
    return result;
  }

  // Step: rewrite
  try {
    result.rewrite_suggestion = generateRewriteSuggestion(
      {
        prompt_score: score,
        prompt_text: entry.prompt_text,
        safety_result: safetyResult,
        model_recommendation: modelRec,
      },
      rewriteOptions,
    );
  } catch {
    result.error = makeContentFreeError('rewrite');
    result.failed_step = 'rewrite';
    return result;
  }

  // Step: template
  try {
    result.template_suggestion = generateTemplateSuggestion(
      {
        prompt_score: score,
        prompt_text: entry.prompt_text,
        safety_result: safetyResult,
        model_recommendation: modelRec,
      },
      rewriteOptions,
    );
  } catch {
    result.error = makeContentFreeError('template');
    result.failed_step = 'template';
    return result;
  }

  return result;
}

/** Build PipelineMetadata from timing and source info. */
function buildMetadata(
  startedAt: string,
  completedAt: string,
  inputSource: string,
): PipelineMetadata {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(completedAt);
  const duration =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, endMs - startMs)
      : 0;

  return {
    orchestrator_version: ORCHESTRATOR_VERSION,
    engines_used: {
      scoring: SCORING_VERSION,
      safety: SAFETY_SCANNER_VERSION,
      model_recommendation: MODEL_RECOMMENDER_VERSION,
      rewrite: REWRITE_ENGINE_VERSION,
      template: TEMPLATE_GENERATOR_VERSION,
    },
    pipeline_started_at: startedAt,
    pipeline_completed_at: completedAt,
    total_duration_ms: duration,
    input_source: inputSource,
  };
}
