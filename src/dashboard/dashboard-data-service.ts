/**
 * cookedPrompts — Dashboard Data Service
 *
 * Wraps PromptScoreRepository and PromptLogRepository to provide typed,
 * privacy-safe dashboard views. Constructor injection.
 *
 * PRIVACY:
 * - Overview/list/aggregate methods never access prompt_text.
 * - Detail view loads prompt_text via PromptLogRepository for local display only.
 * - No banned full-answer fields in any output.
 * - No network calls, no cloud, no telemetry.
 *
 * Repository access note:
 * V1 dashboard uses existing score repository list/count/get methods.
 * Prompt log access is restricted to metadata mapping for list/detail contexts.
 * Aggregates do not require prompt_text.
 * No new repository methods are required.
 *
 * - Total scored: computed from sum of confidence counts.
 * - Average overall score: computed from paged list() results.
 * - Needs-action count: computed from paged list() results (overall_score <= 2).
 * - Dimension summary: computed in-memory from paged list() results.
 * - Prompt metadata: read via PromptLogRepository.getById(), mapped to DashboardPromptMetadata.
 */

import type { PromptScore, ScoreConfidence, ScoreValue, ScoringIssueLabel } from '../scoring/types.js';
import type { PromptScoreRepository, PromptScoreListOptions } from '../storage/sqlite/repositories/prompt-score-repository.js';
import type { PromptLogRepository } from '../storage/sqlite/repositories/prompt-log-repository.js';
import type {
  ConfidenceCount,
  DashboardFilterOptions,
  DashboardOverview,
  DashboardPromptMetadata,
  DashboardScoreDetail,
  DashboardScoreListItem,
  IssueLabelCount,
  ScoreDimensionSummary,
} from './types.js';

/** Internal page size for fetching all scores. */
const PAGE_SIZE = 1000;

/** The 8 score dimensions in stable order. */
const SCORE_DIMENSIONS: ReadonlyArray<keyof PromptScore & string> = [
  'overall_score',
  'clarity_score',
  'context_score',
  'constraints_score',
  'output_format_score',
  'capability_fit_score',
  'efficiency_score',
  'safety_privacy_score',
];

export class DashboardDataService {
  private readonly scoreRepo: PromptScoreRepository;
  private readonly logRepo: PromptLogRepository;

  constructor(scoreRepo: PromptScoreRepository, logRepo: PromptLogRepository) {
    this.scoreRepo = scoreRepo;
    this.logRepo = logRepo;
  }

  // --- Private helpers ---

  /** Round to one decimal place. Returns 0 for NaN/Infinity. */
  private roundOneDecimal(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10) / 10;
  }

  /**
   * Read prompt log metadata safely. Returns DashboardPromptMetadata or null.
   * Strips prompt_text immediately — never returns it in metadata context.
   * No object spread; explicit field mapping only.
   */
  private getPromptMetadata(promptLogId: string): DashboardPromptMetadata | null {
    const entry = this.logRepo.getById(promptLogId);
    if (!entry) return null;

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      source: entry.source,
      provider: entry.provider,
      model_used: entry.model_used,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      total_tokens: entry.total_tokens,
      estimated_cost: entry.estimated_cost,
      latency_ms: entry.latency_ms,
      tags: entry.tags,
    };
  }

  /**
   * Fetch all matching scores using paged list() calls.
   * Does not access prompt_text. Stops when a page has fewer results than PAGE_SIZE.
   * Supports an optional maxScores limit.
   */
  private listAllScores(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
    confidence?: ScoreConfidence;
    issueLabel?: ScoringIssueLabel;
    overallScoreMin?: ScoreValue;
    overallScoreMax?: ScoreValue;
    includeDeletedPromptLogs?: boolean;
    limit?: number;
  }): PromptScore[] {
    const maxScores = filters?.limit;
    const allScores: PromptScore[] = [];
    let offset = 0;

    while (true) {
      const options: PromptScoreListOptions = {
        limit: PAGE_SIZE,
        offset,
        importBatchId: filters?.importBatchId,
        scoringVersion: filters?.scoringVersion,
        confidence: filters?.confidence,
        issueLabel: filters?.issueLabel,
        overallScoreMin: filters?.overallScoreMin,
        overallScoreMax: filters?.overallScoreMax,
        includeDeletedPromptLogs: filters?.includeDeletedPromptLogs,
      };

      const page = this.scoreRepo.list(options);
      allScores.push(...page);

      // Stop if caller limit reached.
      if (maxScores !== undefined && allScores.length >= maxScores) {
        return allScores.slice(0, maxScores);
      }

      // Stop if page was not full (no more rows).
      if (page.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }

    return maxScores !== undefined ? allScores.slice(0, maxScores) : allScores;
  }

  /**
   * Convert DashboardFilterOptions to PromptScoreListOptions.
   */
  private toScoreListOptions(options: DashboardFilterOptions): PromptScoreListOptions {
    return {
      limit: options.limit,
      offset: options.offset,
      promptLogId: undefined,
      importBatchId: options.importBatchId,
      issueLabel: options.issueLabel,
      confidence: options.confidence,
      scoringVersion: options.scoringVersion,
      overallScoreMin: options.overallScoreMin,
      overallScoreMax: options.overallScoreMax,
      includeDeletedPromptLogs: options.includeDeletedPromptLogs,
    };
  }

  // --- Public methods ---

  /** Get overview card data. Optionally filtered by batch/version. */
  getOverview(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): DashboardOverview {
    // Confidence counts give us total_scored and low_confidence_count.
    const confidenceCounts = this.getConfidenceCounts(filters);
    const total_scored = confidenceCounts.reduce((sum, c) => sum + c.count, 0);
    const lowEntry = confidenceCounts.find((c) => c.confidence === 'low');
    const low_confidence_count = lowEntry?.count ?? 0;

    // Issue label counts for most_common_label.
    const labelCounts = this.getIssueLabelCounts(filters);
    let most_common_label: ScoringIssueLabel | null = null;
    if (labelCounts.length > 0) {
      let maxCount = 0;
      for (const lc of labelCounts) {
        if (lc.count > maxCount) {
          maxCount = lc.count;
          most_common_label = lc.label;
        }
      }
    }

    // Fetch all scores for average and needs-action.
    if (total_scored === 0) {
      return {
        total_scored: 0,
        average_overall_score: 0,
        low_confidence_count: 0,
        needs_action_count: 0,
        most_common_label,
      };
    }

    const allScores = this.listAllScores({
      importBatchId: filters?.importBatchId,
      scoringVersion: filters?.scoringVersion,
    });

    let overallSum = 0;
    let needsAction = 0;
    for (const score of allScores) {
      overallSum += score.overall_score;
      if (score.overall_score <= 2) {
        needsAction += 1;
      }
    }

    const average_overall_score = this.roundOneDecimal(overallSum / allScores.length);

    return {
      total_scored,
      average_overall_score,
      low_confidence_count,
      needs_action_count: needsAction,
      most_common_label,
    };
  }

  /** List scored prompts with filters and pagination. */
  listScores(options: DashboardFilterOptions): DashboardScoreListItem[] {
    const listOptions = this.toScoreListOptions(options);
    const scores = this.scoreRepo.list(listOptions);

    return scores.map((score): DashboardScoreListItem => {
      const metadata = this.getPromptMetadata(score.prompt_log_id);

      return {
        score_id: score.id,
        prompt_log_id: score.prompt_log_id,
        timestamp: metadata?.timestamp ?? null,
        source: metadata?.source ?? null,
        provider: metadata?.provider ?? null,
        model_used: metadata?.model_used ?? null,
        overall_score: score.overall_score,
        confidence: score.confidence,
        issue_labels: score.issue_labels,
        scoring_version: score.scoring_version,
        scored_at: score.scored_at,
      };
    });
  }

  /** Get full detail for one score (including prompt text for local display). */
  getScoreDetail(scoreId: string): DashboardScoreDetail | null {
    const score = this.scoreRepo.getById(scoreId);
    if (!score) return null;

    const entry = this.logRepo.getById(score.prompt_log_id);

    if (!entry) {
      return {
        score,
        prompt_metadata: null,
        prompt_text: null,
      };
    }

    const prompt_metadata: DashboardPromptMetadata = {
      id: entry.id,
      timestamp: entry.timestamp,
      source: entry.source,
      provider: entry.provider,
      model_used: entry.model_used,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      total_tokens: entry.total_tokens,
      estimated_cost: entry.estimated_cost,
      latency_ms: entry.latency_ms,
      tags: entry.tags,
    };

    return {
      score,
      prompt_metadata,
      prompt_text: entry.prompt_text,
    };
  }

  /** Get issue label counts, optionally filtered. */
  getIssueLabelCounts(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): IssueLabelCount[] {
    return this.scoreRepo.countByIssueLabel(filters);
  }

  /** Get confidence level counts, optionally filtered. */
  getConfidenceCounts(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): ConfidenceCount[] {
    return this.scoreRepo.countByConfidence(filters);
  }

  /** Get per-dimension average summary, optionally filtered. */
  getDimensionSummary(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
    limit?: number;
  }): ScoreDimensionSummary[] {
    const allScores = this.listAllScores({
      importBatchId: filters?.importBatchId,
      scoringVersion: filters?.scoringVersion,
      limit: filters?.limit,
    });

    const count = allScores.length;

    return SCORE_DIMENSIONS.map((dimension): ScoreDimensionSummary => {
      if (count === 0) {
        return { dimension, average_score: 0, low_count: 0 };
      }

      let sum = 0;
      let lowCount = 0;
      for (const score of allScores) {
        const value = score[dimension] as number;
        sum += value;
        if (value <= 2) {
          lowCount += 1;
        }
      }

      return {
        dimension,
        average_score: this.roundOneDecimal(sum / count),
        low_count: lowCount,
      };
    });
  }
}
