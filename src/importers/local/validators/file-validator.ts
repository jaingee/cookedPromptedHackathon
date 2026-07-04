/**
 * cookedPrompts — File-Level Validator
 *
 * Validates file-level/import-level concerns before row-level validation.
 * Checks structural integrity of the parsed import data.
 *
 * This validator does NOT:
 * - strip or mutate data
 * - normalize fields
 * - access storage or network
 * - perform row-level field validation
 */

import type { RawImportEntry, ImportWarning } from '../types.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../constants.js';

/** Maximum file size in bytes (50 MB). */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Result of file-level validation. */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: ImportWarning[];
}

export interface FileValidationInput {
  /** Original file size in bytes, if known. */
  file_size_bytes?: number;
  /** File extension (e.g., '.jsonl', '.csv'). */
  file_extension?: string;
  /** Parsed rows from the parser. */
  rows: Array<{ row_number: number; entry: RawImportEntry }>;
  /** Parser-level issues already reported. */
  parse_issue_count: number;
  /** CSV headers if CSV format. */
  headers?: string[];
}

/**
 * Validate file-level concerns for an import.
 *
 * Checks:
 * - File size within limit
 * - Supported file extension
 * - File has usable rows
 * - CSV has recognized column names
 * - Detects presence of banned full-answer fields (warning only)
 */
export function validateFile(input: FileValidationInput): FileValidationResult {
  const errors: string[] = [];
  const warnings: ImportWarning[] = [];

  // Check file size
  if (input.file_size_bytes !== undefined && input.file_size_bytes > MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File exceeds the 50 MB size limit (${(input.file_size_bytes / (1024 * 1024)).toFixed(1)} MB). Split the file into smaller parts before importing.`
    );
  }

  // Check file extension
  if (input.file_extension !== undefined) {
    const ext = input.file_extension.toLowerCase();
    if (ext !== '.jsonl' && ext !== '.csv') {
      errors.push(
        `Unsupported file extension "${input.file_extension}". cookedPrompts supports .jsonl and .csv files.`
      );
    }
  }

  // Check that we have usable rows
  if (input.rows.length === 0 && input.parse_issue_count === 0) {
    errors.push('File is empty or contains no parseable data rows.');
  }

  // CSV-specific: check headers
  if (input.headers !== undefined) {
    if (input.headers.length === 0) {
      errors.push('CSV file has no header row or header row is empty.');
    } else {
      const knownFields = new Set([
        'id', 'timestamp', 'source', 'provider', 'model_used', 'prompt_text',
        'prompt_hash', 'session_id', 'follow_up_index', 'parent_prompt_id',
        'input_tokens', 'output_tokens', 'total_tokens', 'estimated_cost',
        'latency_ms', 'solved_status', 'user_rating', 'tags', 'redaction_status',
      ]);
      const recognized = input.headers.filter((h) => knownFields.has(h.toLowerCase()));
      if (recognized.length === 0) {
        errors.push(
          'CSV header contains no recognized field names. Expected fields like id, timestamp, source, provider, model_used, prompt_text.'
        );
      }
    }
  }

  // Detect banned full-answer fields across all rows (warning, not error)
  const bannedLower = BANNED_FULL_ANSWER_FIELDS.map((f) => f.toLowerCase());
  const detectedBanned = new Set<string>();

  for (const { entry } of input.rows) {
    for (const key of Object.keys(entry)) {
      if (bannedLower.includes(key.toLowerCase())) {
        detectedBanned.add(key.toLowerCase());
      }
    }
  }

  if (detectedBanned.size > 0) {
    const fieldList = Array.from(detectedBanned).join(', ');
    warnings.push({
      row_number: null,
      warning_type: 'full_answer_fields_detected',
      message: `This file includes model answer fields (${fieldList}). cookedPrompts V1 does not store full model answers — these fields will be stripped during processing.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
