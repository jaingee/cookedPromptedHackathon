/**
 * cookedPrompts — Rewrite/Template System Data Contracts
 *
 * Local-first, deterministic, rule-based coaching guidance contracts.
 *
 * Privacy boundary:
 * - `prompt_text` exists only on `RewriteInput` for local in-memory processing.
 * - `prompt_text` MUST NOT appear in any output type (RewriteSuggestion,
 *   GuidanceItem, PromptTemplate, TemplateSuggestion).
 * - No matched secret substrings in output.
 * - No model answers or banned full-answer fields in any type.
 * - No network, no cloud, no telemetry, no provider calls.
 */

import type { PromptScore, ScoringIssueLabel } from '../scoring/types.js';
import type { SafetyScanResult } from '../safety/types.js';
import type { ModelRecommendation } from '../model-recommendation/types.js';

/** Severity for guidance items. */
export type GuidanceSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Scoring dimension that a guidance item relates to. */
export type GuidanceDimension =
  | 'clarity'
  | 'context'
  | 'constraints'
  | 'output_format'
  | 'capability_fit'
  | 'efficiency'
  | 'safety_privacy';

/** Template category tags. */
export type TemplateCategoryTag =
  | 'coding'
  | 'writing'
  | 'analysis'
  | 'research'
  | 'creative'
  | 'data'
  | 'communication'
  | 'general';

/**
 * Input to the rewrite engine.
 *
 * PRIVACY: `prompt_text` is accepted for local in-memory inspection only.
 * It MUST NOT be serialized into any output object.
 */
export interface RewriteInput {
  prompt_score: PromptScore;
  prompt_text: string;
  safety_result?: SafetyScanResult;
  model_recommendation?: ModelRecommendation;
}

/**
 * A single actionable coaching guidance item.
 *
 * Contains no prompt_text, no matched secrets, no banned full-answer fields.
 * `example_before`/`example_after` use generic placeholder text only.
 */
export interface GuidanceItem {
  id: string;
  issue_label?: ScoringIssueLabel;
  dimension: GuidanceDimension;
  severity: GuidanceSeverity;
  priority: number;
  action: 'add' | 'remove' | 'change' | 'review';
  explanation: string;
  example_before?: string;
  example_after?: string;
}

/**
 * The full rewrite suggestion output.
 *
 * Contains no prompt_text, no model answers, no banned full-answer fields.
 */
export interface RewriteSuggestion {
  prompt_log_id: string;
  guidance_items: GuidanceItem[];
  overall_severity: GuidanceSeverity;
  overall_priority: number;
  summary: string;
  engine_version: string;
  created_at: string;
}

/**
 * A reusable, generic, privacy-safe prompt template.
 *
 * `template_body` contains bracket placeholders only — never prompt text or secrets.
 */
export interface PromptTemplate {
  template_id: string;
  template_name: string;
  template_body: string;
  category_tags: TemplateCategoryTag[];
  applicable_issue_labels: ScoringIssueLabel[];
  description: string;
  generator_version: string;
  created_at: string;
}

/** Template suggestion output. */
export interface TemplateSuggestion {
  prompt_log_id: string;
  suggested_templates: PromptTemplate[];
  generator_version: string;
  created_at: string;
}

/** Options for deterministic testing (injectable clock and ID factory). */
export interface RewriteEngineOptions {
  now?: () => string;
  idFactory?: () => string;
}
