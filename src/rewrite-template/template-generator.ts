/**
 * cookedPrompts — Template Generator
 *
 * Deterministic template selection logic.
 * Matches input issue labels to catalog templates, preferring templates
 * that cover more of the input's weaknesses. Max 3 templates returned.
 *
 * Privacy: no prompt_text, no secrets, no banned fields in output.
 * No network, no cloud, no LLM, no provider calls.
 */

import type { RewriteInput, TemplateSuggestion, RewriteEngineOptions } from './types.js';
import type { ScoringIssueLabel } from '../scoring/types.js';
import { TEMPLATE_CATALOG, TEMPLATE_GENERATOR_VERSION } from './template-catalog.js';

const MAX_TEMPLATES = 3;

export { TEMPLATE_GENERATOR_VERSION };

/**
 * Generate template suggestions based on identified prompt weaknesses.
 *
 * Selection priority:
 * 1. Templates matching the most input issue labels (multi-label preference).
 * 2. Stable catalog order as tiebreaker.
 * 3. Max 3 templates returned.
 *
 * Returns empty suggested_templates when no issue labels are present.
 */
export function generateTemplateSuggestion(
  input: RewriteInput,
  options?: RewriteEngineOptions,
): TemplateSuggestion {
  const now = options?.now ?? (() => new Date().toISOString());
  const issueLabels = input.prompt_score.issue_labels;

  // If no issue labels, return empty suggestion
  if (issueLabels.length === 0) {
    return {
      prompt_log_id: input.prompt_score.prompt_log_id,
      suggested_templates: [],
      generator_version: TEMPLATE_GENERATOR_VERSION,
      created_at: now(),
    };
  }

  // Score each template by how many input issue labels it matches
  const scored = TEMPLATE_CATALOG.map((template, index) => {
    const matchCount = template.applicable_issue_labels.filter((label) =>
      issueLabels.includes(label as ScoringIssueLabel),
    ).length;
    return { template, matchCount, index };
  }).filter((entry) => entry.matchCount > 0);

  // Sort: most matches first, then stable catalog order
  scored.sort((a, b) => {
    if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
    return a.index - b.index;
  });

  // Take top MAX_TEMPLATES
  const selected = scored.slice(0, MAX_TEMPLATES).map((s) => s.template);

  return {
    prompt_log_id: input.prompt_score.prompt_log_id,
    suggested_templates: selected,
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: now(),
  };
}
