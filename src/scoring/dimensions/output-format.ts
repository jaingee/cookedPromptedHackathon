/**
 * cookedPrompts — Output Format Dimension Scorer
 *
 * Deterministic, pure. Judges whether the prompt specifies an expected
 * output format/shape.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type { DimensionResult, PromptSignals } from '../types.js';

/** Explicit "return as / format as" style requests. */
const EXPLICIT_FORMAT_PHRASES = [
  'return as',
  'output as',
  'format as',
  'respond in',
  'use a table',
  'as a table',
  'as json',
  'in json',
  'as bullet',
  'as a list',
  'as markdown',
  'in markdown',
  'as code',
];

/** Structure/detail terms that combine with an explicit format for a top score. */
const STRUCTURE_TERMS = ['column', 'field', 'section', 'schema', 'header', 'row'];

export function scoreOutputFormat(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const lowered = signals.lowered;

  if (!signals.hasFormatMarker) {
    return {
      score: 2,
      labels: ['missing_output_format'],
      explanations: ['The prompt does not specify the expected output format.'],
    };
  }

  const hasExplicitFormat = EXPLICIT_FORMAT_PHRASES.some((phrase) =>
    lowered.includes(phrase),
  );
  const hasStructure = STRUCTURE_TERMS.some((term) => lowered.includes(term));

  if (hasExplicitFormat && hasStructure) {
    return { score: 5, labels: [], explanations: [] };
  }

  if (hasExplicitFormat) {
    return { score: 4, labels: [], explanations: [] };
  }

  // Format marker present but only implicit.
  return { score: 3, labels: [], explanations: [] };
}
