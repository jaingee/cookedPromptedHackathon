/**
 * cookedPrompts — Explanation Builder
 *
 * Pure helper that flattens, trims, dedupes, and caps dimension explanations
 * into a tidy list. Never adds prompt text or matched substrings.
 */

import type { DimensionResult } from '../types.js';

const MAX_EXPLANATIONS = 6;
const MAX_EXPLANATION_LENGTH = 120;

/** Safely truncate an explanation without exposing extra data. */
function capLength(text: string): string {
  if (text.length <= MAX_EXPLANATION_LENGTH) return text;
  return `${text.slice(0, MAX_EXPLANATION_LENGTH - 1).trimEnd()}…`;
}

/**
 * Flatten explanations from dimension results, trim, drop empties, dedupe
 * (first-seen order), and cap count + per-item length.
 */
export function buildExplanations(
  results: readonly DimensionResult[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const result of results) {
    for (const raw of result.explanations) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(capLength(trimmed));
      if (out.length >= MAX_EXPLANATIONS) return out;
    }
  }

  return out;
}
