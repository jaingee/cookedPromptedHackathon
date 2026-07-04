/**
 * cookedPrompts — Safety/Privacy Dimension Scorer
 *
 * Deterministic, pure. Uses the local safety pattern matcher (category +
 * severity only) plus redaction_status. NEVER returns matched substrings,
 * prompt text, or logs anything.
 */

import type { PromptLogEntry } from '../../importers/local/types.js';
import type {
  DimensionResult,
  PromptSignals,
  ScoringIssueLabel,
} from '../types.js';
import { matchSafetyPatterns } from '../rules/safety-patterns.js';

export function scoreSafetyPrivacy(
  entry: PromptLogEntry,
  signals: PromptSignals,
): DimensionResult {
  const matches = matchSafetyPatterns(entry.prompt_text ?? '');
  const redaction = entry.redaction_status; // 'none' | 'partial' | 'full' | null
  const alreadyRedacted = redaction === 'full';

  const labels: ScoringIssueLabel[] = [];
  const explanations: string[] = [];

  const hasHigh = matches.some((m) => m.severity === 'high');
  const hasMedium = matches.some((m) => m.severity === 'medium');

  if (hasHigh) {
    labels.push('possible_secret');
    explanations.push(
      'Potential secret-like text was detected. Redact before reuse.',
    );
    if (hasMedium) {
      labels.push('privacy_risk');
    }
    // Relax slightly if the entry is already fully redacted, but never clear.
    return { score: alreadyRedacted ? 2 : 0, labels, explanations };
  }

  if (hasMedium) {
    labels.push('privacy_risk');
    explanations.push('The prompt may contain personal or sensitive data.');
    return { score: alreadyRedacted ? 4 : 3, labels, explanations };
  }

  // No pattern match, but the task intent signals sensitive content.
  if (signals.requiredCapabilities.includes('privacy_sensitive_local')) {
    labels.push('privacy_risk');
    explanations.push('The prompt appears to involve sensitive content.');
    return { score: 4, labels, explanations };
  }

  return { score: 5, labels, explanations };
}
