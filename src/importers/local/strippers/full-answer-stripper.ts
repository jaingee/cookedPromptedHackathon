/**
 * cookedPrompts — Full Model Answer Field Stripper
 *
 * PRIVACY-CRITICAL MODULE.
 *
 * cookedPrompts V1 does not store full model answers. This module removes
 * banned full-answer fields from raw entries before normalization.
 *
 * Guardrails enforced here:
 * - Banned fields are removed, never renamed into allowed fields.
 * - Stripped values are NEVER preserved anywhere (metadata, warnings, logs).
 * - Warnings report field NAMES only, never field VALUES.
 * - The original input object is not mutated (a cleaned copy is returned).
 */

import type { RawImportEntry, FullAnswerFieldWarning } from '../types.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../constants.js';

/** Result of stripping banned fields from a single entry. */
export interface StripResult {
  /** Cleaned entry with banned fields removed. Original is not mutated. */
  entry: RawImportEntry;
  /** Warning describing which field names were stripped, if any. */
  warning: FullAnswerFieldWarning | null;
}

/** Lower-cased banned field names for case-insensitive matching. */
const BANNED_LOWER = new Set(BANNED_FULL_ANSWER_FIELDS.map((f) => f.toLowerCase()));

/**
 * Strip banned full-answer fields from a raw entry.
 *
 * Returns a new object; the input is never mutated. Any matched field is
 * dropped entirely. Its value is never copied, logged, or referenced.
 *
 * @param entry The raw parsed entry
 * @param rowNumber 1-indexed row/line number (for the warning)
 */
export function stripFullAnswerFields(
  entry: RawImportEntry,
  rowNumber: number,
): StripResult {
  const cleaned: RawImportEntry = {};
  const strippedFields: string[] = [];

  for (const key of Object.keys(entry)) {
    if (BANNED_LOWER.has(key.toLowerCase())) {
      // Record only the field NAME. The value is intentionally discarded
      // and never read, copied, or logged.
      strippedFields.push(key);
      continue;
    }
    cleaned[key] = entry[key];
  }

  if (strippedFields.length === 0) {
    return { entry: cleaned, warning: null };
  }

  const warning: FullAnswerFieldWarning = {
    row_number: rowNumber,
    stripped_fields: strippedFields,
    message: `This entry included model answer fields (${strippedFields.join(', ')}). cookedPrompts V1 does not store full model answers, so these fields were ignored.`,
  };

  return { entry: cleaned, warning };
}
