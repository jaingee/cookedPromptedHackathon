/**
 * cookedPrompts — Integration Demo Flow Data Contracts
 *
 * Local-first orchestration types for the V1 demo pipeline.
 *
 * Privacy boundary:
 * - prompt_text appears only as an optional field on PromptResult when explicitly requested.
 * - BatchSummary and PipelineMetadata never contain prompt_text.
 * - No banned full-answer fields at any level.
 * - No matched secret substrings.
 * - Errors are content-free (no prompt text, stack traces, or secrets).
 */

import type { PromptLogEntry } from '../importers/local/types.js';
import type { ImportSourceType } from '../importers/local/controller/index.js';
import type { PromptScore } from '../scoring/types.js';
import type { SafetyScanResult } from '../safety/types.js';
import type { ModelRecommendation, UserModelConstraints } from '../model-recommendation/types.js';
import type { RewriteSuggestion, TemplateSuggestion } from '../rewrite-template/types.js';

/** Pipeline step names for error reporting. */
export type PipelineStep =
  | 'store'
  | 'score'
  | 'persist_score'
  | 'safety'
  | 'model_recommendation'
  | 'rewrite'
  | 'template';

/** Input modes for the demo orchestrator. */
export type DemoInput =
  | { mode: 'demo' }
  | { mode: 'file'; file_path: string; source_type: ImportSourceType }
  | { mode: 'entries'; entries: PromptLogEntry[] };

/** Injectable options for deterministic pipeline execution. */
export interface PipelineOptions {
  include_prompt_text?: boolean;
  now?: () => string;
  idFactory?: () => string;
  database_path?: string;
  user_model_constraints?: UserModelConstraints;
}

/** Per-prompt result. prompt_text included only when explicitly requested. */
export interface PromptResult {
  prompt_log_id: string;
  do_not_send_external: boolean;
  prompt_text?: string;
  score?: PromptScore;
  safety_result?: SafetyScanResult;
  model_recommendation?: ModelRecommendation;
  rewrite_suggestion?: RewriteSuggestion;
  template_suggestion?: TemplateSuggestion;
  error?: string;
  failed_step?: PipelineStep;
}

/** Safety summary within BatchSummary. */
export interface SafetyPostureSummary {
  prompts_with_warnings: number;
  severity_counts: Record<string, number>;
  do_not_send_external_count: number;
}

/** Batch-level aggregate summary. Never contains prompt_text or secrets. */
export interface BatchSummary {
  total_prompts: number;
  succeeded: number;
  failed: number;
  average_overall_score: number | null;
  dimension_averages: Record<string, number | null>;
  issue_label_counts: Record<string, number>;
  most_common_labels: string[];
  safety_summary: SafetyPostureSummary;
  model_class_distribution: Record<string, number>;
}

/** Pipeline run metadata. */
export interface PipelineMetadata {
  orchestrator_version: string;
  engines_used: Record<string, string>;
  pipeline_started_at: string;
  pipeline_completed_at: string;
  total_duration_ms: number;
  input_source: string;
}

/** Complete unified output from the demo pipeline. */
export interface UnifiedDemoOutput {
  prompt_results: PromptResult[];
  batch_summary: BatchSummary;
  metadata: PipelineMetadata;
  error?: string;
}
