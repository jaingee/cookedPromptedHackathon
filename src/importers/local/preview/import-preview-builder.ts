/**
 * cookedPrompts — Import Preview Builder
 *
 * Assembles an ImportPreview from the results of parsing, validation,
 * stripping, normalization, and safety handoff.
 *
 * This module does NOT:
 * - Parse, validate, strip, normalize, or scan entries itself.
 * - Access storage or network.
 * - Include raw rows or banned full-answer field values.
 * - Display full prompt text beyond what ImportPreview already contains.
 *
 * It is a pure data-assembly module: deterministic and local.
 */

import type {
  ImportBatch,
  ImportPreview,
  ImportValidationIssue,
  ImportWarning,
  FullAnswerFieldWarning,
  SafetyHandoffResult,
  PromptLogEntry,
} from '../types.js';

/** Input required to build an import preview. */
export interface PreviewBuilderInput {
  batch: ImportBatch;
  valid_entries: PromptLogEntry[];
  invalid_entries: Array<{ row_number: number; issues: ImportValidationIssue[] }>;
  warnings: ImportWarning[];
  full_answer_warnings: FullAnswerFieldWarning[];
  safety_warnings: SafetyHandoffResult;
}

/**
 * Build an ImportPreview from processed import results.
 *
 * Computes the missing metadata summary from normalized entries.
 */
export function buildImportPreview(input: PreviewBuilderInput): ImportPreview {
  const { valid_entries } = input;

  const missing_metadata_summary = {
    entries_missing_tokens: valid_entries.filter(
      (e) => e.input_tokens === null && e.output_tokens === null && e.total_tokens === null,
    ).length,
    entries_missing_cost: valid_entries.filter((e) => e.estimated_cost === null).length,
    entries_missing_latency: valid_entries.filter((e) => e.latency_ms === null).length,
    entries_missing_rating: valid_entries.filter((e) => e.user_rating === null).length,
  };

  return {
    batch: input.batch,
    valid_entries: input.valid_entries,
    invalid_entries: input.invalid_entries,
    warnings: input.warnings,
    full_answer_warnings: input.full_answer_warnings,
    safety_warnings: input.safety_warnings,
    missing_metadata_summary,
  };
}
