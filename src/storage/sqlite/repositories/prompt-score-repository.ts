/**
 * cookedPrompts — PromptScoreRepository
 *
 * Persists and reads `PromptScore` records (from 03-scoring-engine) in local
 * SQLite. Explicit column mapping only (no object spread into SQL). Labels are
 * normalized into `prompt_score_labels`; explanations are a JSON text array.
 *
 * PRIVACY:
 * - Never stores or returns `prompt_text` or banned full-answer fields.
 * - Never returns raw SQLite rows; never surfaces prompt content in errors.
 * - Local-only: no network, no cloud, no telemetry.
 *
 * Duplicate policy: one active score per (prompt_log_id, scoring_version).
 * Saving the same pair replaces the existing score transactionally; different
 * scoring_version values coexist.
 */

import type {
  PromptScore,
  ScoreConfidence,
  ScoreValue,
  ScoringIssueLabel,
} from '../../../scoring/types.js';
import { SCORING_ISSUE_LABELS, dedupeIssueLabels } from '../../../scoring/index.js';
import type { SqliteDatabase } from '../sqlite-connection.js';
import { normalizePagination, type SqliteListOptions } from './pagination.js';

/** Options for listing/filtering scores (query methods land in Wave 3). */
export interface PromptScoreListOptions extends SqliteListOptions {
  promptLogId?: string;
  importBatchId?: string;
  issueLabel?: ScoringIssueLabel;
  confidence?: ScoreConfidence;
  scoringVersion?: string;
  overallScoreMin?: ScoreValue;
  overallScoreMax?: ScoreValue;
  includeDeletedPromptLogs?: boolean;
}

/** Result of a save/saveMany operation. */
export interface PromptScoreSaveResult {
  saved_count: number;
  replaced_count: number;
}

/** Confidence values accepted by the schema. */
const CONFIDENCE_VALUES: readonly ScoreConfidence[] = ['low', 'medium', 'high'];

/** Banned full-answer field names that must never appear on a score object. */
const BANNED_ANSWER_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

/** Score dimension keys, used for range validation. */
const SCORE_KEYS = [
  'overall_score',
  'clarity_score',
  'context_score',
  'constraints_score',
  'output_format_score',
  'capability_fit_score',
  'efficiency_score',
  'safety_privacy_score',
] as const;

/** Explicit prompt_scores column select list (never selects prompt_text). */
const PROMPT_SCORE_COLUMNS = `
  ps.id, ps.prompt_log_id, ps.overall_score, ps.clarity_score, ps.context_score,
  ps.constraints_score, ps.output_format_score, ps.capability_fit_score,
  ps.efficiency_score, ps.safety_privacy_score, ps.confidence,
  ps.explanations_json, ps.scoring_version, ps.scored_at
`;

/** Raw prompt_scores row shape (subset relevant to PromptScore). */
interface PromptScoreRow {
  id: string;
  prompt_log_id: string;
  overall_score: number;
  clarity_score: number;
  context_score: number;
  constraints_score: number;
  output_format_score: number;
  capability_fit_score: number;
  efficiency_score: number;
  safety_privacy_score: number;
  confidence: string;
  explanations_json: string;
  scoring_version: string;
  scored_at: string;
}

const KNOWN_LABELS = new Set<string>(SCORING_ISSUE_LABELS);

function isInteger0to5(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export class PromptScoreRepository {
  constructor(private readonly db: SqliteDatabase) {}

  // --- Validation ---

  /** Validate a PromptScore before any SQL write. Throws content-free errors. */
  private validate(score: PromptScore): void {
    for (const key of SCORE_KEYS) {
      if (!isInteger0to5(score[key])) {
        throw new Error(`Invalid PromptScore: ${key} must be between 0 and 5.`);
      }
    }

    if (!CONFIDENCE_VALUES.includes(score.confidence)) {
      throw new Error('Invalid PromptScore: confidence must be low, medium, or high.');
    }

    if (!isNonEmptyString(score.id)) {
      throw new Error('Invalid PromptScore: id is required.');
    }
    if (!isNonEmptyString(score.prompt_log_id)) {
      throw new Error('Invalid PromptScore: prompt_log_id is required.');
    }
    if (!isNonEmptyString(score.scoring_version)) {
      throw new Error('Invalid PromptScore: scoring_version is required.');
    }
    if (!isNonEmptyString(score.scored_at)) {
      throw new Error('Invalid PromptScore: scored_at is required.');
    }

    if (!Array.isArray(score.issue_labels)) {
      throw new Error('Invalid PromptScore: issue_labels must be an array.');
    }
    for (const label of score.issue_labels) {
      if (!KNOWN_LABELS.has(label)) {
        throw new Error('Invalid PromptScore: unknown issue label.');
      }
    }

    if (
      !Array.isArray(score.explanations) ||
      !score.explanations.every((e) => typeof e === 'string')
    ) {
      throw new Error('Invalid PromptScore: explanations must be an array of strings.');
    }
    try {
      JSON.stringify(score.explanations);
    } catch {
      throw new Error('Invalid PromptScore: explanations must be JSON-serializable.');
    }

    const asRecord = score as unknown as Record<string, unknown>;
    for (const banned of BANNED_ANSWER_FIELDS) {
      if (asRecord[banned] !== undefined) {
        throw new Error('Invalid PromptScore: banned full-answer field present.');
      }
    }
  }

  // --- Save ---

  /** Persist a single PromptScore transactionally. */
  save(score: PromptScore): PromptScoreSaveResult {
    return this.saveMany([score]);
  }

  /**
   * Persist many PromptScores in one all-or-nothing transaction.
   * Replaces existing rows sharing (prompt_log_id, scoring_version).
   */
  saveMany(scores: readonly PromptScore[]): PromptScoreSaveResult {
    if (scores.length === 0) {
      return { saved_count: 0, replaced_count: 0 };
    }

    // Validate all before any write.
    for (const score of scores) {
      this.validate(score);
    }

    // Reject in-batch duplicates before writing.
    const seenIds = new Set<string>();
    const seenPairs = new Set<string>();
    for (const score of scores) {
      if (seenIds.has(score.id)) {
        throw new Error('Duplicate PromptScore id in batch.');
      }
      seenIds.add(score.id);

      const pair = `${score.prompt_log_id}\u0000${score.scoring_version}`;
      if (seenPairs.has(pair)) {
        throw new Error('Duplicate PromptScore in batch for prompt_log_id + scoring_version.');
      }
      seenPairs.add(pair);
    }

    const findExisting = this.db.prepare(
      'SELECT id FROM prompt_scores WHERE prompt_log_id = ? AND scoring_version = ?',
    );
    const deleteExisting = this.db.prepare('DELETE FROM prompt_scores WHERE id = ?');

    const runBatch = this.db.transaction((): PromptScoreSaveResult => {
      let saved = 0;
      let replaced = 0;

      for (const score of scores) {
        const existing = findExisting.get(score.prompt_log_id, score.scoring_version) as
          | { id: string }
          | undefined;

        if (existing) {
          // Delete old row; labels cascade-delete. Then insert incoming score.
          deleteExisting.run(existing.id);
          this.insertScore(score);
          replaced += 1;
        } else {
          this.insertScore(score);
          saved += 1;
        }
      }

      return { saved_count: saved, replaced_count: replaced };
    });

    try {
      return runBatch();
    } catch (error) {
      // Re-throw our own safe validation/duplicate errors as-is; wrap the rest.
      if (error instanceof Error && error.message.startsWith('Invalid PromptScore')) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Duplicate PromptScore')) {
        throw error;
      }
      throw new Error('Failed to persist prompt scores.');
    }
  }

  /** Insert one score row + its labels (explicit column mapping). */
  private insertScore(score: PromptScore): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO prompt_scores (
          id, prompt_log_id, overall_score, clarity_score, context_score,
          constraints_score, output_format_score, capability_fit_score,
          efficiency_score, safety_privacy_score, confidence, explanations_json,
          scoring_version, scored_at, created_at, updated_at,
          user_id, workspace_id, sync_status
        ) VALUES (
          @id, @prompt_log_id, @overall_score, @clarity_score, @context_score,
          @constraints_score, @output_format_score, @capability_fit_score,
          @efficiency_score, @safety_privacy_score, @confidence, @explanations_json,
          @scoring_version, @scored_at, @created_at, @updated_at,
          @user_id, @workspace_id, @sync_status
        )`,
      )
      .run({
        id: score.id,
        prompt_log_id: score.prompt_log_id,
        overall_score: score.overall_score,
        clarity_score: score.clarity_score,
        context_score: score.context_score,
        constraints_score: score.constraints_score,
        output_format_score: score.output_format_score,
        capability_fit_score: score.capability_fit_score,
        efficiency_score: score.efficiency_score,
        safety_privacy_score: score.safety_privacy_score,
        confidence: score.confidence,
        explanations_json: JSON.stringify(score.explanations),
        scoring_version: score.scoring_version,
        scored_at: score.scored_at,
        created_at: now,
        updated_at: now,
        user_id: null,
        workspace_id: null,
        sync_status: null,
      });

    this.insertLabels(score.id, score.issue_labels);
  }

  /** Insert normalized, deduped labels for a score. */
  private insertLabels(scoreId: string, labels: readonly ScoringIssueLabel[]): void {
    const ordered = dedupeIssueLabels(labels);
    if (ordered.length === 0) return;

    const stmt = this.db.prepare(
      'INSERT INTO prompt_score_labels (prompt_score_id, label) VALUES (?, ?)',
    );
    for (const label of ordered) {
      stmt.run(scoreId, label);
    }
  }

  // --- Read mapping ---

  /** Read tags/labels for a score, canonically ordered. */
  private getLabels(scoreId: string): ScoringIssueLabel[] {
    const rows = this.db
      .prepare('SELECT label FROM prompt_score_labels WHERE prompt_score_id = ?')
      .all(scoreId) as Array<{ label: string }>;
    const labels = rows
      .map((r) => r.label)
      .filter((l): l is ScoringIssueLabel => KNOWN_LABELS.has(l));
    return dedupeIssueLabels(labels);
  }

  /** Parse explanations_json safely; return [] on failure. */
  private parseExplanations(json: string): string[] {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.every((e) => typeof e === 'string')) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }

  /** Map a raw prompt_scores row + hydrated labels to a PromptScore. */
  private mapRowToScore(row: PromptScoreRow): PromptScore {
    return {
      id: row.id,
      prompt_log_id: row.prompt_log_id,
      overall_score: row.overall_score as ScoreValue,
      clarity_score: row.clarity_score as ScoreValue,
      context_score: row.context_score as ScoreValue,
      constraints_score: row.constraints_score as ScoreValue,
      output_format_score: row.output_format_score as ScoreValue,
      capability_fit_score: row.capability_fit_score as ScoreValue,
      efficiency_score: row.efficiency_score as ScoreValue,
      safety_privacy_score: row.safety_privacy_score as ScoreValue,
      issue_labels: this.getLabels(row.id),
      explanations: this.parseExplanations(row.explanations_json),
      confidence: row.confidence as ScoreConfidence,
      scoring_version: row.scoring_version,
      scored_at: row.scored_at,
    };
  }

  // --- Reads ---

  /** Read a score by its id. Excludes soft-deleted prompt logs by default. */
  getById(id: string): PromptScore | null {
    const row = this.db
      .prepare(
        `SELECT ${PROMPT_SCORE_COLUMNS}
         FROM prompt_scores ps
         JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
         WHERE ps.id = ? AND pl.deleted_at IS NULL`,
      )
      .get(id) as PromptScoreRow | undefined;
    return row ? this.mapRowToScore(row) : null;
  }

  /**
   * Read the latest or version-specific score for one prompt log.
   * Excludes soft-deleted prompt logs unless `includeDeletedPromptLog` is set.
   */
  getByPromptLogId(
    promptLogId: string,
    options?: { scoringVersion?: string; includeDeletedPromptLog?: boolean },
  ): PromptScore | null {
    const includeDeleted = options?.includeDeletedPromptLog ?? false;
    const deletedClause = includeDeleted ? '' : 'AND pl.deleted_at IS NULL';

    if (options?.scoringVersion !== undefined) {
      const row = this.db
        .prepare(
          `SELECT ${PROMPT_SCORE_COLUMNS}
           FROM prompt_scores ps
           JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
           WHERE ps.prompt_log_id = ? AND ps.scoring_version = ? ${deletedClause}`,
        )
        .get(promptLogId, options.scoringVersion) as PromptScoreRow | undefined;
      return row ? this.mapRowToScore(row) : null;
    }

    const row = this.db
      .prepare(
        `SELECT ${PROMPT_SCORE_COLUMNS}
         FROM prompt_scores ps
         JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
         WHERE ps.prompt_log_id = ? ${deletedClause}
         ORDER BY ps.scored_at DESC, ps.scoring_version DESC
         LIMIT 1`,
      )
      .get(promptLogId) as PromptScoreRow | undefined;
    return row ? this.mapRowToScore(row) : null;
  }

  /**
   * Read scores for multiple prompt log IDs, preserving caller order.
   * V1 delegates to getByPromptLogId per id and drops not-found entries.
   */
  getByPromptLogIds(
    promptLogIds: readonly string[],
    options?: { scoringVersion?: string; includeDeletedPromptLogs?: boolean },
  ): PromptScore[] {
    if (promptLogIds.length === 0) return [];

    const perOptions = {
      scoringVersion: options?.scoringVersion,
      includeDeletedPromptLog: options?.includeDeletedPromptLogs ?? false,
    };

    const result: PromptScore[] = [];
    for (const id of promptLogIds) {
      const score = this.getByPromptLogId(id, perOptions);
      if (score) result.push(score);
    }
    return result;
  }

  // --- Query / Filter / Aggregate ---

  /**
   * List PromptScores with bounded pagination and composable filters.
   *
   * Order: newest first (scored_at DESC, id DESC).
   * Filters compose via AND.
   * Excludes soft-deleted prompt logs by default; `includeDeletedPromptLogs` opts in.
   */
  list(options: PromptScoreListOptions): PromptScore[] {
    const { limit, offset } = normalizePagination(options);
    const includeDeleted = options.includeDeletedPromptLogs ?? false;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    // Always join prompt_logs for deleted_at filtering and import_batch_id support.
    // Select only PROMPT_SCORE_COLUMNS — never prompt_logs.prompt_text.
    if (!includeDeleted) {
      whereClauses.push('pl.deleted_at IS NULL');
    }

    if (options.promptLogId !== undefined) {
      whereClauses.push('ps.prompt_log_id = ?');
      params.push(options.promptLogId);
    }

    if (options.importBatchId !== undefined) {
      whereClauses.push('pl.import_batch_id = ?');
      params.push(options.importBatchId);
    }

    if (options.confidence !== undefined) {
      whereClauses.push('ps.confidence = ?');
      params.push(options.confidence);
    }

    if (options.scoringVersion !== undefined) {
      whereClauses.push('ps.scoring_version = ?');
      params.push(options.scoringVersion);
    }

    if (options.overallScoreMin !== undefined) {
      whereClauses.push('ps.overall_score >= ?');
      params.push(options.overallScoreMin);
    }

    if (options.overallScoreMax !== undefined) {
      whereClauses.push('ps.overall_score <= ?');
      params.push(options.overallScoreMax);
    }

    // Issue label filter requires joining prompt_score_labels.
    // Use EXISTS subquery to avoid duplicate rows when a score has multiple labels.
    let labelExistsClause = '';
    if (options.issueLabel !== undefined) {
      labelExistsClause = `
        AND EXISTS (
          SELECT 1 FROM prompt_score_labels psl
          WHERE psl.prompt_score_id = ps.id AND psl.label = ?
        )
      `;
      params.push(options.issueLabel);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT ${PROMPT_SCORE_COLUMNS}
      FROM prompt_scores ps
      JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
      ${whereClause}
      ${labelExistsClause}
      ORDER BY ps.scored_at DESC, ps.id DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as PromptScoreRow[];
    return rows.map((row) => this.mapRowToScore(row));
  }

  /**
   * Count PromptScores grouped by issue label.
   *
   * Returns typed { label, count } objects for known SCORING_ISSUE_LABELS only.
   * Supports optional importBatchId and scoringVersion filters.
   * Excludes soft-deleted prompt logs by default.
   */
  countByIssueLabel(
    options?: { importBatchId?: string; scoringVersion?: string },
  ): Array<{ label: ScoringIssueLabel; count: number }> {
    const whereClauses: string[] = ['pl.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (options?.importBatchId !== undefined) {
      whereClauses.push('pl.import_batch_id = ?');
      params.push(options.importBatchId);
    }

    if (options?.scoringVersion !== undefined) {
      whereClauses.push('ps.scoring_version = ?');
      params.push(options.scoringVersion);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT psl.label, COUNT(*) AS count
      FROM prompt_score_labels psl
      JOIN prompt_scores ps ON ps.id = psl.prompt_score_id
      JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
      ${whereClause}
      GROUP BY psl.label
      ORDER BY psl.label ASC
    `;

    const rows = this.db.prepare(sql).all(...params) as Array<{ label: string; count: number }>;

    // Filter to known labels and preserve canonical order.
    const knownSet = new Set<string>(SCORING_ISSUE_LABELS);
    const validRows = rows.filter((row) => knownSet.has(row.label));

    // Reorder to canonical SCORING_ISSUE_LABELS order.
    const labelOrder = SCORING_ISSUE_LABELS;
    const countsByLabel = new Map<string, number>();
    for (const row of validRows) {
      countsByLabel.set(row.label, row.count);
    }

    const result: Array<{ label: ScoringIssueLabel; count: number }> = [];
    for (const label of labelOrder) {
      const count = countsByLabel.get(label);
      if (count !== undefined) {
        result.push({ label, count });
      }
    }

    return result;
  }

  /**
   * Count PromptScores grouped by confidence.
   *
   * Returns typed { confidence, count } objects for known confidence values only.
   * Supports optional importBatchId and scoringVersion filters.
   * Excludes soft-deleted prompt logs by default.
   */
  countByConfidence(
    options?: { importBatchId?: string; scoringVersion?: string },
  ): Array<{ confidence: ScoreConfidence; count: number }> {
    const whereClauses: string[] = ['pl.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (options?.importBatchId !== undefined) {
      whereClauses.push('pl.import_batch_id = ?');
      params.push(options.importBatchId);
    }

    if (options?.scoringVersion !== undefined) {
      whereClauses.push('ps.scoring_version = ?');
      params.push(options.scoringVersion);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT ps.confidence, COUNT(*) AS count
      FROM prompt_scores ps
      JOIN prompt_logs pl ON pl.id = ps.prompt_log_id
      ${whereClause}
      GROUP BY ps.confidence
      ORDER BY ps.confidence ASC
    `;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      confidence: string;
      count: number;
    }>;

    // Filter to known confidence values and order as low, medium, high.
    const validRows = rows.filter(
      (row): row is { confidence: ScoreConfidence; count: number } =>
        CONFIDENCE_VALUES.includes(row.confidence as ScoreConfidence),
    );

    const confidenceOrder: ScoreConfidence[] = ['low', 'medium', 'high'];
    const countsByConfidence = new Map<ScoreConfidence, number>();
    for (const row of validRows) {
      countsByConfidence.set(row.confidence, row.count);
    }

    const result: Array<{ confidence: ScoreConfidence; count: number }> = [];
    for (const conf of confidenceOrder) {
      const count = countsByConfidence.get(conf);
      if (count !== undefined) {
        result.push({ confidence: conf, count });
      }
    }

    return result;
  }
}
