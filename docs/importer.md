# Local Importer

The cookedPrompts local importer parses, validates, and normalizes prompt-log files for later analysis.

## Supported Sources

- **JSONL** — one JSON object per line (`.jsonl`)
- **CSV** — comma-delimited with header row (`.csv`, RFC 4180 quoting)
- **Demo** — built-in ~20 synthetic entries for testing the product

## Required Fields

| Field | Type |
|-------|------|
| `id` | string (unique per entry) |
| `timestamp` | string (ISO 8601) |
| `source` | string |
| `provider` | string |
| `model_used` | string |
| `prompt_text` | string |

## Optional Fields

`prompt_hash`, `session_id`, `follow_up_index`, `parent_prompt_id`, `input_tokens`, `output_tokens`, `total_tokens`, `estimated_cost`, `latency_ms`, `solved_status`, `user_rating`, `tags`, `redaction_status`

Missing optional fields normalize to `null` (except `tags` → `[]`).

## Privacy Rule

V1 does not store full model answers. The following fields are stripped on import:

`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`

Stripped values are never preserved in warnings, logs, previews, or storage payloads.

## Pipeline

1. Parse (JSONL / CSV / demo)
2. File-level validation (size, extension, structure)
3. Strip banned full-answer fields
4. Row-level validation (required fields, types, ranges, duplicates)
5. Normalize + compute `prompt_hash` (SHA-256)
6. Safety handoff (stub in V1)
7. Build preview (counts, warnings, missing metadata)
8. Explicit commit via `StorageHandoffPort` (not called during preview)

## Public API

| Function | Purpose |
|----------|---------|
| `buildImportPreview(input)` | Run full pipeline, return preview |
| `commitImportPreview(preview, storagePort)` | Persist confirmed entries |
| `parseJsonl(content)` | Raw JSONL parsing |
| `parseCsv(content)` | Raw CSV parsing |
| `validateFile(input)` | File-level checks |
| `validateRow(entry, rowNumber, seenIds)` | Row-level checks |
| `stripFullAnswerFields(entry, rowNumber)` | Remove banned fields |
| `normalizePromptLog(entry, batchId)` | Canonical shape |
| `computePromptHash(text)` | SHA-256 hex |
| `loadDemoDataset()` | Synthetic demo entries |
| `StubSafetyHandoffAdapter` | No-op safety stub |

## Test Coverage

- Parser tests (JSONL + CSV)
- Validator tests (file-level + row-level)
- Privacy tests (full-answer stripping, value non-leakage)
- Normalization/hash/tag tests
- Controller/preview integration tests
- No-network/privacy guard tests

10 test files, 95 tests, all passing.

## Non-Goals

- No SQLite implementation (owned by `02-sqlite-data-layer`)
- No cloud sync, auth, or network calls
- No full model answer storage
- No real safety scanning (stub only in V1)
