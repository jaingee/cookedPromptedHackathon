# 01-local-importer Requirements

## Overview

This spec defines how cookedPrompts imports prompt logs from JSONL and CSV files, validates them safely, and produces a normalized internal shape ready for the storage layer.

The importer is the entry point for all prompt data in V1. Without import, there is nothing to analyze, score, or roast.

---

## User Stories

### US-1: JSONL Import

As a prompt-heavy user, I want to import a JSONL file of my prompt history so that cookedPrompts can analyze my AI habits.

### US-2: CSV Import

As a user who exports prompt logs from spreadsheets or other tools, I want to import a CSV file so that I can use cookedPrompts without converting formats manually.

### US-3: Demo Dataset

As a new user exploring cookedPrompts, I want to load a built-in demo dataset ("20 Prompts Later: Your AI Habits Exposed") so that I can see how the product works without providing my own data.

### US-4: Validation Feedback

As a user importing prompt logs, I want to see clear validation errors before any data is committed so that I can fix my file and re-import without data corruption.

### US-5: Full Model Answer Warning

As a privacy-conscious user, I want to be warned when my imported file appears to include full model answers so that I understand those fields will not be stored in V1.

### US-6: Sensitive Data Warning

As a user who may accidentally include secrets in prompt logs, I want the importer to flag prompts that may contain sensitive data so that I can decide whether to redact them before analysis.

### US-7: Normalized Output for Downstream Systems

As the storage layer (02-sqlite-data-layer), I want to receive normalized, validated prompt log records from the importer so that I can persist them without re-parsing or re-validating.

---

## Functional Requirements

### FR-1: JSONL Import

- The importer shall accept `.jsonl` files where each line is a valid JSON object representing one prompt log entry.
- Each JSON object must conform to the provider-neutral prompt log schema defined below.
- The importer shall reject files that are not valid JSONL (not one JSON object per line).
- Empty files shall be rejected with a clear error message.

### FR-2: CSV Import

- The importer shall accept `.csv` files with a header row followed by data rows.
- Column names must map to the provider-neutral prompt log field names.
- The importer shall support comma-delimited CSV. Other delimiters are an open question.
- The importer shall handle quoted fields containing commas, newlines, and escaped quotes per RFC 4180.
- Empty files (no header or no data rows) shall be rejected with a clear error message.

### FR-3: Demo Dataset Import

- The importer shall provide a built-in mock dataset of approximately 20 prompt log entries.
- The demo dataset should represent a variety of prompt quality issues: vague prompts, model overkill, token waste, safety risks, and good prompts.
- Loading the demo dataset shall use the same validation and normalization pipeline as real imports.

### FR-4: Required Fields

The following fields are required or strongly recommended for each prompt log entry:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Required | Unique identifier per entry. UUID or string. |
| `timestamp` | Required | ISO 8601 format preferred. |
| `source` | Required | Where the log was exported from (e.g., "chatgpt-export", "claude-export", "manual"). |
| `provider` | Required | AI provider name (e.g., "openai", "anthropic", "google", "local"). |
| `model_used` | Required | Model identifier string. Provider-neutral. |
| `prompt_text` | Required | The user's prompt content. |

### FR-5: Optional Fields

The following fields are optional. Missing optional fields shall not cause validation failure:

| Field | Notes |
|-------|-------|
| `prompt_hash` | SHA-256 or similar hash of prompt_text. May be computed by importer if absent. |
| `session_id` | Groups prompts within one conversation session. |
| `follow_up_index` | Integer position within a session (0-indexed). |
| `parent_prompt_id` | ID of the preceding prompt in a follow-up chain. |
| `input_tokens` | Integer token count for the prompt. |
| `output_tokens` | Integer token count for the model response. |
| `total_tokens` | Integer sum of input + output tokens. |
| `estimated_cost` | Numeric cost estimate in USD or smallest currency unit. |
| `latency_ms` | Integer response latency in milliseconds. |
| `solved_status` | String: "solved", "unsolved", "partial", or null. |
| `user_rating` | Integer 1–5 or null. |
| `tags` | Array of strings or comma-separated string. |
| `redaction_status` | String: "none", "partial", "full", or null. |

### FR-6: Provider-Neutral Log Shape

- The importer shall normalize all imported entries into a single internal `PromptLogEntry` shape regardless of source format (JSONL or CSV).
- Field names shall be consistent and snake_case.
- The normalized shape shall be the contract between the importer and the storage layer.

### FR-7: Import Batch Tracking

- Each import operation shall be assigned an `import_batch_id`.
- All entries imported in a single operation share the same `import_batch_id`.
- The batch ID allows the storage layer to group, query, or roll back imports.

### FR-8: Row-Level Validation

- Each row/entry shall be validated independently.
- Validation errors for one row shall not prevent other valid rows from being processed (subject to partial-success handling rules).
- Row-level validation shall check:
  - Presence of required fields.
  - Data types (string, integer, ISO timestamp, array).
  - Reasonable value ranges where applicable (e.g., token counts must be non-negative integers).
  - `id` uniqueness within the import batch.

### FR-9: File-Level Validation

- The importer shall validate file-level concerns before processing rows:
  - File is not empty.
  - File is parseable as JSONL or CSV.
  - CSV has a valid header row with recognizable field names.
  - File size is within a reasonable limit (exact limit is an open question; suggest a default of 50 MB).

### FR-10: Friendly Error Messages

- All validation errors shall include:
  - The row number or line number where the error occurred (if row-level).
  - The field name that failed validation.
  - A plain-language description of what went wrong.
  - A suggestion for how to fix it where practical.
- Error messages shall not be sarcastic. Save the roasting for the dashboard.

### FR-11: Preview Before Commit

- The importer shall support a preview step that shows the user:
  - Total rows detected.
  - Number of valid rows.
  - Number of invalid rows (with error summaries).
  - Any warnings (sensitive data, full model answers, missing optional fields).
- The user must confirm before validated data is handed off to the storage layer.

### FR-12: Partial Success Handling

- If some rows fail validation, the importer shall:
  - Report which rows failed and why.
  - Allow the user to proceed with valid rows only, or cancel the entire import.
- The exact UX (proceed vs. cancel) is a preview-step interaction.

### FR-13: Duplicate Prompt ID Handling

- If an imported entry has an `id` that already exists in a previous import batch, the importer shall:
  - Detect the duplicate during preview.
  - Warn the user.
  - Allow the user to skip duplicates or overwrite (exact behavior is an open question for design).

### FR-14: Missing Token/Cost/Latency Fields

- Missing `input_tokens`, `output_tokens`, `total_tokens`, `estimated_cost`, and `latency_ms` shall not cause validation failure.
- These fields shall be set to `null` in the normalized output when absent.
- The dashboard/scoring system may later flag prompts with missing metadata separately.

### FR-15: Malformed Timestamps

- Timestamps that cannot be parsed as valid ISO 8601 shall cause a row-level validation error.
- The error message shall suggest the expected format (ISO 8601).

### FR-16: Invalid Model/Provider/Source Values

- The importer shall not enforce a fixed allowlist of `model_used`, `provider`, or `source` values in V1.
- Any non-empty string is accepted.
- Empty or null values for these required fields shall cause a validation error.

### FR-17: Tags Handling

- `tags` may be provided as a JSON array of strings (in JSONL) or as a comma-separated string (in CSV).
- The importer shall normalize tags to an array of trimmed, non-empty strings.
- Empty tags arrays are valid.

### FR-18: Follow-Up Prompts and Parent Prompt IDs

- `follow_up_index` and `parent_prompt_id` are optional.
- If `parent_prompt_id` is provided, it should reference another prompt's `id`.
- The importer shall not enforce referential integrity across import batches in V1 (the referenced parent may have been imported earlier).
- Within a single import batch, if `parent_prompt_id` references an `id` not present in the batch, the importer shall issue a warning but not reject the row.

### FR-19: Normalized Internal Output

- The importer's final output shall be an array of `PromptLogEntry` objects conforming to the provider-neutral schema.
- Each entry shall include all required fields and any provided optional fields.
- Missing optional fields shall be explicitly set to `null`.
- The output includes the `import_batch_id` for each entry.
- The output is ready for handoff to the storage layer without further transformation.

### FR-20: Full Model Answer Field Rejection

- If imported data contains fields that appear to hold full model answers (e.g., `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`), the importer shall:
  - Detect these fields.
  - Strip them from the normalized output.
  - Issue a clear warning to the user explaining that V1 does not store full model answers.
- The import shall proceed with remaining valid fields. The full model answer fields are ignored, not cause for file rejection.

### FR-21: Redaction/Safety Handoff

- After normalization, the importer shall pass prompt entries to the safety/redaction system for local analysis.
- The importer itself does not perform deep sensitive-data detection.
- The importer shall mark each entry's `redaction_status` as `"none"` initially.
- The safety/redaction system will update this field after its analysis.
- The importer shall surface safety warnings returned by the redaction system in the preview step.

---

## Privacy and Safety Requirements

### PSR-1: No Full Model Answer Storage

V1 must not import or store full model answers. If imported files contain full model answer fields, those fields shall be stripped with a clear warning. This is a hard requirement, not a suggestion.

### PSR-2: Prompt Logs Are Private User Data

All imported prompt data shall be treated as private. The importer shall not transmit data to any external service, API, or cloud endpoint.

### PSR-3: No Cloud Upload

The importer shall operate entirely locally in V1. No network requests during import.

### PSR-4: Local Redaction Before Analysis

Safety/redaction checks must run locally before any optional AI-based analysis is performed on the data. The importer hands off to the local safety system, never to a remote service.

### PSR-5: Warn, Do Not Block (with exception)

V1 should warn about sensitive data but not block import — except for the full model answer rule (PSR-1), which is enforced by stripping those fields.

### PSR-6: Safety Handoff Scope

The importer is responsible for:
- Detecting and stripping full model answer fields.
- Passing normalized entries to the safety/redaction system.
- Surfacing safety warnings in the preview step.

The importer is NOT responsible for:
- Implementing the full sensitive-data detection engine.
- Performing regex-based secret scanning.
- Making redaction decisions.

Those responsibilities belong to the safety/redaction module.

---

## Non-Goals

This spec explicitly excludes:

- SQLite schema implementation beyond basic handoff expectations.
- Deep persistence logic (owned by 02-sqlite-data-layer).
- Scoring engine (owned by 03-scoring-engine).
- Model recommendation engine.
- Rewrite generation.
- Dashboard analytics or UI.
- Browser extension capture.
- API wrapper capture.
- VS Code/Kiro extension capture.
- Login/auth.
- Cloud sync.
- Supabase implementation.
- Team features.
- Billing/payments.
- Production code (this is a requirements document only).

---

## Acceptance Criteria

### AC-1: Valid JSONL Import

- Given a valid JSONL file with all required fields present, when the user imports the file, then all rows are parsed, validated, and available in the normalized output.
- The import batch receives a unique `import_batch_id`.

### AC-2: Valid CSV Import

- Given a valid CSV file with a correct header row and all required fields, when the user imports the file, then all rows are parsed, validated, and available in the normalized output.
- Tags are correctly normalized from comma-separated strings to arrays.

### AC-3: Demo Dataset Import

- Given the user selects "Load demo dataset," then approximately 20 prompt entries are loaded through the same validation pipeline and available in the normalized output.
- The demo dataset includes examples of various prompt quality issues.

### AC-4: Invalid File Handling

- Given a file that is not valid JSONL or CSV (binary, corrupted, wrong format), when the user attempts import, then a clear file-level error is shown and no data is processed.
- Given an empty file, then a specific "file is empty" error is shown.

### AC-5: Invalid Row Handling

- Given a JSONL/CSV file where some rows are missing required fields, when the user imports, then:
  - Valid rows are identified.
  - Invalid rows are listed with specific error details (line number, field, description).
  - The user can choose to proceed with valid rows or cancel.

### AC-6: Missing Optional Metadata

- Given rows where optional fields (tokens, cost, latency, rating, tags) are absent, when imported, then those fields are set to `null` in the normalized output and no validation error is raised.

### AC-7: Full Model Answer Field Detection

- Given a JSONL file containing a field named `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, or `generated_text`, when imported, then:
  - The field is stripped from the normalized output.
  - A clear warning is shown explaining V1 does not store full model answers.
  - The rest of the row is imported normally.

### AC-8: Sensitive Data Warning Handoff

- Given imported prompts that may contain API keys or secrets (as determined by the safety system), when the preview step is shown, then safety warnings from the redaction system are surfaced to the user.
- The importer does not perform detection itself; it surfaces results from the safety handoff.

### AC-9: Normalized Output Shape

- All successfully imported entries conform to the `PromptLogEntry` shape with consistent field names, correct types, and `null` for missing optional fields.
- The output includes `import_batch_id` on each entry.

### AC-10: No Cloud Behavior

- The importer performs no network requests during any operation.
- No data leaves the local environment during import.

### AC-11: No Production Code

- This spec does not include production code. Implementation happens after design and tasks are reviewed.

---

## Open Questions

1. **Full model answer field behavior**: Should the importer reject the entire file, reject the row, or strip the field and continue? Current recommendation: strip the field and continue with a warning (reflected in FR-20). Confirm during design review.

2. **CSV delimiter support**: Should V1 support only comma-delimited CSV, or also semicolons and tabs? Current recommendation: comma-only in V1, with a note that future versions may support configurable delimiters.

3. **Preview-before-commit requirement**: Is preview mandatory in V1, or can the first demo skip preview and auto-commit? Current recommendation: preview is mandatory for real imports; the demo dataset may auto-load.

4. **Prompt hash computation**: Should the importer compute `prompt_hash` (SHA-256 of `prompt_text`) when the field is absent, or leave it null? Current recommendation: compute it automatically for deduplication support.

5. **Partial import approval**: When some rows fail validation, should the default be "import valid rows" or "cancel entire import"? Current recommendation: require explicit user choice in the preview step.

6. **Duplicate handling across batches**: When an `id` matches a previously imported entry, should V1 skip, overwrite, or error? Current recommendation: warn in preview and let the user choose. Exact UX to be defined in design.

7. **Maximum file size**: What is the V1 maximum import file size? Suggestion: 50 MB default with a clear error if exceeded.

8. **Timestamp tolerance**: Should the importer attempt to parse non-ISO timestamps (e.g., Unix epochs, locale-specific formats), or strictly require ISO 8601? Current recommendation: strict ISO 8601 only in V1.
