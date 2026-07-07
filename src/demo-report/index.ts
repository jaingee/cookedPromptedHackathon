/**
 * cookedPrompts — Demo Report Renderer Module Boundary
 *
 * Public exports for the local deterministic coaching report renderer.
 *
 * Pure renderer: no I/O, no network, no mutation, no engine imports.
 */

export type {
  RenderOptions,
  ReportSectionKind,
  ReportMetric,
  ReportSection,
  CoachingAction,
  ScoreBand,
  CategoryScore100,
  PromptExampleCard,
  DemoReport,
} from './types.js';

export {
  DEMO_REPORT_RENDERER_VERSION,
  DEFAULT_DEMO_REPORT_TITLE,
  renderDemoReport,
} from './report-renderer.js';

export { renderReportMarkdown } from './markdown-renderer.js';

export type {
  RedactionPlaceholder,
  RedactionResult,
  RedactedExcerptOptions,
  RedactedExcerptResult,
} from './redaction.js';
export {
  PROMPT_EXCERPT_WITHHELD,
  REDACTION_PLACEHOLDERS,
  redactPromptForReport,
  buildRedactedExcerpt,
} from './redaction.js';
