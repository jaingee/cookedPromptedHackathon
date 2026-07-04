/**
 * cookedPrompts — Scoring Issue Label Constants
 *
 * Stable, documented issue labels emitted by dimension scorers.
 * The ordering here is the canonical output order for deduped labels.
 *
 * No prompt text, no network, no storage, no LLM.
 */

import type { ScoringIssueLabel } from '../types.js';

/**
 * Canonical, stable-ordered list of all issue labels.
 * Dedupe and output ordering follow this array.
 */
export const SCORING_ISSUE_LABELS = [
  'missing_context',
  'unclear_task',
  'missing_constraints',
  'missing_output_format',
  'overbroad_prompt',
  'privacy_risk',
  'possible_secret',
  'wrong_model_class',
  'overpowered_model',
  'needs_search',
  'needs_tool_use',
  'too_long_for_task',
] as const satisfies readonly ScoringIssueLabel[];

/**
 * Return the provided labels deduped and in the stable canonical order
 * defined by SCORING_ISSUE_LABELS.
 */
export function dedupeIssueLabels(
  labels: readonly ScoringIssueLabel[],
): ScoringIssueLabel[] {
  const present = new Set(labels);
  return SCORING_ISSUE_LABELS.filter((label) => present.has(label));
}
