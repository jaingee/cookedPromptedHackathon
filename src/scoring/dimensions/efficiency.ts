/**
 * cookedPrompts — Efficiency Dimension Scorer
 *
 * Deterministic, pure. Uses character length as a rough proxy (no tokenizer)
 * plus simple repetition heuristics. Long prompts are not penalized when the
 * task legitimately needs long context / deep reasoning / coding.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type {
  CapabilityClass,
  DimensionResult,
  PromptSignals,
  ScoringIssueLabel,
} from '../types.js';

const SHORT_MAX = 80;
const NORMAL_MAX = 1200;
const LONG_MAX = 3000;

/** Capabilities that justify a longer prompt. */
const LENGTH_JUSTIFYING: readonly CapabilityClass[] = [
  'long_context',
  'deep_reasoning',
  'coding',
];

/** Rough repetition check: a high share of repeated words. */
function looksRepetitive(lowered: string): boolean {
  const words = lowered.split(/\s+/).filter((w) => w.length > 3);
  if (words.length < 12) return false;
  const unique = new Set(words);
  return unique.size / words.length < 0.5;
}

export function scoreEfficiency(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const length = signals.length;

  if (length === 0) {
    return {
      score: 0,
      labels: [],
      explanations: ['The prompt is empty.'],
    };
  }

  const labels: ScoringIssueLabel[] = [];
  const explanations: string[] = [];

  const justifiesLength = signals.requiredCapabilities.some((cap) =>
    LENGTH_JUSTIFYING.includes(cap),
  );
  const repetitive = looksRepetitive(signals.lowered);

  let score: DimensionResult['score'];

  if (length < SHORT_MAX && signals.vagueTaskOnly) {
    score = 2;
  } else if (length <= NORMAL_MAX) {
    score = repetitive ? 3 : 5;
  } else if (length <= LONG_MAX) {
    // Long: fine if justified, otherwise mildly inefficient.
    score = justifiesLength ? 4 : 3;
    if (!justifiesLength) {
      labels.push('too_long_for_task');
      explanations.push('The prompt is long for what it asks.');
    }
  } else {
    // Very long.
    score = justifiesLength ? 3 : 2;
    if (!justifiesLength) {
      labels.push('too_long_for_task');
      explanations.push('The prompt is very long for what it asks.');
    }
  }

  if (repetitive && !labels.includes('too_long_for_task')) {
    explanations.push('The prompt repeats itself.');
    score = (score > 2 ? score - 1 : score) as DimensionResult['score'];
  }

  return { score, labels, explanations };
}
