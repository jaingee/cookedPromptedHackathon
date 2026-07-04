# 02-sqlite-data-layer Design

## 1. Overview

This document defines the technical design for the cookedPrompts local SQLite data layer. It is the concrete implementation of the importer's `StorageHandoffPort`: it persists normalized `PromptLogEntry` records and `ImportBatch` metadata to a local SQLite database, and answers duplicate-ID lookups for the importer preview.

The data layer is local-first: no network, no cloud, no auth in V1. It owns database initialization, schema, and migrations. It provides enough detail for a future tasks pass but implements nothing here.

---

## 2. Design Goals

- Implement `StorageHandoffPort` (`saveImportBatch`, `checkDuplicateIds`) exactly, with no importer changes.
- Persist normalized prompt logs and batch metadata locally and deterministically.
- Transactional batch saves — all-or-nothing.
- Boring, migration-friendly schema with explicit columns.
- Config-driven database path; testable with temp/in-memory databases.
- Enforce privacy: never store full model answers or banned fields.
- Keep a Supabase/Postgres migration path open without implementing it.

---

## 3. Non-Goals

- No implementation, package install, or migration files in this pass.
- No Supabase, cloud sync, auth, billing, teams (beyond nullable future columns).
- No dashboard, scoring, safety, or model-recommendation engines.
- No full model answer storage.
- No browser/API/VS Code/Kiro extension logic.

---

## 4. Resolved Open Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | SQLite library | `better-sqlite3` (synchronous, well-tested, simple transactions). Verify Node/ESM compatibility at install time; fallback `node:sqlite` if constraints change. |
| 2 | Duplicate-on-save policy | `checkDuplicateIds` warns pre-commit; `saveImportBatch` rejects the entire batch transactionally if any `id` already exists. No upsert, no silent skip in V1. |
| 3 | Tags representation | Normalized `prompt_log_tags` join table with unique `(prompt_log_id, tag)`. No blob column. |
| 4 | Database file location | Config-driven path passed to the adapter. Tests use in-memory (`:memory:`) or temp-file DBs. App shell decides the final user-data dir later. |
| 5 | Migration mechanism | In-code ordered migration list with integer version IDs + a `schema_migrations` table. Forward-only, idempotent. No heavy framework. |
| 6 | Timestamp storage | ISO 8601 UTC text for `timestamp`, `created_at`, `updated_at`, `deleted_at`. Importer timestamp string preserved as-is. |

---

## 5. SQLite Library Decision

**Chosen: `better-sqlite3`.**

Evaluation:

| Library | Pros | Cons |
|---------|------|------|
| `better-sqlite3` | Synchronous API (simple transactions, no async race conditions), fast, battle-tested, easy prepared statements, works well in Node desktop/local apps, straightforward testing with `:memory:`. | Native module (needs build/prebuild per platform); must confirm compatibility with the chosen Node version. |
| `node:sqlite` | Built-in (no dependency), no native install step. | Experimental/unstable in current Node LTS, API still changing, risk for V1 stability. |
| `sql.js` (WASM) | No native build, portable. | In-memory/WASM persistence is awkward for a durable local DB; extra complexity for file persistence. |

Decision rationale:
- The data layer is local-first and Node-based; `better-sqlite3`'s synchronous API keeps transaction and rollback logic simple and deterministic, which matters for the all-or-nothing batch save.
- It is the most stable, widely-used option today.

Implementation-time verification (before installing):
- Confirm `better-sqlite3` supports the project's Node version and has prebuilt binaries for the dev platform (Windows) to avoid build-toolchain friction.
- If prebuilt binaries are unavailable or Node compatibility is problematic, reassess `node:sqlite` (if it has stabilized) as the fallback.

The adapter shall wrap the library behind our own interfaces so the concrete library is replaceable.

---

## 6. Architecture and Module Layout

Per `.kiro/steering/structure.md`, storage lives under `src/storage`. Proposed layout (files created in later passes, not now):

```
src/storage/sqlite/
  index.ts                     # barrel: public exports
  sqlite-connection.ts         # open/init connection from config path
  sqlite-storage-adapter.ts    # implements StorageHandoffPort
  migrations/
    index.ts                   # ordered migration list + runner
    migration-001-initial.ts   # initial schema (in-code SQL strings)
  repositories/
    import-batch-repository.ts
    prompt-log-repository.ts
```

Boundaries:
- `sqlite-connection.ts` — owns opening the DB from a config path and running migrations on init.
- `migrations/` — ordered, versioned migrations + `schema_migrations` tracking.
- `repositories/` — typed CRUD/query methods over tables.
- `sqlite-storage-adapter.ts` — implements `StorageHandoffPort`, composes repositories, owns transactions.
- `index.ts` — exports the adapter factory and public types only.

The adapter depends on the importer's `PromptLogEntry`, `ImportBatch`, `StorageHandoffPort`, and `StorageSaveResult` types (imported from `src/importers/local`), keeping one source of truth for the contract.

---

## 7. Database Initialization Design

- A factory (e.g., `createSqliteStorage({ databasePath })`) opens the connection and runs migrations.
- `databasePath` is required config: a file path, or `:memory:` for tests.
- Initialization is idempotent: opening an already-initialized DB runs no new migrations.
- Initialization enables SQLite pragmas as needed (e.g., `foreign_keys = ON`).
- No implicit global singleton; the caller (future app shell) owns lifecycle. Tests create isolated instances.

---

## 8. Migration Design

- `schema_migrations` table tracks applied versions: `version INTEGER PRIMARY KEY`, `applied_at TEXT`.
- Migrations are an ordered in-code array: `{ version: number, up(db): void }`.
- On init, the runner reads the max applied version and applies pending migrations in order, each wrapped in a transaction.
- Forward-only in V1. No `down`/rollback unless a later spec requires it.
- Idempotent: re-running applies nothing if all versions are present.
- Migration SQL lives as strings in migration modules (no separate `.sql` files required for V1, keeping it dependency-light and typechecked).

---

## 9. Schema Design

All timestamps are ISO 8601 UTC text. All primary IDs are UUID-style strings.

### 9.1 `import_batches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID from importer batch. |
| `source_type` | TEXT | 'jsonl' \| 'csv' \| 'demo'. |
| `source_filename` | TEXT NULL | |
| `total_rows` | INTEGER | |
| `valid_rows` | INTEGER | |
| `invalid_rows` | INTEGER | |
| `warnings_count` | INTEGER | |
| `created_at` | TEXT | ISO 8601. |

### 9.2 `prompt_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID; unique — drives duplicate detection. |
| `timestamp` | TEXT | ISO 8601 (importer value preserved). |
| `source` | TEXT | |
| `provider` | TEXT | |
| `model_used` | TEXT | |
| `prompt_text` | TEXT | user prompt only. |
| `import_batch_id` | TEXT | FK → `import_batches.id`. |
| `prompt_hash` | TEXT NULL | |
| `session_id` | TEXT NULL | |
| `follow_up_index` | INTEGER NULL | |
| `parent_prompt_id` | TEXT NULL | |
| `input_tokens` | INTEGER NULL | |
| `output_tokens` | INTEGER NULL | |
| `total_tokens` | INTEGER NULL | |
| `estimated_cost` | REAL NULL | |
| `latency_ms` | INTEGER NULL | |
| `solved_status` | TEXT NULL | 'solved'\|'unsolved'\|'partial'. |
| `user_rating` | INTEGER NULL | 1–5. |
| `redaction_status` | TEXT | 'none'\|'partial'\|'full' (default 'none'). |
| `created_at` | TEXT | data-layer generated. |
| `updated_at` | TEXT | data-layer generated. |
| `deleted_at` | TEXT NULL | soft delete (future). |
| `user_id` | TEXT NULL | future auth. |
| `workspace_id` | TEXT NULL | future workspaces. |
| `sync_status` | TEXT NULL | future sync. |

Notes:
- No `tags` column here — tags live in the join table.
- No banned full-answer columns exist. The schema is the enforcement point.
- Indexes: `import_batch_id`, `prompt_hash` (for future dedup/lookups), `deleted_at` (for default filtering).

### 9.3 `prompt_log_tags`

| Column | Type | Notes |
|--------|------|-------|
| `prompt_log_id` | TEXT | FK → `prompt_logs.id`. |
| `tag` | TEXT | trimmed non-empty. |

- Unique constraint: `(prompt_log_id, tag)`.
- Index on `tag` for future tag-based queries.

### 9.4 `schema_migrations`

| Column | Type | Notes |
|--------|------|-------|
| `version` | INTEGER PK | |
| `applied_at` | TEXT | ISO 8601. |

### 9.5 Future Entity Direction (not implemented in V1)

Later specs may add tables that reference `prompt_logs.id`:
- `prompt_scores` → `prompt_logs.id`
- `safety_warnings` → `prompt_logs.id`
- `model_recommendations` → `prompt_logs.id`
- `rewrite_variants` → `prompt_logs.id`
- `templates` — independent or derived from rewrite variants
- `user_memory_profiles`, `gamification_metrics`, `model_catalogue` — independent

The V1 schema does not create these. The design only records reference direction so future migrations are additive.

---

## 10. Storage Adapter Design

`SqliteStorageAdapter implements StorageHandoffPort`:

```
saveImportBatch(batch: ImportBatch, entries: PromptLogEntry[]): Promise<StorageSaveResult>
checkDuplicateIds(ids: string[]): Promise<string[]>
```

Guarantees:
- Accepts only `PromptLogEntry` (typed); never `RawImportEntry`.
- Never writes banned full-answer fields — schema has no such columns, and the adapter maps only known `PromptLogEntry` fields.
- `saveImportBatch` runs batch + entries + tags in one transaction (see §11).
- Returns a clean `StorageSaveResult` (`success`, `entries_saved`, optional `error`).
- `checkDuplicateIds` is read-only.
- Constructed with an initialized connection; testable with `:memory:`.

Although the port methods are `Promise`-returning (per the contract), the `better-sqlite3` calls are synchronous internally; the adapter wraps results in resolved promises. This keeps the async contract while retaining simple synchronous transaction semantics.

---

## 11. Transaction and Duplicate-Handling Design

**Duplicate policy (V1):** reject the whole batch if any entry `id` already exists.

`saveImportBatch` flow:
1. Begin transaction.
2. Collect entry IDs; query existing IDs in `prompt_logs`.
3. If any already exist → roll back, return `{ success: false, entries_saved: 0, error: 'Duplicate prompt log id(s) detected' }` (error references count, not prompt content).
4. Insert `import_batches` row.
5. Insert each `prompt_logs` row.
6. Insert `prompt_log_tags` rows for each entry's tags.
7. Commit. Return `{ success: true, entries_saved: N }`.
8. On any error → transaction rolls back; return `{ success: false, entries_saved: 0, error }`.

Why reject-whole-batch:
- Simplest correct semantics; no partial state.
- The importer already surfaces duplicates in preview via `checkDuplicateIds`, so commit-time conflicts should be rare and indicate the user chose to proceed anyway.
- Avoids ambiguous upsert/merge decisions in V1; upsert can be a deliberate future feature.

The `id` primary key provides a defensive uniqueness guarantee even if the pre-check is skipped.

---

## 12. Repository / Query Design

Narrow V1 query surface:

**`ImportBatchRepository`**
- `insert(batch): void`
- `getById(id): ImportBatch | null`
- `list({ limit, offset }): ImportBatch[]`

**`PromptLogRepository`**
- `insert(entry): void`
- `getById(id): PromptLogEntry | null`
- `listByBatch(importBatchId, { limit, offset }): PromptLogEntry[]`
- `list({ limit, offset }): PromptLogEntry[]`
- `findExistingIds(ids): string[]`
- `getTags(promptLogId): string[]` (internal helper for hydration)

Rules:
- All list queries are bounded (require/accept `limit`) to avoid unbounded reads.
- Default reads exclude rows where `deleted_at` is set.
- Repositories return hydrated `PromptLogEntry` objects (tags joined back into the `tags` array).
- A soft-delete method (`softDeleteById`) may be included at the repository level, but user-facing deletion stays future work.

Dashboard/scoring specs can extend this surface later.

---

## 13. Tags Representation Design

- Tags are stored in `prompt_log_tags`, not on `prompt_logs`.
- On insert: for each entry, insert one row per trimmed non-empty tag; unique `(prompt_log_id, tag)` prevents duplicates.
- On read: repository joins tags and rehydrates `PromptLogEntry.tags` as `string[]` (empty array when none).
- Rationale: queryable, migration-friendly, no delimiter/escaping bugs, keeps `prompt_logs` free of blobs.

---

## 14. Privacy and No-Full-Answer Storage Design

- **Schema-level enforcement:** no columns exist for `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`, or any answer content.
- **Type-level enforcement:** the adapter accepts only `PromptLogEntry`; it maps a fixed allow-list of columns and ignores anything else.
- **No raw rows:** `RawImportEntry` is never a parameter type in the adapter.
- **Local-only:** no network calls, no telemetry, no cloud sync, no Supabase, no auth in V1.
- **Logs/errors:** reference IDs, counts, and error types — never dump `prompt_text` or other sensitive content.
- Tests explicitly assert banned fields never reach storage (see §16).

---

## 15. Error Handling and Logging Design

- All write paths return structured results (`StorageSaveResult`) rather than throwing across the port boundary; unexpected internal errors are caught and converted to `{ success: false, error }`.
- Error messages are safe: `"Duplicate prompt log id(s) detected (3)"`, `"Migration N failed"`, `"Database initialization failed"` — no prompt bodies.
- Initialization/migration failures throw clear errors to the caller (app shell) since the DB is unusable in that state.
- Internal diagnostics summarize counts and types, never raw prompt content.

---

## 16. Testing Strategy (for future tasks)

Tests use synthetic data only and in-memory (`:memory:`) or temp-file databases:

- Database initialization (fresh DB creates all tables).
- Repeated initialization idempotency (no duplicate migrations).
- Migration application + tracking in `schema_migrations`.
- Migration idempotency (re-run applies nothing).
- Saving import batches (metadata persisted).
- Saving prompt logs (all fields + null semantics round-trip).
- Tags persistence and retrieval (join table → `tags` array).
- Transaction rollback on failure (no partial batch).
- `checkDuplicateIds` returns correct subset; empty DB/input → `[]`.
- Duplicate-on-save rejection (whole batch rejected, nothing persisted).
- No full-answer field storage (banned fields never persisted, even if present on input object).
- No raw-row storage (adapter typed to `PromptLogEntry`).
- No network calls during any operation.
- `StorageHandoffPort` contract compliance.
- Empty database behavior (reads return `[]`, not errors).
- Soft-delete default filtering (if `softDeleteById` implemented).
- Query/retrieval by id, by batch, list with pagination.

---

## 17. Future Supabase/Postgres Migration Notes

- Column types map cleanly to Postgres (TEXT, INTEGER, REAL, TIMESTAMP-as-text or later `timestamptz`).
- UUID-style string IDs port directly to Postgres `uuid`/`text`.
- Nullable `user_id`, `workspace_id`, `sync_status` reserve multi-user/sync direction.
- Normalized `prompt_log_tags` maps to a Postgres join table unchanged.
- No SQLite-only tricks (no `rowid` reliance for identity, no dynamic typing abuse).
- Migration list concept transfers to a Postgres migration tool later.
- V1 does not implement Supabase.

---

## 18. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `better-sqlite3` native build friction on Windows | Verify prebuilt binaries before install; fallback to `node:sqlite` if it has stabilized. |
| Async port contract vs. sync library | Adapter wraps sync calls in resolved promises; keeps contract intact. |
| Tags join table adds query complexity | Repository hydrates tags; queries stay bounded and indexed. |
| Duplicate-reject frustrates users mid-import | Importer preview warns first via `checkDuplicateIds`; upsert can be a deliberate future feature. |
| Schema drift vs. importer `PromptLogEntry` | Adapter maps a fixed allow-list; a test asserts column/field parity. |

---

## 19. Implementation Task Notes (for the future tasks pass)

Likely task waves:

1. **Connection + config** — `sqlite-connection.ts`, config-driven path, pragmas.
2. **Migration runner + initial migration** — `schema_migrations`, migration list, initial schema (all tables).
3. **Repositories** — `ImportBatchRepository`, `PromptLogRepository` (insert, get, list, findExistingIds, tags hydration).
4. **Storage adapter** — `SqliteStorageAdapter implements StorageHandoffPort`, transactional `saveImportBatch`, `checkDuplicateIds`.
5. **Barrel + factory** — `createSqliteStorage({ databasePath })`, public exports.
6. **Tests** — per §16, using `:memory:` DBs.
7. **Package install** — add `better-sqlite3` (+ types) after verifying platform compatibility.
8. **Docs + closeout** — update `docs/`, HANDOFF, CHANGELOG.

Each task small and reviewable. Do not combine migration, repository, and adapter logic into one module.
