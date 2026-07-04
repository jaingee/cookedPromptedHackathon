/**
 * cookedPrompts — Scoring Engine Wrapper
 *
 * Thin convenience wrapper around scorePrompt/scorePrompts that closes over a
 * ScoringConfig (clock/idFactory). No storage, no network, no LLM, no hidden
 * state beyond the closed-over config.
 */

import type { ScoringConfig, ScoringEngine } from './types.js';
import { scorePrompt, scorePrompts } from './score-prompt.js';

export function createScoringEngine(
  config: ScoringConfig = {},
): ScoringEngine {
  return {
    score: (entry) => scorePrompt(entry, config),
    scoreMany: (entries) => scorePrompts(entries, config),
  };
}
