/**
 * cookedPrompts — Constraints Dimension Scorer
 *
 * Deterministic, pure. Judges whether the prompt sets useful boundaries
 * (length, tone, audience, scope) and flags overbroad requests.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type {
  DimensionResult,
  PromptSignals,
  ScoringIssueLabel,
} from '../types.js';

/** Distinct constraint-boundary terms; more distinct hits = stronger constraints. */
const CONSTRAINT_TERMS = [
  'tone',
  'audience',
  'scope',
  'limit',
  'under',
  'within',
  'avoid',
  'must',
  'do not',
  "don't",
  'concise',
  'professional',
  'friendly',
  'no more than',
  'at most',
  'words',
  'characters',
];

/** Phrases suggesting an overbroad, do-everything request. */
const OVERBROAD_TERMS = [
  'everything',
  'all about',
  'complete guide',
  'from scratch',
  'anything and everything',
];

function countDistinctTerms(text: string, terms: readonly string[]): number {
  return terms.filter((term) => text.includes(term)).length;
}

export function scoreConstraints(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const lowered = signals.lowered;
  const constraintHits = countDistinctTerms(lowered, CONSTRAINT_TERMS);

  const labels: ScoringIssueLabel[] = [];
  const explanations: string[] = [];

  // Overbroad detection: broad phrasing, or many "and"-joined actions.
  const andCount = (lowered.match(/\band\b/g) ?? []).length;
  const overbroad =
    OVERBROAD_TERMS.some((term) => lowered.includes(term)) || andCount >= 4;

  let score: DimensionResult['score'];

  if (constraintHits === 0 && signals.vagueTaskOnly) {
    score = 1;
    labels.push('missing_constraints');
    explanations.push('The prompt sets no boundaries such as length, tone, or scope.');
  } else if (constraintHits === 0) {
    score = 2;
    labels.push('missing_constraints');
    explanations.push('The prompt sets no boundaries such as length, tone, or scope.');
  } else if (constraintHits <= 2) {
    score = 3;
  } else if (constraintHits === 3) {
    score = 4;
  } else {
    score = 5;
  }

  if (overbroad) {
    labels.push('overbroad_prompt');
    explanations.push('The prompt tries to cover too much at once.');
    // Reduce score for overbroad scope, floor at 1.
    score = (score > 1 ? score - 1 : 1) as DimensionResult['score'];
  }

  return { score, labels, explanations };
}
