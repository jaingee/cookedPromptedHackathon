/**
 * cookedPrompts — Prompt Hash Service
 *
 * Computes a deterministic SHA-256 hash of prompt text.
 * Used to attach `prompt_hash` to normalized entries when absent,
 * supporting later deduplication.
 *
 * Guardrails:
 * - Hashes ONLY the prompt text passed in.
 * - Never hashes model answers or banned full-answer field values.
 * - Never stores raw prompt text in the returned value or elsewhere.
 * - Uses Node's built-in crypto (no external dependency).
 */

import { createHash } from 'node:crypto';

/**
 * Compute a deterministic SHA-256 hex digest of the given prompt text.
 *
 * The same input always produces the same output. Only the prompt text
 * is hashed; no other fields are involved.
 *
 * @param promptText The user's prompt text
 * @returns Lower-case hex SHA-256 digest
 */
export function computePromptHash(promptText: string): string {
  return createHash('sha256').update(promptText, 'utf8').digest('hex');
}
