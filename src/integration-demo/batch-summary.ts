/**
 * cookedPrompts — Integration Demo Batch Summary
 *
 * Deterministic aggregate computation from prompt results.
 *
 * Privacy boundary:
 * - Never reads or copies prompt_text from any PromptResult.
 * - Never includes raw prompts, safety warning messages, rewrite guidance text,
 *   template bodies, or banned full-answer fields.
 * - Aggregates only: scores, issue label counts, safety severity counts,
 *   do_not_send_external boolean, model recommendation class.
 */

import type { PromptResult, BatchSummary, SafetyPostureSummary } from './types.js';

/**
 * Compute a batch-level summary from an array of prompt results.
 * Deterministic: same input → same output. No side effects. No network.
 */
export function computeBatchSummary(results: readonly PromptResult[]): BatchSummary {
  const total = results.length;
  const succeeded = results.filter((r) => !r.error).length;
  const failed = total - succeeded;

  // Score averages
  const scoredResults = results.filter((r) => r.score !== undefined);
  const average_overall_score =
    scoredResults.length > 0
      ? scoredResults.reduce((sum, r) => sum + r.score!.overall_score, 0) / scoredResults.length
      : null;

  const dimensions = [
    'clarity_score', 'context_score', 'constraints_score', 'output_format_score',
    'capability_fit_score', 'efficiency_score', 'safety_privacy_score',
  ] as const;

  const dimension_averages: Record<string, number | null> = {};
  for (const dim of dimensions) {
    const key = dim.replace('_score', '');
    const values = scoredResults.map((r) => r.score![dim] as number);
    dimension_averages[key] = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  // Issue label counts
  const issue_label_counts: Record<string, number> = {};
  for (const r of scoredResults) {
    for (const label of r.score!.issue_labels) {
      issue_label_counts[label] = (issue_label_counts[label] ?? 0) + 1;
    }
  }

  // Most common labels (desc frequency, alpha tiebreaker)
  const most_common_labels = Object.entries(issue_label_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);

  // Safety summary
  let prompts_with_warnings = 0;
  const severity_counts: Record<string, number> = {};
  let do_not_send_external_count = 0;

  for (const r of results) {
    if (r.do_not_send_external) {
      do_not_send_external_count += 1;
    }
    if (r.safety_result && r.safety_result.warnings.length > 0) {
      prompts_with_warnings += 1;
      for (const w of r.safety_result.warnings) {
        severity_counts[w.severity] = (severity_counts[w.severity] ?? 0) + 1;
      }
    }
  }

  const safety_summary: SafetyPostureSummary = {
    prompts_with_warnings,
    severity_counts,
    do_not_send_external_count,
  };

  // Model class distribution
  const model_class_distribution: Record<string, number> = {};
  for (const r of results) {
    if (r.model_recommendation) {
      const cls = r.model_recommendation.recommended_class;
      model_class_distribution[cls] = (model_class_distribution[cls] ?? 0) + 1;
    }
  }

  return {
    total_prompts: total,
    succeeded,
    failed,
    average_overall_score,
    dimension_averages,
    issue_label_counts,
    most_common_labels,
    safety_summary,
    model_class_distribution,
  };
}
