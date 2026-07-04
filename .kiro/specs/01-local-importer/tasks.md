# 01-local-importer Tasks

## Task Planning Notes

This file breaks the approved requirements and design into implementation tasks.

Rules:

- Tasks must be completed only after human review.
- Early implementation should be task-by-task.
- Do not use parallel execution unless the task dependencies clearly allow it and the user approves.
- No task may introduce cloud upload, full model answer storage, auth, Supabase, browser extension capture, API wrapper capture, VS Code/Kiro extension capture, billing, or team features.
- After completing meaningful work, update `HANDOFF.md` and `CHANGELOG.md`.

---

## Dependency Waves

| Wave | Focus | Sequential? |
|------|-------|-------------|
| 0 | Project scaffolding / import module structure | Yes (first) |
| 1 | Types and data contracts | Yes (after Wave 0) |
| 2 | Parser modules | After Wave 1; JSONL and CSV parsers may be parallel |
| 3 | Validation modules | After Wave 1; file and row validators may be parallel |
| 4 | Normalization, full-answer stripping, hashing | After Waves 1–3 |
| 5 | Demo dataset and fixtures | After Wave 2 (needs parser contracts) |
| 6 | Safety handoff stub and storage handoff port | After Wave 1 |
| 7 | Preview builder and import controller | After Waves 2–6 |
| 8 | Tests and verification | After relevant implementation waves |
| 9 | Documentation / project memory closeout | After all implementation |

Waves 0 and 1 must be strictly sequential (foundation).
Waves 2, 3, 5, 6 may have internal parallelism after Wave 1 is complete.
Waves 7 and 8 depend on prior waves.
Wave 9 depends on all others.

---

## Wave 0 — Project Scaffolding

### Task 0.1 — Create importer module folder structure

- **Role**: implementation
- **Depends on**: none
- **Files likely touched**: `src/importers/`, `src/importers/local/`, `src/importers/local/index.ts`
- **Goal**: Create a clean module boundary for local importer code. Export barrel file.
- **Acceptance**:
  - Folder structure exists.
  - No parser/validator logic yet unless needed for type exports.
  - No production behavior beyond empty structure.
  - No cloud/auth/storage/scoring code.
- **Notes**: Keep it minimal. This is scaffolding only.

### Task 0.2 — Create importer test fixture folder structure

- **Role**: test
- **Depends on**: none
- **Files likely touched**: `fixtures/importer/`, `tests/importers/`
- **Goal**: Prepare locations for JSONL/CSV/demo fixtures and importer tests.
- **Acceptance**:
  - Fixture folder exists.
  - Test folder exists.
  - No real private prompts or secrets in any files.
- **Notes**: Actual fixture content comes in Wave 5.

---

## Wave 1 — Types and Data Contracts

### Task 1.1 — Define importer data contract types

- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/importers/local/types.ts`
- **Goal**: Define `RawImportEntry`, `PromptLogEntry`, `ImportBatch`, `ImportPreview`, `ImportValidationIssue`, `ImportWarning`, `FullAnswerFieldWarning`, `SafetyHandoffResult`, `ImporterResult`.
- **Acceptance**:
  - Types match `design.md` section 6 exactly.
  - `PromptLogEntry` does not include full model answer fields.
  - Optional fields are nullable as designed.
  - `tags` is `string[]` (defaults to `[]`).
  - `import_batch_id` is included in `PromptLogEntry`.
- **Notes**: These are the contracts other tasks depend on. Get them right first.

### Task 1.2 — Centralize banned full-answer field names

- **Role**: privacy-review
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/constants.ts`
- **Goal**: Document and export banned full-answer field names as a constant array.
- **Acceptance**:
  - List includes: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`.
  - Matching should be case-insensitive in later usage.
  - No storage or network code.
- **Notes**: Privacy-critical. This list drives the stripping logic in Wave 4.

---

## Wave 2 — Parser Modules

### Task 2.1 — Implement JSONL parser

- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/parsers/jsonl-parser.ts`
- **Goal**: Parse one JSON object per line into `RawImportEntry` objects. Report line-numbered parse errors.
- **Acceptance**:
  - Valid JSON lines produce `RawImportEntry` objects.
  - Empty lines are skipped silently.
  - Malformed lines produce errors with 1-indexed line numbers.
  - Parser does not validate field semantics.
  - Parser does not access storage or network.
- **Notes**: Keep parsing and validation separate.

### Task 2.2 — Implement CSV parser

- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/parsers/csv-parser.ts`
- **Goal**: Parse comma-delimited CSV with header row into `RawImportEntry` objects. Handle RFC 4180 quoting.
- **Acceptance**:
  - Header row is required; column names map to field names (case-insensitive, trimmed).
  - Comma-delimited only.
  - Quoted fields with commas, newlines, and `""` escaping are handled.
  - Row numbers are 1-indexed (header = row 1).
  - Parser does not validate field semantics.
  - Parser does not access storage or network.
- **Notes**: Use a well-tested CSV library if one fits, or implement per RFC 4180.

---

## Wave 3 — Validation Modules

### Task 3.1 — Implement file-level validator

- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/validators/file-validator.ts`
- **Goal**: Validate file-level concerns before row parsing.
- **Acceptance**:
  - Rejects empty files (clear error).
  - Rejects files > 50 MB (clear error with limit stated).
  - Rejects unsupported extensions (not `.jsonl` or `.csv`).
  - For CSV: rejects files with no header or no recognized columns.
  - No network behavior.
  - No row-level validation.
- **Notes**: Keep file validation fast and separate from row parsing.

### Task 3.2 — Implement row-level validator

- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/validators/row-validator.ts`
- **Goal**: Validate a single `RawImportEntry` against the schema. Track seen IDs for duplicate detection.
- **Acceptance**:
  - Missing required fields (`id`, `timestamp`, `source`, `provider`, `model_used`, `prompt_text`) → error.
  - Non-ISO 8601 `timestamp` → error with format suggestion.
  - Negative `input_tokens`, `output_tokens`, `total_tokens` → error.
  - `user_rating` not integer 1–5 (when present) → error.
  - `solved_status` not in `["solved", "unsolved", "partial"]` (when present) → error.
  - `follow_up_index` not non-negative integer (when present) → error.
  - Duplicate `id` within batch → error.
  - `parent_prompt_id` referencing absent ID in batch → warning (not rejection).
  - Validator does not perform safety detection or storage lookup.
- **Notes**: Each check produces a clear `ImportValidationIssue` with row number, field, message, and suggestion.

---

## Wave 4 — Normalization, Full-Answer Stripping, and Hashing

### Task 4.1 — Implement full model answer field stripper

- **Status**: Completed (2026-07-03)
- **Role**: privacy-review
- **Depends on**: Task 1.2
- **Files likely touched**: `src/importers/local/strippers/full-answer-stripper.ts`
- **Goal**: Detect and remove banned full-answer fields from raw entries. Emit `FullAnswerFieldWarning`.
- **Acceptance**:
  - Banned fields (case-insensitive match) are removed from entry.
  - Warning includes row number and stripped field names.
  - Import continues after stripping (no rejection).
  - Stripped field values are never included in normalized output.
  - No prompt/model answer content is logged.
- **Notes**: This is the V1 privacy enforcement for no-full-answer storage.

### Task 4.2 — Implement prompt hash service

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/services/prompt-hash-service.ts`
- **Goal**: Compute SHA-256 hex hash from `prompt_text` when `prompt_hash` is absent.
- **Acceptance**:
  - Same `prompt_text` always produces same hash.
  - Existing `prompt_hash` is preserved if provided.
  - Does not hash model answers (they are already stripped).
  - Does not mutate unrelated fields.
- **Notes**: Use Node.js `crypto` module or equivalent.

### Task 4.3 — Implement prompt log normalizer

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Tasks 1.1, 4.1, 4.2
- **Files likely touched**: `src/importers/local/normalizer/prompt-log-normalizer.ts`
- **Goal**: Convert validated, stripped raw entries into canonical `PromptLogEntry` shape.
- **Acceptance**:
  - Missing optional fields become `null`.
  - `tags` defaults to `[]` when absent; normalizes CSV comma-string to trimmed array.
  - `import_batch_id` is included on each entry.
  - `redaction_status` defaults to `"none"`.
  - `prompt_hash` is computed when absent.
  - No full model answer fields appear in output.
  - No network calls.
- **Notes**: This is where the raw-to-canonical transformation lives.

---

## Wave 5 — Demo Dataset and Fixtures

### Task 5.1 — Create demo dataset loader

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/demo/demo-dataset-loader.ts`, `src/importers/local/demo/demo-data.ts`
- **Goal**: Provide approximately 20 built-in mock prompt entries for the demo flow.
- **Acceptance**:
  - Includes vague prompts, model overkill, missing context, token waste, privacy-risk-looking examples, and 3–4 strong prompts.
  - Uses `source: "demo"` and `provider: "demo"`.
  - Contains no real secrets, real private prompts, or full model answers.
  - Passes through same validation/normalization pipeline.
- **Notes**: Data should be entertaining but not offensive. Keep it realistic enough to demonstrate scoring later.

### Task 5.2 — Create importer test fixtures

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 2.1, 2.2
- **Files likely touched**: `fixtures/importer/valid.jsonl`, `fixtures/importer/valid.csv`, `fixtures/importer/empty.jsonl`, `fixtures/importer/malformed.jsonl`, `fixtures/importer/malformed.csv`, `fixtures/importer/missing-fields.jsonl`, `fixtures/importer/full-answer-fields.jsonl`, `fixtures/importer/invalid-timestamps.jsonl`, `fixtures/importer/duplicate-ids.jsonl`
- **Goal**: Create fixture files covering valid, invalid, and edge-case scenarios.
- **Acceptance**:
  - Valid JSONL fixture with all required + optional fields.
  - Valid CSV fixture with header and data rows.
  - Empty file fixture.
  - Malformed JSONL (broken JSON on some lines).
  - Malformed CSV (broken quoting).
  - Missing required fields fixture.
  - File with full-answer fields present.
  - Invalid timestamp fixture.
  - Duplicate ID fixture.
  - No real secrets or private data in any fixture.
- **Notes**: These fixtures support Wave 8 tests.

---

## Wave 6 — Safety Handoff Stub and Storage Handoff Port

### Task 6.1 — Implement local safety handoff adapter stub

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/adapters/safety-handoff-adapter.ts`
- **Goal**: Provide an adapter interface and stub for local safety/redaction warnings.
- **Acceptance**:
  - Implements `SafetyHandoffAdapter` interface from design.
  - No cloud calls.
  - No optional AI analysis.
  - Stub can return deterministic warnings for test scenarios.
  - Does not implement full sensitive-data detection (that is the safety module's job).
  - Returns `SafetyHandoffResult`.
- **Notes**: Real detection logic will live in a separate safety module later. This is a stub/interface.

### Task 6.2 — Define storage handoff port interface

- **Status**: Completed (2026-07-03)
- **Role**: schema-review
- **Depends on**: Task 1.1
- **Files likely touched**: `src/importers/local/ports/storage-handoff-port.ts`
- **Goal**: Define the `StorageHandoffPort` interface for future storage layer implementation.
- **Acceptance**:
  - Includes `saveImportBatch(batch, entries)` method signature.
  - Includes `checkDuplicateIds(ids)` method signature.
  - Does NOT implement SQLite or any persistence.
  - Does NOT create migrations.
  - Clearly documents that `02-sqlite-data-layer` owns implementation.
- **Notes**: This is an interface/port only. No concrete storage code.

---

## Wave 7 — Preview Builder and Import Controller

### Task 7.1 — Implement import preview builder

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Tasks 1.1, 3.2, 4.1, 6.1
- **Files likely touched**: `src/importers/local/preview/import-preview-builder.ts`
- **Goal**: Build the `ImportPreview` summary from validated entries, errors, and warnings.
- **Acceptance**:
  - Preview includes total rows, valid rows, invalid rows.
  - Preview includes full-answer field warnings.
  - Preview includes safety warnings from handoff adapter.
  - Preview includes missing metadata summary (tokens, cost, latency, rating counts).
  - Preview does not display full prompt text by default.
  - No silent partial import — preview exposes the choice.
- **Notes**: This is the data structure that will later drive a UI preview screen.

### Task 7.2 — Implement import controller orchestration

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: All of Waves 2–7.1
- **Files likely touched**: `src/importers/local/controller/import-controller.ts`
- **Goal**: Orchestrate the full import flow: source selection → file validation → parsing → stripping → row validation → normalization → safety handoff → preview → storage handoff.
- **Acceptance**:
  - Accepts JSONL file, CSV file, or demo flag.
  - Calls `FileValidator`, appropriate parser, `FullAnswerFieldStripper`, `RowValidator`, `PromptLogNormalizer`, `PromptHashService`, `SafetyHandoffAdapter`, `ImportPreviewBuilder`.
  - Real file imports require preview before storage handoff.
  - Demo may auto-load but still validates.
  - Invalid rows are not silently imported.
  - Returns `ImporterResult`.
  - No network requests.
  - No production storage implementation (uses `StorageHandoffPort`).
- **Notes**: This is the integration point. Keep it thin — delegate to components.

---

## Wave 8 — Tests and Verification

### Task 8.1 — Add parser tests

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 2.1, 2.2, 5.2
- **Files likely touched**: `tests/importers/parsers/jsonl-parser.test.ts`, `tests/importers/parsers/csv-parser.test.ts`
- **Acceptance**:
  - Valid JSONL parses correctly.
  - Malformed JSONL reports line-numbered errors.
  - Valid CSV parses correctly (header mapping, quoting).
  - Malformed CSV reports errors.
  - Empty files are caught by file validation (integration point).

### Task 8.2 — Add validator tests

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 3.1, 3.2, 5.2
- **Files likely touched**: `tests/importers/validators/file-validator.test.ts`, `tests/importers/validators/row-validator.test.ts`
- **Acceptance**:
  - Missing required fields produce correct error.
  - Invalid timestamp produces error with format suggestion.
  - Negative token counts produce error.
  - Invalid rating produces error.
  - Invalid solved_status produces error.
  - Duplicate ID within batch produces error.
  - Parent ID missing in batch produces warning.
  - Empty file produces file-level error.
  - Oversized file produces file-level error.

### Task 8.3 — Add privacy behavior tests

- **Status**: Completed (2026-07-03)
- **Role**: privacy-review
- **Depends on**: Tasks 4.1, 5.2
- **Files likely touched**: `tests/importers/privacy/full-answer-stripper.test.ts`
- **Acceptance**:
  - Full model answer fields are stripped.
  - `FullAnswerFieldWarning` is emitted with correct row and field names.
  - Stripped fields do not appear in normalized output.
  - No model answer content is logged during test execution.
  - Case-insensitive matching works.

### Task 8.4 — Add normalization/hash/tag tests

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 4.2, 4.3, 5.2
- **Files likely touched**: `tests/importers/normalizer/prompt-log-normalizer.test.ts`, `tests/importers/services/prompt-hash-service.test.ts`
- **Acceptance**:
  - Missing optional fields become `null`.
  - Tags normalize from comma-separated string to trimmed array.
  - `prompt_hash` is computed (SHA-256 hex) when absent.
  - Existing `prompt_hash` is preserved.
  - `import_batch_id` is present on all entries.
  - `redaction_status` defaults to `"none"`.

### Task 8.5 — Add preview/controller integration tests

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 7.1, 7.2, 5.2
- **Files likely touched**: `tests/importers/controller/import-controller.test.ts`, `tests/importers/preview/import-preview-builder.test.ts`
- **Acceptance**:
  - Preview counts (total, valid, invalid) are correct.
  - Partial success requires explicit confirmation path.
  - Demo dataset passes through full pipeline without errors.
  - Safety warnings are surfaced in preview.
  - Storage handoff receives only confirmed valid entries.
  - Controller returns `ImporterResult`.

### Task 8.6 — Add no-network and privacy guard tests

- **Status**: Completed (2026-07-03)
- **Role**: privacy-review
- **Depends on**: Tasks 7.2, 6.1
- **Files likely touched**: `tests/importers/privacy/no-network.test.ts`
- **Acceptance**:
  - Import flow does not perform network requests.
  - No cloud upload behavior is introduced.
  - No full prompt text or secrets are printed in test logs by default.
  - Safety handoff is local only.

---

## Wave 9 — Documentation and Project Memory Closeout

### Task 9.1 — Update importer documentation if needed

- **Status**: Completed (2026-07-03)
- **Role**: documentation
- **Depends on**: completed implementation tasks (Waves 0–8)
- **Files likely touched**: `docs/importer.md` (if useful), inline code comments
- **Goal**: Add concise usage/format notes if implementation creates developer-facing behavior worth documenting.
- **Acceptance**:
  - Only create docs if there is actual behavior to document.
  - Keep it brief.

### Task 9.2 — Update project memory and changelog

- **Status**: Completed (2026-07-03)
- **Role**: documentation
- **Depends on**: completed implementation pass
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`
- **Goal**: Record completed work in project memory.
- **Acceptance**:
  - `CHANGELOG.md` records Kiro model, reasoning level, completed outcome, and verification.
  - `HANDOFF.md` reflects current done/not-done state.
  - No planned work is recorded as completed.

---

## Parallelization Guidance

Do not parallelize early implementation until the user approves.

**Safe future parallel candidates** (after shared types in Wave 1 exist):

- Task 2.1 (JSONL parser) and Task 2.2 (CSV parser) — separate files, no shared mutable state.
- Task 3.1 (file validator) and Task 3.2 (row validator) — separate concerns.
- Task 5.1 (demo dataset) and Task 5.2 (test fixtures) — separate output files.
- Task 6.1 (safety stub) and Task 6.2 (storage port) — separate interfaces.
- Documentation updates (Wave 9) after implementation is stable.

**Do not parallelize:**

- Privacy/redaction behavior (Task 4.1, Task 8.3, Task 8.6).
- Storage handoff contract changes and controller orchestration.
- Tasks that edit the same files.
- Controller (Task 7.2) before all its dependencies are stable.
- Any task while its dependencies are incomplete.

---

## Recommended Implementation Order

For manual task-by-task execution:

1. Wave 0 (scaffolding): Task 0.1, Task 0.2
2. Wave 1 (types): Task 1.1, Task 1.2
3. Wave 2 (parsers): Task 2.1, Task 2.2
4. Wave 3 (validators): Task 3.1, Task 3.2
5. Wave 4 (normalization): Task 4.1, Task 4.2, Task 4.3
6. Wave 5 (demo/fixtures): Task 5.1, Task 5.2
7. Wave 6 (stubs/ports): Task 6.1, Task 6.2
8. Wave 7 (preview/controller): Task 7.1, Task 7.2
9. Wave 8 (tests): Task 8.1, Task 8.2, Task 8.3, Task 8.4, Task 8.5, Task 8.6
10. Wave 9 (closeout): Task 9.1, Task 9.2

**Recommended first small implementation pass:**

- Task 0.1 — Create importer module folder structure
- Task 0.2 — Create importer test fixture folder structure
- Task 1.1 — Define importer data contract types
- Task 1.2 — Centralize banned full-answer field names

This gives a stable foundation for all subsequent tasks without requiring complex logic or external dependencies.

No tasks are executed in this pass. Implementation begins after review.
