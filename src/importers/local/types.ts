/**
 * cookedPrompts Local Importer — Data Contract Types
 *
 * These interfaces define the contracts between importer components
 * as specified in .kiro/specs/01-local-importer/design.md section 6.
 *
 * No implementation logic lives here — only type definitions.
 */

/**
 * A loosely-typed key-value map representing one parsed line/row
 * before validation or normalization.
 */
export interface RawImportEntry {
  [key: string]: unknown;
}

/**
 * The canonical normalized prompt log entry.
 * This is the importer's output contract with the storage layer.
 *
 * IMPORTANT: This type must NEVER include full model answer fields.
 * Fields like assistant_message, response, completion, model_answer,
 * output_text, generated_text are banned in V1.
 */
export interface PromptLogEntry {
  // Required
  id: string;
  timestamp: string; // ISO 8601
  source: string;
  provider: string;
  model_used: string;
  prompt_text: string;
  import_batch_id: string;

  // Optional (null when absent, except tags which defaults to [])
  prompt_hash: string | null;
  session_id: string | null;
  follow_up_index: number | null;
  parent_prompt_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  solved_status: 'solved' | 'unsolved' | 'partial' | null;
  user_rating: number | null; // 1-5
  tags: string[]; // empty array when absent
  redaction_status: 'none' | 'partial' | 'full' | null;
}

/**
 * Metadata for a single import operation (batch).
 */
export interface ImportBatch {
  id: string; // UUID v4
  source_type: 'jsonl' | 'csv' | 'demo';
  source_filename: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warnings_count: number;
  created_at: string; // ISO 8601
}

/**
 * Preview summary shown to user before confirming an import.
 */
export interface ImportPreview {
  batch: ImportBatch;
  valid_entries: PromptLogEntry[];
  invalid_entries: { row_number: number; issues: ImportValidationIssue[] }[];
  warnings: ImportWarning[];
  full_answer_warnings: FullAnswerFieldWarning[];
  safety_warnings: SafetyHandoffResult;
  missing_metadata_summary: {
    entries_missing_tokens: number;
    entries_missing_cost: number;
    entries_missing_latency: number;
    entries_missing_rating: number;
  };
}

/**
 * A single validation issue for a specific row.
 */
export interface ImportValidationIssue {
  row_number: number;
  field: string;
  issue_type:
    | 'missing_required'
    | 'invalid_type'
    | 'invalid_value'
    | 'duplicate_id'
    | 'invalid_timestamp';
  message: string;
  suggestion: string | null;
}

/**
 * A general warning (may be file-level or row-level).
 */
export interface ImportWarning {
  row_number: number | null; // null for file-level warnings
  warning_type: string;
  message: string;
}

/**
 * Warning emitted when full model answer fields are stripped from an entry.
 */
export interface FullAnswerFieldWarning {
  row_number: number;
  stripped_fields: string[];
  message: string;
}

/**
 * Result from the local safety/redaction handoff.
 */
export interface SafetyHandoffResult {
  entries_scanned: number;
  warnings: Array<{
    entry_id: string;
    warning_type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

/**
 * Final result of an import operation.
 */
export interface ImporterResult {
  success: boolean;
  batch: ImportBatch;
  entries: PromptLogEntry[]; // only confirmed valid entries
  errors: ImportValidationIssue[];
  warnings: ImportWarning[];
}
