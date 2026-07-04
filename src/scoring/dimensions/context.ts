/**
 * cookedPrompts — Context Dimension Scorer
 *
 * Deterministic, pure. Judges whether the prompt provides enough background,
 * domain, and input detail. Reads prompt text in memory only.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type { DimensionResult, PromptSignals } from '../types.js';

/** Richer context indicators beyond the basic context markers. */
const RICH_CONTEXT_TERMS = [
  'input',
  'file',
  'attached',
  'data',
  'project',
  'requirements',
  'current state',
  'audience',
  'goal',
];

export function scoreContext(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const trimmed = (entry.prompt_text ?? '').trim();
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  if (trimmed.length === 0) {
    return {
      score: 0,
      labels: ['missing_context'],
      explanations: ['The prompt is empty and provides no context.'],
    };
  }

  const richTermCount = RICH_CONTEXT_TERMS.filter((term) =>
    signals.lowered.includes(term),
  ).length;

  // Very short with no context markers.
  if (!signals.hasContextMarker && signals.length < 40) {
    return {
      score: 1,
      labels: ['missing_context'],
      explanations: ['The prompt provides little background or context.'],
    };
  }

  if (!signals.hasContextMarker && signals.length < 120) {
    return {
      score: 2,
      labels: ['missing_context'],
      explanations: ['The prompt provides little background or context.'],
    };
  }

  // Some detail but weak explicit context.
  if (!signals.hasContextMarker) {
    return { score: 3, labels: [], explanations: [] };
  }

  // Explicit context marker present.
  if (richTermCount >= 2 || tags.length > 0) {
    return { score: 5, labels: [], explanations: [] };
  }

  if (richTermCount >= 1) {
    return { score: 4, labels: [], explanations: [] };
  }

  return { score: 3, labels: [], explanations: [] };
}
