/**
 * cookedPrompts — Dashboard Data Types
 *
 * Typed contracts for all dashboard views. Privacy by shape:
 * - Overview/list/aggregate DTOs never include prompt_text.
 * - prompt_text appears only in DashboardScoreDetail for local detail display.
 * - No banned full-answer fields in any DTO.
 *
 * Local-first: no network, no cloud, no telemetry, no LLM judge.
 */

import type {
  PromptScore,
  ScoreConfidence,
  ScoreValue,
  ScoringIssueLabel,
} from '../scoring/types.js';

/** Overview card data for the dashboard landing. */
export interface DashboardOverview {
  total_scored: number;
  average_overall_score: number; // 0–5, one decimal
  low_confidence_count: number;
  needs_action_count: number; // overall_score <= 2
  most_common_label: ScoringIssueLabel | null;
}

/** One item in the scored prompt list. No prompt_text. */
export interface DashboardScoreListItem {
  score_id: string;
  prompt_log_id: string;
  timestamp: string | null;
  source: string | null;
  provider: string | null;
  model_used: string | null;
  overall_score: ScoreValue;
  confidence: ScoreConfidence;
  issue_labels: ScoringIssueLabel[];
  scoring_version: string;
  scored_at: string;
}

/** Prompt metadata for detail view (no prompt_text, no banned fields). */
export interface DashboardPromptMetadata {
  id: string;
  timestamp: string;
  source: string;
  provider: string;
  model_used: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  tags: string[];
}

/** Full detail for a single scored prompt. prompt_text for local display only. */
export interface DashboardScoreDetail {
  score: PromptScore;
  prompt_metadata: DashboardPromptMetadata | null;
  /** Prompt text loaded separately for local display only. Null if prompt log not found. */
  prompt_text: string | null;
}

/** Filter options for list and aggregate queries. */
export interface DashboardFilterOptions {
  importBatchId?: string;
  scoringVersion?: string;
  confidence?: ScoreConfidence;
  issueLabel?: ScoringIssueLabel;
  overallScoreMin?: ScoreValue;
  overallScoreMax?: ScoreValue;
  includeDeletedPromptLogs?: boolean;
  limit: number;
  offset?: number;
}

/** Issue label with its count. */
export interface IssueLabelCount {
  label: ScoringIssueLabel;
  count: number;
}

/** Confidence level with its count. */
export interface ConfidenceCount {
  confidence: ScoreConfidence;
  count: number;
}

/** Per-dimension average summary. */
export interface ScoreDimensionSummary {
  dimension: string;
  average_score: number; // 0–5, one decimal
  low_count: number; // scores 0–2
}
