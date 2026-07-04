# 02-sqlite-data-layer Requirements

## Overview

This spec defines the local SQLite data layer for cookedPrompts V1. It owns database initialization, schema and migration planning, and persistence of normalized prompt logs and import batch metadata.

The data layer is the concrete implementation of the importer's `StorageHandoffPort`. The `01-local-importer` spec hands validated, normalized `PromptLogEntry` records to this layer; the data layer persists them locally and answers duplicate-ID lookups.

The data layer is local-first. It must work offline, make no network calls, and never store full model answers.

---

## User Stories

### US-1: Persist Imported Prompt Logs

As a user who has imported prompt logs, I want my normalized entries saved locally so that I can revisit and analyze them across sessions.

### US-2: Import Batch Tracking

As a user reviewing my import history, I want each import operation recorded as a batch so that I can see when data was imported and how much.

### US-3: Duplicate Detection

As the importer preview step, I want to ask the data layer which prompt IDs already exist so that I can warn the user about cross-batch duplicates before committing.

### US-4: Local-First Persistence

As a privacy-conscious user, I want all my prompt data stored locally with no cloud upload so that my prompts stay private.

### US-5: Safe Commit

As the importer, I want to hand confirmed normalized entries to storage and receive a clear success/failure result so that partial or corrupt saves do not silently occur.

### US-6: Foundation for Future Analysis

As future features (scoring, model recommendations, safety warnings, templates), I want a stable local schema and query surface so that I can read and annotate prompt logs without redesigning storage.

---

## Functional Requirements

### FR-1: Local SQLite Database

- The data layer shall use SQLite as the V1 local structured storage layer.
- The data layer shall operate without login, cloud sync, or an external database.
- The data layer shall be deterministic and local.
- The data layer shall make no network calls, send no telemetry, and perform no cloud upload.

### FR-2: Database Initialization

- The data layer shall own database initialization (creating the database file/connection if absent).
- The data layer shall be safe to initialize repeatedly (idempotent init).
- The data layer shall expose a clear entry point for obtaining an initialized database handle/connection.

### FR-3: Schema and Migration Ownership

- The data layer shall own schema definition and migration planning.
- The data layer shall apply migrations deterministically and idempotently.
- The data layer shall track applied migrations (e.g., a schema version or migrations table).
- Migrations shall be forward-only in V1 unless a later spec introduces rollback.

### FR-4: StorageHandoffPort Implementation

- The data layer shall implement the importer's `StorageHandoffPort` interface.
- The data layer shall implement `saveImportBatch(batch, entries)` returning a `StorageSaveResult`.
- The data layer shall implement `checkDuplicateIds(ids)` returning the subset of IDs already present in storage.
- The data layer shall conform to the existing `StorageHandoffPort` and `StorageSaveResult` contracts without requiring the importer to change.

### FR-5: Save Import Batch

- `saveImportBatch(batch, entries)` shall persist the `ImportBatch` metadata and its associated `PromptLogEntry` records.
- The data layer shall store only confirmed, normalized entries provided by the importer.
- The data layer shall not accept or persist raw parsed rows (`RawImportEntry`).
- The save operation shall report the number of entries actually persisted in `StorageSaveResult`.
- On success, `StorageSaveResult.success` shall be `true` with `entries_saved` reflecting the count.
- On failure, `StorageSaveResult.success` shall be `false` with a structured `error` message and no partial data left behind.

### FR-6: Transactional Batch Save

- The data layer shall persist a batch and its entries within a single transaction.
- If any part of the batch save fails, the data layer shall roll back the entire operation, leaving storage unchanged.
- There shall be no partial batch persistence.

### FR-7: Duplicate ID Handling

- `checkDuplicateIds(ids)` shall return the subset of the provided IDs that already exist in stored prompt logs.
- `checkDuplicateIds` shall be a read-only operation with no side effects.
- On an empty database or empty input, `checkDuplicateIds` shall return an empty array.
- The data layer shall enforce prompt-log `id` uniqueness at the schema level (primary key or unique constraint).
- On a batch save containing an `id` that already exists, the data layer shall handle the conflict safely: either reject the conflicting entry with a clear error, or apply a defined conflict policy. The exact policy is an open question for design.

### FR-8: Import Batch Persistence

- The data layer shall persist `ImportBatch` metadata: `id`, `source_type`, `source_filename`, `total_rows`, `valid_rows`, `invalid_rows`, `warnings_count`, `created_at`.
- Each stored prompt log shall reference its `import_batch_id`.
- The data layer shall support retrieving batch metadata for future import-history views.

### FR-9: Query and Retrieval Surface

- The data layer shall provide read operations sufficient for future dashboard and scoring features, including at minimum:
  - retrieve a prompt log by `id`
  - list prompt logs (with pagination or bounded queries)
  - list prompt logs by `import_batch_id`
  - list import batches
- Retrieval shall exclude soft-deleted records by default if soft-delete is implemented (see FR-11).

### FR-10: Prompt Log Field Persistence

- The data layer shall persist all `PromptLogEntry` fields defined by the importer contract (see Data Requirements).
- The data layer shall preserve field types and null semantics as produced by the normalizer (missing optionals are `null`; `tags` is an array).

### FR-11: Soft Delete (Future-Ready)

- The schema shall include a nullable `deleted_at` column to support future soft-delete and data-deletion features.
- V1 is not required to implement user-facing deletion, but the column shall exist so future specs can add it without a breaking migration.
- If any retrieval defaults are defined, they shall exclude rows where `deleted_at` is set.

---

## Data Requirements

### DR-1: Core Prompt Log Fields

The prompt log table shall store the importer's `PromptLogEntry` fields as explicit columns:

| Field | Notes |
|-------|-------|
| `id` | Primary key / unique. |
| `timestamp` | ISO 8601 string. |
| `source` | string |
| `provider` | string |
| `model_used` | string |
| `prompt_text` | string (user prompt only — never a model answer). |
| `import_batch_id` | references the import batch. |
| `prompt_hash` | nullable. |
| `session_id` | nullable. |
| `follow_up_index` | nullable integer. |
| `parent_prompt_id` | nullable. |
| `input_tokens` | nullable integer. |
| `output_tokens` | nullable integer. |
| `total_tokens` | nullable integer. |
| `estimated_cost` | nullable numeric. |
| `latency_ms` | nullable integer. |
| `solved_status` | nullable enum: solved/unsolved/partial. |
| `user_rating` | nullable integer 1–5. |
| `tags` | array of strings; storage representation to be decided in design. |
| `redaction_status` | enum: none/partial/full (defaults to none). |

### DR-2: Future-Ready Columns

The prompt log table shall include these future-ready columns, populated with safe defaults or null in V1:

- `created_at` — record creation timestamp
- `updated_at` — record update timestamp
- `deleted_at` — nullable, for future soft delete
- `user_id` — nullable, for future auth
- `workspace_id` — nullable, for future workspaces
- `sync_status` — nullable, for future sync

V1 shall not implement auth, cloud sync, or workspaces. These columns exist only to keep future migrations non-breaking.

### DR-3: Explicit Columns Over Blobs

- Core entity fields shall be stored as explicit columns.
- The data layer shall avoid giant JSON blobs for core entities.
- A bounded, well-justified representation for `tags` (e.g., a normalized join table or a delimited/JSON column) may be chosen in design, but core scalar fields shall remain explicit columns.

### DR-4: Future Entity Direction (Not Implemented in V1 Core)

The schema plan shall leave room for future entities without implementing their full behavior now:

- PromptScore
- ModelRecommendation
- SafetyWarning
- RewriteVariant
- Template
- UserMemoryProfile
- GamificationMetric
- ModelCatalogue

These may be introduced by later specs or later tasks. This spec shall not over-design them. At most, the design may note foreign-key direction (they reference prompt logs by `id`).

---

## Privacy and Safety Requirements

### PSR-1: No Full Model Answer Storage

The data layer shall never store full model answers in V1. No column, table, blob, or metadata field shall hold assistant/model output content.

### PSR-2: Only Normalized Importer Entries

The data layer shall persist only normalized `PromptLogEntry` records handed off by the importer. Raw parsed rows shall never be persisted.

### PSR-3: No Banned Fields in Storage

Banned full-answer field names (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`) shall not appear as columns, keys, or values in any storage payload or table.

### PSR-4: Prompt Logs Are Private

The data layer shall treat prompt logs as private user data. It shall not upload, transmit, or replicate data to any external service in V1.

### PSR-5: Offline and Local-First

The data layer shall remain fully usable offline. No network connection shall be required for any operation.

### PSR-6: No Sensitive Content in Logs/Errors

Error messages and internal logs shall not expose full `prompt_text` or other sensitive prompt content. Diagnostics shall reference IDs, counts, and error types rather than dumping prompt bodies.

---

## Migration and Future-Proofing Requirements

### MR-1: Boring, Migration-Friendly Schema

- The schema shall be boring and migration-friendly.
- The data layer shall avoid SQLite-only tricks unless clearly justified and documented.

### MR-2: Explicit Columns

- Core entities shall use explicit, typed columns rather than opaque blobs, to ease future migration.

### MR-3: Future Supabase/Postgres Migration Path

- The schema shall be designed so that a future Supabase/Postgres migration is possible without rewriting the product model.
- Column names, types, and relationships shall map cleanly to a relational cloud database.
- V1 shall not implement Supabase or any cloud database.

### MR-4: UUID-Style IDs

- The data layer shall use UUID-style string IDs (consistent with the importer's `import_batch_id` and entry `id`), avoiding auto-increment integer keys as primary identifiers for portability.

---

## Testing and Verification Requirements

Future tasks shall include tests covering:

- TR-1: Database initialization (fresh DB, repeated init idempotency).
- TR-2: Migration application (applies cleanly, tracked, idempotent).
- TR-3: Saving import batches (batch metadata persisted correctly).
- TR-4: Saving prompt logs (all fields persisted with correct types/null semantics).
- TR-5: Duplicate ID detection (`checkDuplicateIds` returns correct subset; empty DB and empty input return empty).
- TR-6: Duplicate handling on save (conflict policy behaves as defined; no corruption).
- TR-7: No full-answer field storage (banned fields never persisted).
- TR-8: No raw-row storage (only normalized entries accepted).
- TR-9: No network calls during any storage operation.
- TR-10: Rollback/transaction behavior on failed batch save (no partial persistence).
- TR-11: Storage port contract compliance (`saveImportBatch`, `checkDuplicateIds` match `StorageHandoffPort`).
- TR-12: Empty database behavior (reads return empty results, not errors).
- TR-13: Soft-delete behavior if implemented (deleted rows excluded from default reads).
- TR-14: Query/retrieval behavior needed by future dashboard/scoring (by id, by batch, list).

Tests shall use synthetic data only — no real prompts, secrets, or model answers.

---

## Non-Goals

This spec explicitly excludes:

- Implementation in this pass (requirements only).
- Installing the SQLite package in this pass.
- Creating schema/migration files in this pass.
- Supabase implementation.
- Auth/login.
- Cloud sync.
- Team/workspace behavior beyond nullable future-ready columns.
- Billing/payments.
- Dashboard UI.
- Scoring engine.
- Safety/redaction engine.
- Model recommendation engine.
- Full model answer storage.
- Browser/API/VS Code/Kiro extension capture.

---

## Open Questions

1. **SQLite library**: Which SQLite binding for the TypeScript/Node stack (e.g., `better-sqlite3`, `node:sqlite`, or another)? To be decided in design; no package installed in this pass.
2. **Duplicate-on-save policy**: When `saveImportBatch` includes an `id` that already exists, should the data layer reject the whole batch, skip the conflicting entry, or upsert? Recommendation: reject with a clear error in V1 and rely on the importer's preview duplicate check. Confirm in design.
3. **Tags representation**: Normalized join table vs. delimited/JSON column? Recommendation: keep it simple and migration-friendly; decide in design.
4. **Database file location**: Where does the local DB file live (project dir, OS app-data dir)? To be decided in design.
5. **Migration mechanism**: Hand-rolled version table vs. a lightweight migration helper? To be decided in design, staying dependency-light.
6. **Timestamp storage**: Store timestamps as ISO 8601 text (portable) vs. numeric epoch? Recommendation: ISO 8601 text for portability and consistency with the importer.
