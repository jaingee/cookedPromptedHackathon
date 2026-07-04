# 01-local-importer Design

## 1. Overview

This document defines the technical design for the cookedPrompts local importer. It provides enough detail for `tasks.md` to be created later but does not implement anything.

The importer:

- Parses JSONL, CSV, and demo dataset input.
- Validates input at file level and row level.
- Normalizes entries into a provider-neutral `PromptLogEntry` shape.
- Strips full model answer fields with a warning.
- Computes `prompt_hash` when absent.
- Assigns an `import_batch_id` per operation.
- Prepares a preview summary for user confirmation.
- Hands normalized prompt records to the safety/redaction system.
- Hands confirmed records to the future storage layer.

The importer does NOT:

- Own deep SQLite persistence (that is `02-sqlite-data-layer`).
- Perform full scoring, model recommendation, or rewrite generation.
- Provide dashboard analytics or UI beyond the preview step.
- Make network requests or upload data.

---

## 2. Goals

- Safe local import with no network activity.
- Provider-neutral prompt log normalization.
- Friendly, non-sarcastic validation error messages.
- Mandatory preview-before-commit for real imports.
- Full model answer field stripping (hard privacy rule).
- Local safety/redaction handoff (importer does not own detection logic).
- Future SQLite handoff without coupling to SQLite implementation details.
- Future Supabase/Postgres-friendly data shape (UUID IDs, explicit columns, nullable future fields).

---

## 3. Non-Goals

This design explicitly excludes:

- Production code.
- SQLite schema implementation.
- Deep persistence logic.
- Scoring engine.
- Model recommendation engine.
- Rewrite engine.
- Dashboard implementation.
- Browser/API/VS Code/Kiro extension capture.
- Login/auth.
- Cloud sync.
- Supabase implementation.
- Billing/payments.
- Full sensitive-data detection engine (owned by safety module).

---

## 4. Import Flow

The import operation proceeds through these steps:

1. **Source selection** — User selects a JSONL file, CSV file, or the built-in demo dataset.
2. **Source type identification** — Importer detects format from file extension (`.jsonl`, `.csv`) or demo flag.
3. **File-level validation** — Check file is not empty, is within size limit (50 MB), and is parseable.
4. **Raw parsing** — Parse each line (JSONL) or row (CSV) into raw key-value entries.
5. **Row-level validation** — Validate each entry: required fields, types, ranges, uniqueness.
6. **Normalization** — Convert each valid raw entry into the canonical `PromptLogEntry` shape.
7. **Full model answer stripping** — Detect and remove banned fields; record warnings.
8. **Batch assignment** — Assign or preserve `import_batch_id` for all entries in this operation.
9. **Hash computation** — Compute `prompt_hash` (SHA-256 of `prompt_text`) for entries missing it.
10. **Safety handoff** — Pass normalized entries to local safety/redaction system; receive warnings.
11. **Preview building** — Assemble preview summary with counts, errors, warnings.
12. **User confirmation** — User confirms (proceed with valid rows), cancels, or fixes file.
13. **Storage handoff** — Pass confirmed entries to the future storage layer port.

This flow is not implemented here. It is the design contract for tasks.

---

## 5. Component Design

### ImportController

- **Responsibility**: Orchestrates the full import flow. Accepts user input (file path or demo flag), delegates to parsers/validators, builds preview, waits for confirmation, hands off to storage.
- **Input**: File path + format hint, or demo dataset flag.
- **Output**: `ImporterResult` (success with entries, or failure with errors).
- **Must not**: Perform parsing, validation, or storage directly.

### JsonlParser

- **Responsibility**: Reads a `.jsonl` file line by line, parses each line as JSON.
- **Input**: File contents or readable stream.
- **Output**: Array of `RawImportEntry` objects, plus parse errors with line numbers.
- **Must not**: Validate field semantics, normalize data, or access storage.

### CsvParser

- **Responsibility**: Reads a `.csv` file, maps header columns to field names, parses rows.
- **Input**: File contents or readable stream.
- **Output**: Array of `RawImportEntry` objects, plus parse errors with row numbers.
- **Must not**: Validate field semantics beyond CSV structure. Must handle RFC 4180 quoting.

### DemoDatasetLoader

- **Responsibility**: Provides approximately 20 built-in mock prompt entries.
- **Input**: None (or a demo flag).
- **Output**: Array of `RawImportEntry` objects representing the demo dataset.
- **Must not**: Contain real secrets, real private prompts, or full model answers.

### FileValidator

- **Responsibility**: Performs file-level checks before row parsing begins.
- **Input**: File metadata (size, extension, initial bytes).
- **Output**: Pass/fail with file-level error messages.
- **Checks**: Empty file, exceeds 50 MB, unrecognized extension, unparseable structure.
- **Must not**: Parse individual rows or perform row validation.

### RowValidator

- **Responsibility**: Validates a single `RawImportEntry` against the schema.
- **Input**: One `RawImportEntry` plus the set of IDs seen so far in this batch.
- **Output**: Pass (valid entry) or fail (list of `ImportValidationIssue`).
- **Checks**: Required fields present, correct types, ISO 8601 timestamp, non-negative integers, valid `solved_status`/`user_rating` values, unique `id` within batch.
- **Must not**: Access storage, perform safety checks, or normalize data.

### PromptLogNormalizer

- **Responsibility**: Converts a validated `RawImportEntry` into the canonical `PromptLogEntry` shape.
- **Input**: One validated `RawImportEntry`.
- **Output**: One `PromptLogEntry` with consistent field names, correct types, and `null` for missing optionals.
- **Must not**: Perform validation (already done), access storage, or make network calls.

### FullAnswerFieldStripper

- **Responsibility**: Detects and removes full model answer fields from raw entries.
- **Input**: One `RawImportEntry`.
- **Output**: Cleaned entry plus a `FullAnswerFieldWarning` if any fields were stripped.
- **Detection targets**: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`.
- **Must not**: Block import. Must strip and warn only.

### PromptHashService

- **Responsibility**: Computes `prompt_hash` for entries where it is absent.
- **Input**: `prompt_text` string.
- **Output**: SHA-256 hex string.
- **Must not**: Modify other fields or access storage.

### ImportPreviewBuilder

- **Responsibility**: Assembles the preview summary shown to the user before confirmation.
- **Input**: Validated entries, invalid entries with errors, warnings (full answer, safety, missing metadata, duplicates).
- **Output**: `ImportPreview` object.
- **Must not**: Decide whether to proceed. That is the user's choice.

### SafetyHandoffAdapter

- **Responsibility**: Passes normalized entries to the local safety/redaction system and collects warnings.
- **Input**: Array of `PromptLogEntry`.
- **Output**: `SafetyHandoffResult` with per-entry warnings.
- **Must not**: Implement detection logic itself. Must delegate to the safety module. Must not make network calls.

### StorageHandoffPort

- **Responsibility**: Defines the interface for handing confirmed entries to the storage layer.
- **Input**: Array of confirmed `PromptLogEntry` plus `ImportBatch` metadata.
- **Output**: Success/failure acknowledgment.
- **Must not**: Implement SQLite or any persistence. This is an interface/port only, to be implemented by `02-sqlite-data-layer`.

---

## 6. Data Contracts

### RawImportEntry

A loosely-typed key-value map representing one parsed line/row before validation:

```typescript
interface RawImportEntry {
  [key: string]: unknown;
}
```

### PromptLogEntry

The canonical normalized shape. This is the importer's output contract:

```typescript
interface PromptLogEntry {
  // Required
  id: string;
  timestamp: string;          // ISO 8601
  source: string;
  provider: string;
  model_used: string;
  prompt_text: string;
  import_batch_id: string;

  // Optional (null when absent)
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
  tags: string[];             // empty array when absent
  redaction_status: 'none' | 'partial' | 'full' | null;
}
```

Design notes:
- Missing optional fields become `null` (except `tags` which defaults to `[]`).
- `prompt_hash` is computed as SHA-256 hex of `prompt_text` when absent.
- `import_batch_id` is generated once per import operation (UUID v4).
- Full model answer fields are never present in this shape.

### ImportBatch

```typescript
interface ImportBatch {
  id: string;                 // UUID v4
  source_type: 'jsonl' | 'csv' | 'demo';
  source_filename: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warnings_count: number;
  created_at: string;         // ISO 8601
}
```

### ImportPreview

```typescript
interface ImportPreview {
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
```

### ImportValidationIssue

```typescript
interface ImportValidationIssue {
  row_number: number;
  field: string;
  issue_type: 'missing_required' | 'invalid_type' | 'invalid_value' | 'duplicate_id' | 'invalid_timestamp';
  message: string;
  suggestion: string | null;
}
```

### ImportWarning

```typescript
interface ImportWarning {
  row_number: number | null;  // null for file-level warnings
  warning_type: string;
  message: string;
}
```

### FullAnswerFieldWarning

```typescript
interface FullAnswerFieldWarning {
  row_number: number;
  stripped_fields: string[];
  message: string;
}
```

### SafetyHandoffResult

```typescript
interface SafetyHandoffResult {
  entries_scanned: number;
  warnings: Array<{
    entry_id: string;
    warning_type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}
```

### ImporterResult

```typescript
interface ImporterResult {
  success: boolean;
  batch: ImportBatch;
  entries: PromptLogEntry[];  // only confirmed entries
  errors: ImportValidationIssue[];
  warnings: ImportWarning[];
}
```

---

## 7. JSONL Design

- Each line is one JSON object.
- Empty lines are skipped silently.
- Lines that fail JSON parsing produce a row-level error with the line number.
- Each parsed object is treated as a `RawImportEntry` and passed to row validation.
- Required fields are checked per FR-4.
- Optional fields are extracted if present; missing ones become `null`.
- Unknown fields that are not in the banned full-answer list are silently ignored.
- Full-answer fields are stripped before normalization.
- Line numbers in errors are 1-indexed.

---

## 8. CSV Design

- First row is the header. Column names must match provider-neutral field names (case-insensitive, trimmed).
- Comma-delimited only in V1. No semicolons or tabs.
- Quoting follows RFC 4180: fields containing commas, newlines, or double quotes must be enclosed in double quotes; embedded double quotes are escaped as `""`.
- `tags` field in CSV is a comma-separated string within a quoted field (e.g., `"coding,urgent,followup"`). The normalizer splits on comma and trims.
- Columns not in the known schema are silently ignored (unless they match banned full-answer field names, in which case a warning is issued).
- Missing optional columns (entire column absent from header) mean all rows get `null` for that field.
- Row numbers in errors are 1-indexed (header is row 1, first data row is row 2).

---

## 9. Demo Dataset Design

- The demo dataset is a hard-coded array of approximately 20 `RawImportEntry` objects embedded in the application source.
- It passes through the same validation and normalization pipeline as real imports.
- The demo includes:
  - Vague prompts (low clarity scores when scored later).
  - Model overkill (deep reasoning model for a simple question).
  - Missing context (no constraints, no output format).
  - Privacy-risk examples (prompt text mentioning an API key pattern).
  - Token-waste examples (very long prompt for trivial task).
  - At least 3–4 well-structured prompts (for contrast).
- Demo data must not contain real secrets, real private prompts, or full model answers.
- Demo may auto-load (skipping user file selection) but still runs through validation/normalization.
- The demo uses `source: "demo"` and `provider: "demo"`.

---

## 10. Validation Design

### File-Level Validation

Runs before any row parsing:

| Check | Error if |
|-------|----------|
| File is empty | 0 bytes |
| File exceeds size limit | > 50 MB |
| File extension unrecognized | Not `.jsonl` or `.csv` (unless demo) |
| JSONL: first line not valid JSON | Cannot parse line 1 as JSON |
| CSV: no header row | File has 0 rows or header is empty |
| CSV: no recognized columns | Header contains no known field names |

### Row-Level Validation

Runs per-entry after parsing:

| Check | Severity | Rule |
|-------|----------|------|
| Required field missing | Error | `id`, `timestamp`, `source`, `provider`, `model_used`, `prompt_text` must be non-null non-empty strings |
| Invalid timestamp | Error | Must parse as ISO 8601 |
| Negative token count | Error | `input_tokens`, `output_tokens`, `total_tokens` must be >= 0 if present |
| Invalid `user_rating` | Error | Must be integer 1–5 if present |
| Invalid `solved_status` | Error | Must be "solved", "unsolved", or "partial" if present |
| Duplicate `id` within batch | Error | Each `id` must be unique within the current import |
| `follow_up_index` not integer | Error | Must be non-negative integer if present |
| `parent_prompt_id` not in batch | Warning | References an ID not found in this batch |

### Warning-Level Checks

| Check | Level |
|-------|-------|
| Full model answer field present | Warning (field stripped) |
| Safety system flags sensitive content | Warning (surfaced in preview) |
| Missing optional metadata (tokens, cost, latency) | Info (summarized in preview) |

---

## 11. Full Model Answer Field Behavior

**V1 design decision**: Strip and warn. Do not reject the file or the row.

Banned field names (case-insensitive match):

- `assistant_message`
- `response`
- `completion`
- `model_answer`
- `output_text`
- `generated_text`

Behavior:

1. During raw entry processing (after parsing, before validation), scan each entry's keys for banned field names.
2. If found, remove the field from the entry.
3. Record a `FullAnswerFieldWarning` with the row number and field names stripped.
4. Continue processing the entry normally.
5. Surface all such warnings in the import preview.
6. Never include banned fields in normalized output.

Warning message template:

> "This file includes model answer fields ({field_names}). cookedPrompts V1 does not store full model answers, so these fields were ignored."

---

## 12. Safety/Redaction Handoff Design

- The importer does not implement full sensitive-data detection.
- After normalization, the importer passes all `PromptLogEntry` objects to the `SafetyHandoffAdapter`.
- The adapter calls the local safety/redaction module (which may be a stub in early implementation).
- The safety module returns per-entry warnings (type, severity, message).
- The importer includes these warnings in the `ImportPreview`.
- No cloud calls are made during this handoff. All analysis is local.
- No optional AI analysis is triggered during import. AI-assisted analysis (if ever added) runs after import, after redaction, and only when explicitly configured.
- The importer sets `redaction_status: "none"` on all entries. The safety module or later process updates this field.

---

## 13. Preview Design

The preview is mandatory for real file imports. The demo dataset may auto-load but still validates.

Preview displays:

- **Total rows**: count of parsed lines/rows.
- **Valid rows**: count ready for import.
- **Invalid rows**: count with validation errors.
- **Warnings**:
  - Full answer fields stripped (count and field names).
  - Sensitive-data warnings from safety handoff (count and summaries).
  - Missing optional metadata (how many entries lack tokens/cost/latency).
  - Duplicate ID warnings (within batch).
- **Error details**: per-row error list with line number, field, message, suggestion.

User actions from preview:

- **Cancel import** — nothing is stored.
- **Proceed with valid rows** — only valid entries are handed to storage.
- **Fix file and re-import** — user exits, fixes file, starts again.

There is no silent partial import. The user must explicitly choose to proceed.

---

## 14. Partial Success Design

**V1 design decision**: Require explicit user confirmation before importing valid rows when some rows failed.

Rules:

- If all rows are valid: preview shows summary, user confirms, storage handoff proceeds.
- If some rows are invalid: preview shows valid count, invalid count, error details. User must choose:
  - "Import valid rows only" — confirmed valid entries go to storage.
  - "Cancel" — nothing is stored.
- If all rows are invalid: preview shows errors only. No import option available except "Fix file."
- Invalid rows are never silently dropped.

---

## 15. Storage Handoff Design

- `01-local-importer` does not implement SQLite or any persistence.
- The importer outputs validated, normalized `PromptLogEntry` records and an `ImportBatch` object.
- The `StorageHandoffPort` interface defines the contract:

```typescript
interface StorageHandoffPort {
  saveImportBatch(batch: ImportBatch, entries: PromptLogEntry[]): Promise<{ success: boolean; error?: string }>;
  checkDuplicateIds(ids: string[]): Promise<string[]>; // returns IDs that already exist
}
```

- `02-sqlite-data-layer` will implement this interface.
- For early tasks (before storage is built), the port can be stubbed with a no-op or in-memory implementation.
- Duplicate ID detection across batches uses `checkDuplicateIds`. The importer calls this during preview if the port is available. If the port is not yet implemented, cross-batch duplicate detection is skipped with a note.

---

## 16. Error and Warning Copy

Import error messages are **clear, calm, and practical**. No roasting during import.

Roast language belongs to dashboard feedback after scoring — never to import validation.

Example error messages:

- "Row 12 is missing `prompt_text`. Add the original user prompt before importing."
- "Row 5 has an invalid timestamp: '2024-13-45'. Use ISO 8601 format (e.g., 2024-06-15T10:30:00Z)."
- "Row 8 has a negative `input_tokens` value (-50). Token counts must be zero or positive."
- "Row 3 has a duplicate `id` (abc-123). Each entry needs a unique ID within this import."

Example warning messages:

- "This file includes model answer fields (response, completion). cookedPrompts V1 does not store full model answers, so these fields were ignored."
- "3 prompts may contain sensitive data. Review them in the preview before proceeding."
- "12 entries are missing token count metadata. They will import fine, but cost analysis will be limited."

---

## 17. Privacy and Security Considerations

- The importer is entirely local. Zero network requests during any operation.
- No cloud upload. No telemetry. No analytics calls.
- No full model answer storage. Banned fields are stripped before normalization.
- No secret printing in logs. Debug/error logs must not dump full `prompt_text`.
- Internal logging should summarize counts and issue types only.
- RTK must not be used to inspect raw private prompt logs or `.env` files.
- Import preview does not display full prompt text by default — only metadata summaries.
- The safety handoff is local. No remote AI analysis during import.

---

## 18. Testing Strategy (for future tasks)

Do not create tests now. Future tasks should cover these test categories:

- **Valid JSONL**: All required fields present, optional fields present/absent. Expect full successful parse.
- **Valid CSV**: Correct header, all required fields, tags as quoted comma string. Expect full successful parse.
- **Empty file**: Expect file-level error.
- **Malformed JSONL**: Invalid JSON on some lines. Expect row-level errors with line numbers.
- **Malformed CSV**: Missing header, broken quoting. Expect file-level or row-level errors.
- **Missing required fields**: Rows lacking `id`, `timestamp`, etc. Expect specific validation errors.
- **Missing optional fields**: Rows without tokens/cost/latency. Expect `null` in output, no errors.
- **Full model answer fields stripped**: Entries with `response`, `completion`, etc. Expect stripped output and warning.
- **Prompt hash computed**: Entries without `prompt_hash`. Expect SHA-256 hex in output.
- **Tags normalized**: CSV tags as comma-separated string. Expect array output.
- **Partial success preview**: Mix of valid/invalid rows. Expect preview with counts and error details.
- **Safety warning handoff stub**: Mock safety module returns warnings. Expect them in preview.
- **No network behavior**: Confirm zero outbound requests during import.
- **Demo dataset validation**: Demo loads through same pipeline, all entries pass.
- **Duplicate ID within batch**: Expect validation error.
- **Invalid timestamps**: Non-ISO strings. Expect error with format suggestion.
- **Negative tokens**: Expect validation error.
- **Invalid user_rating**: Values outside 1–5. Expect validation error.

---

## 19. Design Decisions from Open Questions

These requirements open questions are resolved as design decisions:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Full model answer fields | Strip and warn. Do not reject file or row. | Least disruptive; user still gets valid data. Aligns with PSR-1. |
| CSV delimiter | Comma-only in V1. | Simplicity. Future versions can add configurable delimiters. |
| Preview mandatory | Yes, for real imports. Demo may auto-load but still validates. | Prevents accidental data corruption. |
| Prompt hash | Compute SHA-256 automatically when absent. | Supports deduplication without requiring users to pre-compute. |
| Partial import | Require explicit user choice in preview. No silent partial. | User must consent to incomplete imports. |
| Duplicate IDs within batch | Row-level validation error. | Prevents ambiguity in storage. |
| Duplicate IDs across batches | Storage-layer lookup concern via `StorageHandoffPort.checkDuplicateIds`. Importer surfaces warning if port is available. | Avoids coupling importer to storage implementation. |
| File size limit | 50 MB provisional V1 limit. | Prevents memory issues. Can be raised later. |
| Timestamp parsing | Strict ISO 8601 only in V1. | Avoids ambiguity. Clear error message suggests format. |

No conflicts with requirements or steering were found.

---

## 20. Implementation Notes for Future Tasks

Likely task boundaries when `tasks.md` is created:

1. **Parser tasks**: `JsonlParser`, `CsvParser` — each as a separate module with its own tests.
2. **Validator tasks**: `FileValidator`, `RowValidator` — file-level and row-level as separate units.
3. **Normalizer tasks**: `PromptLogNormalizer` — conversion from raw to canonical shape.
4. **Full-answer stripper tasks**: `FullAnswerFieldStripper` — detection and removal logic.
5. **Hash service tasks**: `PromptHashService` — SHA-256 computation.
6. **Preview builder tasks**: `ImportPreviewBuilder` — assembles the preview summary.
7. **Demo fixture tasks**: `DemoDatasetLoader` — create the ~20 mock entries.
8. **Safety handoff stub tasks**: `SafetyHandoffAdapter` — stub implementation that can later delegate to the real safety module.
9. **Storage port tasks**: `StorageHandoffPort` — interface definition only (no implementation).
10. **Controller tasks**: `ImportController` — orchestration logic tying all components together.
11. **Test fixture tasks**: Create test data files (valid JSONL, valid CSV, malformed variants, edge cases).

Each task should be small, reviewable, and independently testable. Do not combine parsing, validation, and normalization into one task.
