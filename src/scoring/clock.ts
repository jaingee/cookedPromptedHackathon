/**
 * cookedPrompts — Scoring Clock and ID Factory
 *
 * Isolates the only non-deterministic inputs to scoring (`scored_at` and
 * the score record `id`) behind injectable helpers, so that scoring values,
 * labels, and explanations remain fully reproducible in tests.
 *
 * Local-first: no network, no external services.
 */

import { randomUUID } from 'node:crypto';

import type { Clock } from './types.js';

/** Default clock: current system time as an ISO 8601 string. */
export const defaultClock: Clock = {
  now: () => new Date().toISOString(),
};

/**
 * Default local id factory. Uses Node's built-in crypto (no dependency,
 * no external service). Tests may inject a deterministic factory instead.
 */
export function defaultIdFactory(): string {
  return randomUUID();
}
