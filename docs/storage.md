# SQLite Storage

## Purpose

The SQLite layer is the V1 local-first persistence layer for imported, normalized prompt logs. It stores validated entries handed off from the importer and supports future scoring, recommendations, and exports.

No cloud, no auth, no telemetry. Data stays local.

## Public Entry Point

```typescript
import { createSqliteStorage } from '../src/storage/sqlite/index.js';
import type { SqliteConnectionConfig } from '../src/storage/sqlite/index.js';

const storage = createSqliteStorage(config);
```

`createSqliteStorage(config: SqliteConnectionConfig): StorageHandoffPort`

- Preferred entry point for the entire SQLite layer.
- Opens a better-sqlite3 connection from `config.databasePath`.
- Runs pending migrations idempotently.
- Returns an initialized adapter typed as `StorageHandoffPort`.
- Supports `:memory:` for tests and development.
- Caller owns the DB lifecycle (close when done).

## Basic Usage

```typescript
import {
  createSqliteStorage,
  IN_MEMORY_SQLITE_DATABASE_PATH,
} from '../src/storage/sqlite/index.js';

const storage = createSqliteStorage({
  databasePath: IN_MEMORY_SQLITE_DATABASE_PATH,
});

// Check for cross-batch duplicate IDs before committing.
const duplicates = await storage.checkDuplicateIds(['prompt-1', 'prompt-2']);

// Save a batch and its entries (all-or-nothing).
const result = await storage.saveImportBatch(batch, entries);
```

All prompt text in examples above is synthetic. Do not use real user prompt logs.

## What Gets Stored

- `import_batches` — batch metadata (source type, file name, row counts, timestamp).
- `prompt_logs` — normalized prompt log entries (id, timestamp, source, provider, model_used, prompt_text, prompt_hash, token counts, cost, latency, status, rating, redaction_status).
- `prompt_log_tags` — normalized tags per prompt log (trim, dedupe, ordered).
- `schema_migrations` — applied migration version tracking.

## What Never Gets Stored

Banned full-answer fields (V1 privacy rule):

- `assistant_message`
- `response`
- `completion`
- `model_answer`
- `output_text`
- `generated_text`

Also excluded:

- No generic answer/output blob columns.
- No raw parsed row storage.
- No tags blob column on `prompt_logs` (tags live in `prompt_log_tags`).
- No cloud upload or telemetry in V1.

## Schema Summary

| Table | Purpose |
|-------|---------|
| `schema_migrations` | Tracks applied migration versions (forward-only, idempotent). |
| `import_batches` | One row per import operation with source metadata and row counts. |
| `prompt_logs` | One row per normalized prompt log entry. Includes `created_at`, `updated_at`, `deleted_at` (soft-delete), and nullable `user_id`/`workspace_id`/`sync_status` for future Supabase portability. |
| `prompt_log_tags` | Normalized join table (`prompt_log_id`, `tag`). Unique constraint per pair. |

Indexes: `idx_prompt_logs_import_batch_id`, `idx_prompt_logs_prompt_hash`, `idx_prompt_logs_deleted_at`, `idx_prompt_log_tags_tag`.

## Transactions and Duplicate Handling

- `saveImportBatch` is all-or-nothing (single better-sqlite3 transaction).
- In-batch duplicate entry IDs → batch rejected before any writes.
- Existing-DB duplicate IDs → batch rejected inside the transaction before inserts.
- Entry/batch `import_batch_id` mismatch → batch rejected before writes.
- SQLite constraint violation (e.g. invalid `user_rating`) → full rollback.
- Error messages are content-free (no prompt text, no raw SQLite errors surfaced).

## Tests and Verification

Wave 6 test coverage:

- **Connection/init**: in-memory open, `foreign_keys = 1`, safe errors, factory port surface, temp-file idempotency.
- **Migrations**: table/index creation, version tracking, idempotent re-run, no banned columns.
- **Repositories**: round-trips, nullable fields, tag normalization/hydration, scoped lists, `findExistingIds`, pagination validation, soft-delete.
- **Adapter behavior**: port compliance, save success, duplicate/mismatch rejection, transactional rollback, content-free errors.
- **Privacy/no-network**: banned fields never persist, no raw/blob storage, no `fetch` calls, no prompt text in errors.

Current suite: 15 test files, 142 tests passing.

## Current Non-Goals

- Supabase/cloud sync
- Auth/login
- Dashboard UI
- Scoring engine
- Model recommendation engine
- Browser/API/VS Code/Kiro extensions
- Payments/billing

## Future Notes

- Schema is designed for Supabase/Postgres portability (explicit columns, UUID-style IDs, ISO 8601 timestamps, nullable `user_id`/`workspace_id`/`sync_status`).
- Future migrations append to the in-code list with the next version number.
- The `StorageHandoffPort` interface can be implemented by a Supabase adapter in V2+.
