/**
 * cookedPrompts — Demo Report Renderer
 *
 * Main entry point: renderDemoReport(input, options?) → DemoReport.
 *
 * Pure function: no side effects, no I/O, no mutation, no network.
 * Deterministic: same input + same options → same output.
 * Privacy-safe: no prompt_text in report, no banned fields, no secrets.
 */

import type { UnifiedDemoOutput } from '../integration-demo/types.js';
import type { RenderOptions, DemoReport } from './types.js';
import {
  buildBatchOverview,
  buildPromptHealth,
  buildIssuePatterns,
  buildSafetyPrivacy,
  buildModelRecommendations,
  buildRewriteCoaching,
  buildNextActions,
  buildLimitations,
} from './section-builders.js';
import { renderReportMarkdown } from './markdown-renderer.js';
import { humanizeIssueLabel } from './coaching-copy.js';

/** Renderer version identifier. */
export const DEMO_REPORT_RENDERER_VERSION = 'demo-report-renderer-v1';

/** Default report title for the V1 demo theme. */
export const DEFAULT_DEMO_REPORT_TITLE =
  '20 Prompts Later: Your AI Habits Exposed';

/**
 * Render a structured coaching report from UnifiedDemoOutput.
 *
 * Never throws. Handles empty/partial/error input gracefully.
 * Never includes prompt_text in output (V1 privacy rule).
 */
export function renderDemoReport(
  input: UnifiedDemoOutput,
  options?: RenderOptions,
): DemoReport {
  // Apply defaults
  const includeMarkdown = options?.include_markdown !== false;
  const maxIssuePatterns = options?.max_issue_patterns ?? 10;
  const maxTemplates = options?.max_templates ?? 5;
  const maxActions = Math.max(options?.max_actions ?? 5, 3);
  const nowFn = options?.now ?? (() => new Date().toISOString());

  const generated_at = nowFn();
  const summary = input.batch_summary ?? {
    total_prompts: 0, succeeded: 0, failed: 0,
    average_overall_score: null, dimension_averages: {},
    issue_label_counts: {}, most_common_labels: [],
    safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 },
    model_class_distribution: {},
  };
  const metadata = input.metadata ?? {
    orchestrator_version: 'unknown', engines_used: {},
    pipeline_started_at: generated_at, pipeline_completed_at: generated_at,
    total_duration_ms: 0, input_source: 'unknown',
  };
  const promptResults = input.prompt_results ?? [];

  // Build all 8 sections in fixed order
  const sections = [
    buildBatchOverview(summary, metadata),
    buildPromptHealth(summary),
    buildIssuePatterns(summary, maxIssuePatterns),
    buildSafetyPrivacy(summary),
    buildModelRecommendations(summary),
    buildRewriteCoaching(promptResults, maxTemplates),
    buildNextActions(summary, promptResults, maxActions),
    buildLimitations(),
  ];

  // Build summary string (coaching-tone) using normalized summary
  const summaryText = buildSummaryText(summary, input.error);

  const report: DemoReport = {
    title: DEFAULT_DEMO_REPORT_TITLE,
    summary: summaryText,
    sections,
    generated_at,
    renderer_version: DEMO_REPORT_RENDERER_VERSION,
  };

  // Attach markdown if requested
  if (includeMarkdown) {
    report.markdown = renderReportMarkdown(report);
  }

  return report;
}

/**
 * Build a coaching-tone summary mentioning key stats.
 * Uses the normalized batch_summary (never reads raw input.batch_summary directly).
 */
function buildSummaryText(
  batch_summary: NonNullable<UnifiedDemoOutput['batch_summary']>,
  error?: string,
): string {
  const parts: string[] = [];

  if (error) {
    parts.push('The pipeline encountered an issue during processing.');
  }

  if (batch_summary.total_prompts === 0) {
    parts.push('No prompts were analyzed in this batch.');
    return parts.join(' ');
  }

  const successPct =
    batch_summary.total_prompts > 0
      ? Math.round(
          (batch_summary.succeeded / batch_summary.total_prompts) * 100,
        )
      : 0;

  parts.push(
    `Analyzed ${batch_summary.total_prompts} prompts with a ${successPct}% success rate.`,
  );

  if (batch_summary.average_overall_score !== null) {
    const avg = Math.round(batch_summary.average_overall_score * 100) / 100;
    parts.push(`Average prompt score: ${avg}/5.`);
  }

  if (batch_summary.safety_summary.prompts_with_warnings > 0) {
    parts.push(
      `${batch_summary.safety_summary.prompts_with_warnings} prompt${batch_summary.safety_summary.prompts_with_warnings === 1 ? '' : 's'} flagged with safety concerns.`,
    );
  }

  if (batch_summary.most_common_labels.length > 0) {
    const humanLabel = humanizeIssueLabel(batch_summary.most_common_labels[0]);
    parts.push(`Most common issue: ${humanLabel}.`);
  }

  // Coaching hook based on aggregate data
  if (batch_summary.most_common_labels.length > 0) {
    const humanLabel = humanizeIssueLabel(batch_summary.most_common_labels[0]);
    parts.push(`Biggest coaching opportunity: ${humanLabel}.`);
  } else if (
    batch_summary.average_overall_score !== null &&
    batch_summary.average_overall_score < 3
  ) {
    parts.push('Your prompts need stronger structure before they scale.');
  } else if (
    batch_summary.average_overall_score !== null &&
    batch_summary.average_overall_score >= 4 &&
    batch_summary.safety_summary.prompts_with_warnings === 0
  ) {
    parts.push('Solid habits overall — now tighten the weak spots.');
  }

  return parts.join(' ');
}
