/**
 * cookedPrompts — Prompt Log Normalizer
 *
 * Converts a stripped, validated raw entry into the canonical
 * PromptLogEntry shape.
 *
 * Guardrails:
 * - Never stores full model answers (banned fields are already stripped
 *   before this module runs; any unknown fields are simply ignored).
 * - Missing optional fields become null, except `tags` which defaults to [].
 * - `redaction_status` defaults to "none".
 * - `prompt_hash` is computed from prompt_text when absent.
 * - Deterministic and local — no storage, safety, AI, or network calls.
 *
 * This module reshapes allowed data only. It assumes validation has already
 * passed; it does not re-run business validation.
 */

import type { RawImportEntry, PromptLogEntry } from '../types.js';
import { computePromptHash } from '../services/prompt-hash-service.js';

const VALID_SOLVED_STATUS = new Set(['solved', 'unsolved', 'partial']);
const VALID_REDACTION_STATUS = new Set(['none', 'partial', 'full']);

/**
 * Normalize a single stripped, validated raw entry into a PromptLogEntry.
 *
 * @param entry The stripped raw entry (banned fields already removed)
 * @param importBatchId The batch ID assigned to this import operation
 */
export function normalizePromptLog(
  entry: RawImportEntry,
  importBatchId: string,
): PromptLogEntry {
  const promptText = asString(entry['prompt_text']) ?? '';

  const providedHash = asString(entry['prompt_hash']);
  const promptHash = providedHash ?? computePromptHash(promptText);

  return {
    // Required
    id: asString(entry['id']) ?? '',
    timestamp: asString(entry['timestamp']) ?? '',
    source: asString(entry['source']) ?? '',
    provider: asString(entry['provider']) ?? '',
    model_used: asString(entry['model_used']) ?? '',
    prompt_text: promptText,
    import_batch_id: importBatchId,

    // Optional
    prompt_hash: promptHash,
    session_id: asString(entry['session_id']),
    follow_up_index: asInt(entry['follow_up_index']),
    parent_prompt_id: asString(entry['parent_prompt_id']),
    input_tokens: asInt(entry['input_tokens']),
    output_tokens: asInt(entry['output_tokens']),
    total_tokens: asInt(entry['total_tokens']),
    estimated_cost: asNumber(entry['estimated_cost']),
    latency_ms: asInt(entry['latency_ms']),
    solved_status: asEnum(entry['solved_status'], VALID_SOLVED_STATUS) as
      | 'solved'
      | 'unsolved'
      | 'partial'
      | null,
    user_rating: asInt(entry['user_rating']),
    tags: normalizeTags(entry['tags']),
    redaction_status:
      (asEnum(entry['redaction_status'], VALID_REDACTION_STATUS) as
        | 'none'
        | 'partial'
        | 'full'
        | null) ?? 'none',
  };
}

// --- Internal coercion helpers ---

/** Return a trimmed non-empty string, or null. */
function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return null;
}

/** Return a finite integer, or null. Accepts numeric strings. */
function asInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || !Number.isInteger(num)) {
    return null;
  }
  return num;
}

/** Return a finite number, or null. Accepts numeric strings. */
function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    return null;
  }
  return num;
}

/** Return the value if it is in the allowed set, else null. */
function asEnum(value: unknown, allowed: Set<string>): string | null {
  if (typeof value !== 'string') return null;
  return allowed.has(value) ? value : null;
}

/**
 * Normalize tags into an array of trimmed non-empty strings.
 *
 * Accepts a JSON array of strings (JSONL) or a comma-separated string (CSV).
 * Defaults to an empty array when absent.
 */
function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];

  if (Array.isArray(value)) {
    return value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  }

  return [];
}
