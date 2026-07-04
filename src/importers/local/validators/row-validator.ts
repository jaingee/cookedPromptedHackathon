/**
 * cookedPrompts — Row-Level Validator
 *
 * Validates a single RawImportEntry against the prompt log schema.
 * Reports issues per row without mutating, normalizing, or stripping data.
 *
 * This validator does NOT:
 * - strip banned fields (that is Wave 4)
 * - normalize values
 * - compute hashes
 * - access storage or network
 */

import type { RawImportEntry, ImportValidationIssue, ImportWarning } from '../types.js';

/** Required fields for a valid prompt log entry. */
const REQUIRED_FIELDS = ['id', 'timestamp', 'source', 'provider', 'model_used', 'prompt_text'] as const;

/** Valid solved_status values. */
const VALID_SOLVED_STATUS = new Set(['solved', 'unsolved', 'partial']);

/** Result of validating a single row. */
export interface RowValidationResult {
  valid: boolean;
  issues: ImportValidationIssue[];
  warnings: ImportWarning[];
}

/**
 * Validate a single parsed row entry.
 *
 * @param entry The raw parsed entry
 * @param rowNumber 1-indexed row/line number
 * @param seenIds Set of IDs already seen in this batch (for duplicate detection)
 */
export function validateRow(
  entry: RawImportEntry,
  rowNumber: number,
  seenIds: Set<string>,
): RowValidationResult {
  const issues: ImportValidationIssue[] = [];
  const warnings: ImportWarning[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (value === undefined || value === null || value === '') {
      issues.push({
        row_number: rowNumber,
        field,
        issue_type: 'missing_required',
        message: `Row ${rowNumber} is missing required field "${field}".`,
        suggestion: `Add a non-empty "${field}" value.`,
      });
    } else if (typeof value !== 'string') {
      issues.push({
        row_number: rowNumber,
        field,
        issue_type: 'invalid_type',
        message: `Row ${rowNumber}: "${field}" must be a string, got ${typeof value}.`,
        suggestion: `Provide "${field}" as a string value.`,
      });
    }
  }

  // Validate timestamp format (ISO 8601)
  validateTimestamp(entry, rowNumber, issues);

  // Validate numeric optional fields
  validateNonNegativeInt(entry, 'input_tokens', rowNumber, issues);
  validateNonNegativeInt(entry, 'output_tokens', rowNumber, issues);
  validateNonNegativeInt(entry, 'total_tokens', rowNumber, issues);
  validateNonNegativeInt(entry, 'follow_up_index', rowNumber, issues);

  // Validate user_rating (1-5)
  validateUserRating(entry, rowNumber, issues);

  // Validate solved_status
  validateSolvedStatus(entry, rowNumber, issues);

  // Check duplicate ID within batch
  validateDuplicateId(entry, rowNumber, seenIds, issues);

  // Check parent_prompt_id reference (warning only)
  checkParentPromptId(entry, rowNumber, seenIds, warnings);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

// --- Internal helpers ---

/** Validate ISO 8601 timestamp format. */
function validateTimestamp(
  entry: RawImportEntry,
  rowNumber: number,
  issues: ImportValidationIssue[],
): void {
  const value = entry['timestamp'];
  if (value === undefined || value === null || value === '') return; // handled by required check

  if (typeof value !== 'string') return; // handled by type check

  // Attempt ISO 8601 parse
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    issues.push({
      row_number: rowNumber,
      field: 'timestamp',
      issue_type: 'invalid_timestamp',
      message: `Row ${rowNumber}: invalid timestamp "${truncate(value, 40)}". Expected ISO 8601 format.`,
      suggestion: 'Use ISO 8601 format, e.g., 2024-06-15T10:30:00Z.',
    });
  }
}

/** Validate a field is a non-negative integer if present. */
function validateNonNegativeInt(
  entry: RawImportEntry,
  field: string,
  rowNumber: number,
  issues: ImportValidationIssue[],
): void {
  const value = entry[field];
  if (value === undefined || value === null || value === '') return; // optional

  const num = typeof value === 'string' ? Number(value) : value;

  if (typeof num !== 'number' || !Number.isFinite(num)) {
    issues.push({
      row_number: rowNumber,
      field,
      issue_type: 'invalid_type',
      message: `Row ${rowNumber}: "${field}" must be a number, got "${truncate(String(value), 20)}".`,
      suggestion: `Provide "${field}" as a non-negative integer.`,
    });
    return;
  }

  if (num < 0 || !Number.isInteger(num)) {
    issues.push({
      row_number: rowNumber,
      field,
      issue_type: 'invalid_value',
      message: `Row ${rowNumber}: "${field}" must be a non-negative integer, got ${num}.`,
      suggestion: `Provide "${field}" as zero or a positive whole number.`,
    });
  }
}

/** Validate user_rating is 1-5 integer if present. */
function validateUserRating(
  entry: RawImportEntry,
  rowNumber: number,
  issues: ImportValidationIssue[],
): void {
  const value = entry['user_rating'];
  if (value === undefined || value === null || value === '') return;

  const num = typeof value === 'string' ? Number(value) : value;

  if (typeof num !== 'number' || !Number.isFinite(num) || !Number.isInteger(num)) {
    issues.push({
      row_number: rowNumber,
      field: 'user_rating',
      issue_type: 'invalid_type',
      message: `Row ${rowNumber}: "user_rating" must be an integer 1–5, got "${truncate(String(value), 20)}".`,
      suggestion: 'Provide user_rating as an integer from 1 to 5.',
    });
    return;
  }

  if (num < 1 || num > 5) {
    issues.push({
      row_number: rowNumber,
      field: 'user_rating',
      issue_type: 'invalid_value',
      message: `Row ${rowNumber}: "user_rating" must be between 1 and 5, got ${num}.`,
      suggestion: 'Use a rating from 1 (worst) to 5 (best).',
    });
  }
}

/** Validate solved_status is a known value if present. */
function validateSolvedStatus(
  entry: RawImportEntry,
  rowNumber: number,
  issues: ImportValidationIssue[],
): void {
  const value = entry['solved_status'];
  if (value === undefined || value === null || value === '') return;

  if (typeof value !== 'string') {
    issues.push({
      row_number: rowNumber,
      field: 'solved_status',
      issue_type: 'invalid_type',
      message: `Row ${rowNumber}: "solved_status" must be a string, got ${typeof value}.`,
      suggestion: 'Use "solved", "unsolved", or "partial".',
    });
    return;
  }

  if (!VALID_SOLVED_STATUS.has(value)) {
    issues.push({
      row_number: rowNumber,
      field: 'solved_status',
      issue_type: 'invalid_value',
      message: `Row ${rowNumber}: "solved_status" must be "solved", "unsolved", or "partial", got "${truncate(value, 20)}".`,
      suggestion: 'Use "solved", "unsolved", or "partial".',
    });
  }
}

/** Check for duplicate ID within the current batch. */
function validateDuplicateId(
  entry: RawImportEntry,
  rowNumber: number,
  seenIds: Set<string>,
  issues: ImportValidationIssue[],
): void {
  const id = entry['id'];
  if (typeof id !== 'string' || id === '') return; // handled by required check

  if (seenIds.has(id)) {
    issues.push({
      row_number: rowNumber,
      field: 'id',
      issue_type: 'duplicate_id',
      message: `Row ${rowNumber}: duplicate id "${truncate(id, 30)}". Each entry needs a unique ID within this import.`,
      suggestion: 'Ensure each row has a unique "id" value.',
    });
  } else {
    seenIds.add(id);
  }
}

/** Warn if parent_prompt_id references an ID not yet seen in this batch. */
function checkParentPromptId(
  entry: RawImportEntry,
  rowNumber: number,
  seenIds: Set<string>,
  warnings: ImportWarning[],
): void {
  const parentId = entry['parent_prompt_id'];
  if (parentId === undefined || parentId === null || parentId === '') return;

  if (typeof parentId !== 'string') return;

  if (!seenIds.has(parentId)) {
    warnings.push({
      row_number: rowNumber,
      warning_type: 'parent_id_not_in_batch',
      message: `Row ${rowNumber}: "parent_prompt_id" references "${truncate(parentId, 30)}" which is not in this import batch. It may exist in a previous import.`,
    });
  }
}

/** Safely truncate a string for error messages (no private data leakage). */
function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + '…';
}
