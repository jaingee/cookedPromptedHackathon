/**
 * cookedPrompts — Clarity Dimension Scorer
 *
 * Deterministic, pure. Judges whether the prompt clearly states what it wants.
 * Reads prompt text only in memory; never logs, persists, or returns it.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type { DimensionResult, PromptSignals } from '../types.js';

/** Task verbs that suggest a clear action was requested. */
const TASK_VERBS = [
  'create',
  'write',
  'explain',
  'compare',
  'analyze',
  'summarize',
  'debug',
  'fix',
  'refactor',
  'design',
  'generate',
  'convert',
  'rewrite',
  'list',
  'build',
  'implement',
  'translate',
  'review',
];

export function scoreClarity(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const text = entry.prompt_text ?? '';
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return {
      score: 0,
      labels: ['unclear_task'],
      explanations: ['The prompt is empty and states no task.'],
    };
  }

  if (signals.vagueTaskOnly) {
    return {
      score: 1,
      labels: ['unclear_task'],
      explanations: ['The prompt does not clearly state what it wants.'],
    };
  }

  const hasTaskVerb = TASK_VERBS.some((verb) => signals.lowered.includes(verb));
  const hasDetail = signals.hasContextMarker || signals.hasConstraintMarker;

  // Short and missing an explicit task verb → still unclear.
  if (!hasTaskVerb && signals.length < 40) {
    return {
      score: 2,
      labels: ['unclear_task'],
      explanations: ['The prompt is short and does not clearly state a task.'],
    };
  }

  if (!hasTaskVerb) {
    return { score: 3, labels: [], explanations: [] };
  }

  // Clear task verb present.
  if (hasDetail && signals.length >= 80) {
    return { score: 5, labels: [], explanations: [] };
  }

  if (hasDetail || signals.length >= 80) {
    return { score: 4, labels: [], explanations: [] };
  }

  return { score: 3, labels: [], explanations: [] };
}
