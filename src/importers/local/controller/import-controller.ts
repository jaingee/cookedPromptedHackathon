/**
 * cookedPrompts — Import Controller
 *
 * Orchestrates the full local import pipeline:
 * parse → file validation → strip banned fields → row validation →
 * normalize + hash → safety handoff → build preview.
 *
 * PRIVACY GUARDRAILS:
 * - Banned full-answer fields are stripped BEFORE row validation and normalization.
 * - Stripped values never appear in issues, warnings, preview, or downstream payloads.
 * - No network calls, external services, AI, or cloud behavior.
 * - Operates on normalized PromptLogEntry records for safety/storage handoff.
 * - Local-first and deterministic.
 *
 * This controller is thin: it delegates to existing modules.
 */

import { randomUUID } from 'node:crypto';

import type {
  ImportBatch,
  ImportPreview,
  ImporterResult,
  ImportValidationIssue,
  ImportWarning,
  FullAnswerFieldWarning,
  PromptLogEntry,
  RawImportEntry,
} from '../types.js';
import { parseJsonl } from '../parsers/jsonl-parser.js';
import { parseCsv } from '../parsers/csv-parser.js';
import { validateFile } from '../validators/file-validator.js';
import { validateRow } from '../validators/row-validator.js';
import { stripFullAnswerFields } from '../strippers/full-answer-stripper.js';
import { normalizePromptLog } from '../normalizer/prompt-log-normalizer.js';
import { loadDemoDataset } from '../demo/demo-dataset-loader.js';
import { StubSafetyHandoffAdapter } from '../adapters/safety-handoff-adapter.js';
import { buildImportPreview as assemblePreview } from '../preview/import-preview-builder.js';
import type { SafetyHandoffAdapter } from '../adapters/safety-handoff-adapter.js';
import type { StorageHandoffPort } from '../ports/storage-handoff-port.js';

/** Source type for an import operation. */
export type ImportSourceType = 'jsonl' | 'csv' | 'demo';

/** Input for building an import preview. */
export interface BuildImportPreviewInput {
  source_type: ImportSourceType;
  /** Raw file content (required for jsonl/csv, ignored for demo). */
  content?: string;
  /** Original filename for display/diagnostics. */
  source_filename?: string | null;
  /** File size in bytes for file-level validation. */
  file_size_bytes?: number;
  /** Safety adapter override (defaults to StubSafetyHandoffAdapter). */
  safety_adapter?: SafetyHandoffAdapter;
  /** Storage port for cross-batch duplicate checking (optional). */
  storage_port?: StorageHandoffPort;
}

/**
 * Build an import preview by running the full pipeline.
 *
 * Pipeline order:
 * 1. Parse (or load demo)
 * 2. File-level validation
 * 3. Strip banned full-answer fields
 * 4. Row-level validation on stripped entries
 * 5. Normalize valid rows
 * 6. Safety handoff on normalized entries
 * 7. Build and return preview
 *
 * Does NOT save/commit. Use commitImportPreview for that.
 */
export async function buildImportPreview(
  input: BuildImportPreviewInput,
): Promise<ImportPreview> {
  const batchId = randomUUID();
  const createdAt = new Date().toISOString();
  const safetyAdapter = input.safety_adapter ?? new StubSafetyHandoffAdapter();

  // --- Step 1: Parse ---
  const parseResult = parseInput(input);

  // --- Step 2: File-level validation ---
  const fileValidation = runFileValidation(input, parseResult);
  const allWarnings: ImportWarning[] = [...fileValidation.warnings];

  // If file-level validation fails hard, return an empty preview with errors
  if (!fileValidation.valid) {
    const fileErrors: ImportValidationIssue[] = fileValidation.errors.map((msg) => ({
      row_number: 0,
      field: '_file',
      issue_type: 'invalid_value' as const,
      message: msg,
      suggestion: null,
    }));

    const batch = makeBatch(batchId, input, 0, 0, fileErrors.length, allWarnings.length, createdAt);
    return assemblePreview({
      batch,
      valid_entries: [],
      invalid_entries: [],
      warnings: allWarnings,
      full_answer_warnings: [],
      safety_warnings: { entries_scanned: 0, warnings: [] },
    });
  }

  // --- Step 3: Strip banned full-answer fields ---
  const fullAnswerWarnings: FullAnswerFieldWarning[] = [];
  const strippedRows: Array<{ row_number: number; entry: RawImportEntry }> = [];

  for (const row of parseResult.rows) {
    const stripResult = stripFullAnswerFields(row.entry, row.row_number);
    if (stripResult.warning) {
      fullAnswerWarnings.push(stripResult.warning);
    }
    strippedRows.push({ row_number: row.row_number, entry: stripResult.entry });
  }

  // --- Step 4: Row-level validation on stripped entries ---
  const seenIds = new Set<string>();
  const validRows: Array<{ row_number: number; entry: RawImportEntry }> = [];
  const invalidEntries: Array<{ row_number: number; issues: ImportValidationIssue[] }> = [];

  for (const row of strippedRows) {
    const result = validateRow(row.entry, row.row_number, seenIds);
    if (result.valid) {
      validRows.push(row);
    } else {
      invalidEntries.push({ row_number: row.row_number, issues: result.issues });
    }
    // Row warnings (like parent_prompt_id not in batch) become general warnings
    for (const w of result.warnings) {
      allWarnings.push(w);
    }
  }

  // --- Step 5: Normalize valid rows ---
  const normalizedEntries: PromptLogEntry[] = validRows.map((row) =>
    normalizePromptLog(row.entry, batchId),
  );

  // --- Step 6: Safety handoff ---
  const safetyResult = safetyAdapter.scan(normalizedEntries);

  // --- Step 7: Cross-batch duplicate check (optional) ---
  if (input.storage_port && normalizedEntries.length > 0) {
    const ids = normalizedEntries.map((e) => e.id);
    const duplicateIds = await input.storage_port.checkDuplicateIds(ids);
    if (duplicateIds.length > 0) {
      allWarnings.push({
        row_number: null,
        warning_type: 'cross_batch_duplicate_ids',
        message: `${duplicateIds.length} entry ID(s) already exist in storage from a previous import.`,
      });
    }
  }

  // --- Build batch metadata ---
  const totalWarnings = allWarnings.length + fullAnswerWarnings.length + safetyResult.warnings.length;
  const batch = makeBatch(
    batchId,
    input,
    parseResult.rows.length,
    normalizedEntries.length,
    invalidEntries.length,
    totalWarnings,
    createdAt,
  );

  return assemblePreview({
    batch,
    valid_entries: normalizedEntries,
    invalid_entries: invalidEntries,
    warnings: allWarnings,
    full_answer_warnings: fullAnswerWarnings,
    safety_warnings: safetyResult,
  });
}

/**
 * Commit a confirmed import preview to storage.
 *
 * Only valid entries from the preview are saved.
 * Requires a StorageHandoffPort implementation.
 */
export async function commitImportPreview(
  preview: ImportPreview,
  storagePort: StorageHandoffPort,
): Promise<ImporterResult> {
  const result = await storagePort.saveImportBatch(preview.batch, preview.valid_entries);

  return {
    success: result.success,
    batch: preview.batch,
    entries: result.success ? preview.valid_entries : [],
    errors: result.success
      ? []
      : [
          {
            row_number: 0,
            field: '_storage',
            issue_type: 'invalid_value' as const,
            message: result.error ?? 'Storage save failed.',
            suggestion: null,
          },
        ],
    warnings: preview.warnings,
  };
}

// --- Internal helpers ---

interface ParsedRows {
  rows: Array<{ row_number: number; entry: RawImportEntry }>;
  parseIssues: ImportValidationIssue[];
  headers?: string[];
}

/** Parse input based on source type. */
function parseInput(input: BuildImportPreviewInput): ParsedRows {
  if (input.source_type === 'demo') {
    const demoEntries = loadDemoDataset();
    return {
      rows: demoEntries.map((entry, i) => ({ row_number: i + 1, entry })),
      parseIssues: [],
    };
  }

  const content = input.content ?? '';

  if (input.source_type === 'jsonl') {
    const result = parseJsonl(content);
    return {
      rows: result.rows,
      parseIssues: result.issues.map((issue) => ({
        row_number: issue.row_number,
        field: '_parse',
        issue_type: 'invalid_value' as const,
        message: issue.message,
        suggestion: 'Fix the JSON syntax on this line.',
      })),
    };
  }

  // csv
  const result = parseCsv(content);
  return {
    rows: result.rows,
    parseIssues: result.issues.map((issue) => ({
      row_number: issue.row_number,
      field: '_parse',
      issue_type: 'invalid_value' as const,
      message: issue.message,
      suggestion: 'Fix the CSV formatting on this row.',
    })),
    headers: result.headers,
  };
}

/** Run file-level validation. */
function runFileValidation(
  input: BuildImportPreviewInput,
  parseResult: ParsedRows,
): { valid: boolean; errors: string[]; warnings: ImportWarning[] } {
  if (input.source_type === 'demo') {
    // Demo always passes file validation
    return { valid: true, errors: [], warnings: [] };
  }

  const fileExtension = input.source_type === 'jsonl' ? '.jsonl' : '.csv';

  return validateFile({
    file_size_bytes: input.file_size_bytes,
    file_extension: fileExtension,
    rows: parseResult.rows,
    parse_issue_count: parseResult.parseIssues.length,
    headers: parseResult.headers,
  });
}

/** Create an ImportBatch object. */
function makeBatch(
  id: string,
  input: BuildImportPreviewInput,
  totalRows: number,
  validRows: number,
  invalidRows: number,
  warningsCount: number,
  createdAt: string,
): ImportBatch {
  return {
    id,
    source_type: input.source_type,
    source_filename: input.source_filename ?? null,
    total_rows: totalRows,
    valid_rows: validRows,
    invalid_rows: invalidRows,
    warnings_count: warningsCount,
    created_at: createdAt,
  };
}
