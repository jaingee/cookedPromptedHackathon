/**
 * cookedPrompts — Scoring Core Types
 *
 * Shared type contracts for the deterministic local prompt scoring engine
 * (see .kiro/specs/03-scoring-engine/design.md).
 *
 * No implementation logic lives here — only type definitions.
 * Local-first: no network, no cloud, no telemetry, no LLM judge.
 */

import type { PromptLogEntry } from '../importers/local/types.js';

/** A 0–5 integer score. 0 = unusable/missing/risky, 5 = excellent. */
export type ScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

/** Coarse, dashboard-friendly reliability indicator for a score. */
export type ScoreConfidence = 'low' | 'medium' | 'high';

/**
 * Stable issue labels describing detected prompt weaknesses or risks.
 * Consumers must not assume this set is fixed; it may grow in future versions.
 */
export type ScoringIssueLabel =
  | 'missing_context'
  | 'unclear_task'
  | 'missing_constraints'
  | 'missing_output_format'
  | 'overbroad_prompt'
  | 'privacy_risk'
  | 'possible_secret'
  | 'wrong_model_class'
  | 'overpowered_model'
  | 'needs_search'
  | 'needs_tool_use'
  | 'too_long_for_task';

/** Vendor-neutral model capability classes (no provider/model names). */
export type CapabilityClass =
  | 'cheap_fast'
  | 'general_purpose'
  | 'coding'
  | 'deep_reasoning'
  | 'long_context'
  | 'tool_using'
  | 'search_required'
  | 'multimodal'
  | 'privacy_sensitive_local';

/**
 * The public scoring output for a single prompt log.
 *
 * References the source prompt via `prompt_log_id`; never copies prompt text.
 * Must never include full model answer content or banned full-answer fields.
 */
export interface PromptScore {
  id: string;
  prompt_log_id: string;
  overall_score: ScoreValue;
  clarity_score: ScoreValue;
  context_score: ScoreValue;
  constraints_score: ScoreValue;
  output_format_score: ScoreValue;
  capability_fit_score: ScoreValue;
  efficiency_score: ScoreValue;
  safety_privacy_score: ScoreValue;
  issue_labels: ScoringIssueLabel[];
  explanations: string[];
  confidence: ScoreConfidence;
  scoring_version: string;
  scored_at: string; // ISO 8601, from injectable clock
}

/** Injectable clock so `scored_at` is deterministic in tests. */
export interface Clock {
  now(): string; // ISO 8601 string
}

/** Options for a scoring call. Both are injectable for deterministic tests. */
export interface ScoringOptions {
  /**
   * Injectable clock for deterministic `scored_at` in tests.
   * Defaults to defaultClock (system time).
   */
  clock?: Clock;

  /**
   * Injectable id generator for deterministic PromptScore IDs in tests.
   * Defaults to defaultIdFactory (local UUID-style).
   */
  idFactory?: () => string;
}

/** Configuration for the optional scoring engine wrapper. */
export type ScoringConfig = ScoringOptions;

/** Optional convenience wrapper interface (implemented in Wave 3). */
export interface ScoringEngine {
  score(entry: PromptLogEntry): PromptScore;
  scoreMany(entries: PromptLogEntry[]): PromptScore[];
}

/**
 * Result produced by a single dimension scorer (internal to the pipeline,
 * exported for use by future scoring modules).
 */
export interface DimensionResult {
  score: ScoreValue;
  labels: ScoringIssueLabel[];
  explanations: string[];
}

/**
 * Reusable derived facts computed once from a PromptLogEntry and shared
 * across dimension scorers (internal to the pipeline).
 *
 * PRIVACY: `lowered` is an internal, in-memory-only derived form of the
 * prompt text used by dimension rules. It MUST never be exported from public
 * scoring output (PromptScore), logged, persisted, or intentionally
 * serialized. Keep it strictly inside the scoring pipeline.
 */
export interface PromptSignals {
  length: number;
  lowered: string; // INTERNAL ONLY — never log, persist, or serialize.
  hasFormatMarker: boolean;
  hasConstraintMarker: boolean;
  hasContextMarker: boolean;
  vagueTaskOnly: boolean;
  requiredCapabilities: CapabilityClass[];
  hasModelMetadata: boolean;
  hasUsageMetadata: boolean;
}
