/**
 * cookedPrompts — Scoring Test Helpers
 *
 * Synthetic fixtures and deterministic clock/id helpers for scoring tests.
 * All data is synthetic. No real prompts, secrets, or model answers.
 */

import type { PromptLogEntry } from '../../src/importers/local/types.js';
import type { Clock } from '../../src/scoring/types.js';

/** Build a synthetic normalized PromptLogEntry, overridable per test. */
export function makePromptLogEntry(
  overrides: Partial<PromptLogEntry> = {},
): PromptLogEntry {
  return {
    id: 'prompt-log-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'demo',
    provider: 'synthetic',
    model_used: 'general purpose',
    prompt_text:
      'Write a concise markdown summary for the engineering team about the current project status. Format the answer in markdown with bullet points. Avoid jargon.',
    import_batch_id: 'batch-1',
    prompt_hash: 'synthetic-hash',
    session_id: null,
    follow_up_index: null,
    parent_prompt_id: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: null,
    estimated_cost: null,
    latency_ms: null,
    solved_status: null,
    user_rating: null,
    tags: [],
    redaction_status: 'none',
    ...overrides,
  };
}

/** Fixed clock so `scored_at` is deterministic in tests. */
export const fixedClock: Clock = {
  now: () => '2026-01-01T00:00:00.000Z',
};

/** Fixed id factory so `id` is deterministic in tests. */
export function fixedIdFactory(): string {
  return 'score-1';
}

/** An obviously fake secret-like value (synthetic; not a real credential). */
export const FAKE_SECRET = 'FAKE_API_KEY_123456789012345678901234567890';

/** An obviously fake email (synthetic). */
export const FAKE_EMAIL = 'fake@example.test';
