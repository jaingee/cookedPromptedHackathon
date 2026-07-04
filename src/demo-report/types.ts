/**
 * cookedPrompts — Demo Report Renderer Data Contracts
 *
 * Pure renderer types for transforming UnifiedDemoOutput into a structured
 * coaching report with optional markdown.
 *
 * Privacy boundary:
 * - No prompt_text field in any report output type.
 * - No banned full-answer fields at any level.
 * - V1: include_prompt_text is accepted in RenderOptions but IGNORED.
 * - Report uses aggregate data only (counts, labels, averages).
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
  /** Report theme. */
  theme?: 'twenty_prompts_later';
}

/** Section kind identifiers in fixed order. */
export type ReportSectionKind =
  | 'batch_overview'
  | 'prompt_health'
  | 'issue_patterns'
  | 'safety_privacy'
  | 'model_recommendations'
  | 'rewrite_coaching'
  | 'next_actions'
  | 'limitations';

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
