/**
 * cookedPrompts — Demo Report Renderer Data Contracts
 *
 * Pure renderer types for transforming UnifiedDemoOutput into a structured
 * coaching report with optional markdown.
 *
 * Privacy boundary:
 * - No raw prompt_text field in any report output type.
 * - Prompt examples, when present, must be redacted/masked before display.
 * - No banned full-answer fields at any level.
 * - include_prompt_text remains accepted in RenderOptions for compatibility.
 * - No matched secrets, no stack traces, no raw errors.
 *
 * Pure renderer:
 * - No I/O, no network, no mutation, no file writing.
 * - No scoring/safety/model-rec/rewrite engine imports.
 * - Consumes UnifiedDemoOutput only.
 */

/** Render configuration options. */
export interface RenderOptions {
  /** Include markdown string in DemoReport. Default: true. */
  include_markdown?: boolean;
  /**
   * Include prompt_text in report.
   * V1: accepted but IGNORED for privacy. Report never contains raw prompt_text.
   */
  include_prompt_text?: boolean;
  /** Injectable clock for deterministic timestamps. */
  now?: () => string;
  /** Maximum issue patterns shown. Default: 10. */
  max_issue_patterns?: number;
  /** Maximum templates shown. Default: 5. */
  max_templates?: number;
  /** Maximum next actions shown. Default: 5, min 3. */
  max_actions?: number;
  /** Maximum prompt examples shown. Default: 3. */
  max_prompt_examples?: number;
  /** Report theme. */
  theme?: 'twenty_prompts_later';
}

/** Section kind identifiers in fixed order. */
export type ReportSectionKind =
  | 'batch_verdict'
  | 'prompt_habit_score'
  | 'category_scorecard'
  | 'issue_patterns'
  | 'prompt_examples'
  | 'roast_of_the_batch'
  | 'copy_worthy_prompt'
  | 'model_waste'
  | 'safety_privacy'
  | 'safety_privacy_lessons'
  | 'model_recommendations'
  | 'rewrite_coaching'
  | 'next_actions'
  | 'limitations';

export type ScoreBand = 'Poor' | 'Okay' | 'Good' | 'Excellent';

export interface CategoryScore100 {
  category: string;
  score_100: number | null;
  score_band: ScoreBand | null;
  coaching_note?: string;
}

/** A redacted coaching example derived from a single prompt. */
export interface PromptExampleCard {
  prompt_excerpt: string;
  overall_score_100: number | null;
  score_band: ScoreBand | null;
  top_issue_labels: string[];
  what_went_wrong: string;
  why_it_matters: string;
  habit_to_build: string;
  improved_prompt: string;
  why_it_works: string;
}

export interface RiskCategoryCount {
  category: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/** A single displayable metric within a report section. */
export interface ReportMetric {
  label: string;
  value: string | number | null;
  unit?: string;
}

/** A structured report section. */
export interface ReportSection {
  kind: ReportSectionKind;
  heading: string;
  summary?: string;
  metrics?: ReportMetric[];
  items?: string[];
  coaching_notes?: string[];
  overall_score_100?: number | null;
  score_band?: ScoreBand | null;
  category_scores_100?: CategoryScore100[];
  prompt_example_cards?: PromptExampleCard[];
  prompt_excerpt?: string;
  improved_prompt?: string;
  roast_line?: string;
  coaching_reason?: string;
  target_issue?: string;
  why_it_works?: string;
  copy_pattern?: string;
  overkill_count?: number;
  underfit_count?: number;
  teaching_points?: string[];
  example_hints?: string[];
  coaching_summary?: string;
  risk_category_counts?: RiskCategoryCount[];
  lesson_items?: string[];
  placeholder_examples?: string[];
  redacted_prompt_hint?: string;
}

/** A prioritized coaching action derived from batch patterns. */
export interface CoachingAction {
  priority: number;
  action: string;
  source: string;
}

/**
 * The complete demo report output.
 * Contains no prompt_text, no banned fields, no matched secrets.
 */
export interface DemoReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  generated_at: string;
  renderer_version: string;
  markdown?: string;
}
