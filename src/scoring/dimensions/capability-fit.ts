/**
 * cookedPrompts — Capability-Fit Dimension Scorer
 *
 * Deterministic, pure. Compares inferred task-intent capabilities against
 * available model capability metadata (vendor-neutral). Missing metadata is
 * neutral, not a failure. No provider/model names are referenced here.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type {
  CapabilityClass,
  DimensionResult,
  PromptSignals,
  ScoringIssueLabel,
} from '../types.js';
import { inferCapabilitiesFromModelMetadata } from '../rules/capability-classes.js';

/** Capabilities considered "powerful" for overpowered-model detection. */
const POWERFUL_CAPABILITIES: readonly CapabilityClass[] = [
  'deep_reasoning',
  'long_context',
];

/** Capabilities a simple task needs; used to detect overkill. */
const SIMPLE_CAPABILITIES: readonly CapabilityClass[] = [
  'cheap_fast',
  'general_purpose',
];

export function scoreCapabilityFit(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const required = signals.requiredCapabilities;
  const labels: ScoringIssueLabel[] = [];
  const explanations: string[] = [];

  // Surface intent-driven labels regardless of model metadata.
  if (required.includes('search_required')) {
    labels.push('needs_search');
    explanations.push('The task appears to need current or external information.');
  }
  if (required.includes('tool_using')) {
    labels.push('needs_tool_use');
    explanations.push('The task appears to require tool or API use.');
  }

  // No model metadata → neutral score; confidence handles this later.
  if (!signals.hasModelMetadata) {
    return { score: 3, labels, explanations };
  }

  const available = inferCapabilitiesFromModelMetadata(entry.model_used);

  // Requirements that the model capability metadata does not cover.
  const coreRequired = required.filter(
    (cap) => cap !== 'search_required' && cap !== 'tool_using',
  );
  const uncovered = coreRequired.filter((cap) => !available.includes(cap));

  // Task looks simple but model advertises powerful capabilities → overkill.
  const taskIsSimple = required.every((cap) => SIMPLE_CAPABILITIES.includes(cap));
  const modelIsPowerful = available.some((cap) =>
    POWERFUL_CAPABILITIES.includes(cap),
  );

  if (uncovered.length > 0) {
    labels.push('wrong_model_class');
    explanations.push('The model class may not match what the task needs.');
    return { score: 2, labels, explanations };
  }

  if (taskIsSimple && modelIsPowerful) {
    labels.push('overpowered_model');
    explanations.push('A simpler, cheaper model class likely fit this task.');
    return { score: 3, labels, explanations };
  }

  // Available covers required.
  const strongMatch = coreRequired.every((cap) => available.includes(cap));
  if (strongMatch && coreRequired.length > 0) {
    return { score: 5, labels, explanations };
  }

  return { score: 4, labels, explanations };
}
