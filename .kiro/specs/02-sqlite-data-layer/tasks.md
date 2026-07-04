# 02-sqlite-data-layer Tasks

## Task Planning Notes

This file breaks the approved requirements and design into dependency-safe implementation waves.

Rules:

- Tasks must be completed only after human review.
- Implement task-by-task; do not combine migration, repository, and adapter logic into one task.
- No task may introduce cloud upload, full model answer storage, banned full-answer fields, auth, Supabase, cloud sync, billing, teams (beyond nullable future columns), or extension capture.
- The adapter must implement the existing `StorageHandoffPort` without requiring importer changes.
- After completing meaningful work, update `HANDOFF.md` and `CHANGELOG.md`.

### Acceptance guardrails (apply to every implementation task)

- Local-first V1: no network calls, no telemetry.
- No Supabase, auth, or cloud sync.
- No full model answer storage; no banned full-answer fields in schema, payloads, errors, or logs.
- Adapter accepts only normalized `PromptLogEntry` — never `RawImportEntry`.
- Storage implementation must not require importer changes.
- Future Supabase/Postgres migration path must remain possible.
- Errors/logs reference IDs, counts, and types — never prompt content.

---

## Dependency Waves

| Wave | Focus | Sequential? |
|------|-------|-------------|
| 0 | Storage module scaffolding + package preflight/install | First |
| 1 | Connection/config foundation | After Wave 0 |
| 2 | Migration runner + initial schema | After Wave 1 |
| 3 | Repository layer | After Wave 2 |
| 4 | StorageHandoffPort adapter | After Wave 3 |
| 5 | Public factory and exports | After Wave 4 |
| 6 | Tests and verification | After relevant waves |
| 7 | Documentation and closeout | Last |

Waves 1→2→3→4→5 are strictly sequential (each builds on the prior). Wave 0's preflight/install must complete before any runtime SQLite code. Wave 6 test tasks attach to the waves they cover. Wave 7 is last.

---

## Wave 0 — Scaffolding and Package Preflight

### Task 0.1 — Create storage module folder structure and barrel

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: none
- **Files likely touched**: `src/storage/sqlite/`, `src/storage/sqlite/index.ts`
- **Goal**: Create the module boundary for the SQLite data layer with an empty barrel exporting only what exists after this pass.
- **Acceptance**:
  - Folder structure exists.
  - No connection/migration/repository/adapter logic yet.
  - No package install in this task.
- **Notes**: Scaffolding only. Keep the barrel minimal.

### Task 0.2 — better-sqlite3 compatibility preflight

- **Status**: Completed (2026-07-03) — Node v24.16.0 supported by better-sqlite3 12.11.1; prebuilt binary installed cleanly; types via @types/better-sqlite3 7.6.13.
- **Role**: review
- **Depends on**: none
- **Files likely touched**: none (investigation + notes only)
- **Goal**: Verify `better-sqlite3` compatibility before installing.
- **Acceptance**:
  - Confirm the project's Node version is supported by a current `better-sqlite3` release.
  - Confirm prebuilt binaries are available for the dev platform (Windows) or a build toolchain exists.
  - If compatibility is problematic, document the `node:sqlite` fallback decision before proceeding.
- **Notes**: This is a decision/verification task. No install here.

### Task 0.3 — Install better-sqlite3 and types

- **Status**: Completed (2026-07-03) — better-sqlite3 12.11.1 + @types/better-sqlite3 7.6.13 installed; typecheck and 95 tests pass.
- **Role**: implementation
- **Depends on**: Task 0.2
- **Files likely touched**: `package.json`, `package-lock.json`
- **Goal**: Install `better-sqlite3` and its type definitions as the only dependency needed for storage.
- **Acceptance**:
  - `better-sqlite3` installed (pinned version).
  - Type definitions available (bundled or `@types/better-sqlite3`).
  - `npm run typecheck` passes.
  - `npm test` passes (existing 95 tests still green).
- **Notes**: Keep install separate from runtime implementation. Do not add other dependencies.

---

## Wave 1 — Connection / Config Foundation

### Task 1.1 — Define SQLite config type

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/storage/sqlite/sqlite-connection.ts` (or a `types.ts`)
- **Goal**: Define a config type carrying `databasePath` (file path or `:memory:`).
- **Acceptance**:
  - Config type is explicit and typed.
  - Supports `:memory:` for tests.
  - No hardcoded user-specific paths.

### Task 1.2 — Implement connection factory

- **Status**: Completed (2026-07-03) — `import Database from 'better-sqlite3'` default import typechecks under verbatimModuleSyntax; no tsconfig change needed.
- **Role**: implementation
- **Depends on**: Task 1.1, Task 0.3
- **Files likely touched**: `src/storage/sqlite/sqlite-connection.ts`
- **Goal**: Open a SQLite connection from config and enable required pragmas.
- **Acceptance**:
  - Opens DB from `databasePath` (including `:memory:`).
  - Enables `PRAGMA foreign_keys = ON`.
  - No global singleton; caller owns lifecycle.
  - No network calls.
- **Notes**: Migrations run on init (wired in Wave 2), but keep opening and migrating as composable steps.

---

## Wave 2 — Migration Runner and Initial Schema

### Task 2.1 — Implement migration runner + schema_migrations

- **Status**: Completed (2026-07-03)
- **Role**: schema-review
- **Depends on**: Task 1.2
- **Files likely touched**: `src/storage/sqlite/migrations/index.ts`
- **Goal**: Provide an ordered in-code migration list and a runner that tracks applied versions in `schema_migrations`.
- **Acceptance**:
  - `schema_migrations` table created if absent (`version` PK, `applied_at`).
  - Runner applies pending migrations in version order, each in a transaction.
  - Forward-only; idempotent (re-run applies nothing).
  - No rollback in V1.

### Task 2.2 — Initial schema migration

- **Status**: Completed (2026-07-03)
- **Role**: schema-review
- **Depends on**: Task 2.1
- **Files likely touched**: `src/storage/sqlite/migrations/migration-001-initial.ts`
- **Goal**: Define the initial schema: `import_batches`, `prompt_logs`, `prompt_log_tags`.
- **Acceptance**:
  - `import_batches`: id PK, source_type, source_filename, total_rows, valid_rows, invalid_rows, warnings_count, created_at.
  - `prompt_logs`: all `PromptLogEntry` scalar fields + future-ready columns (`created_at`, `updated_at`, `deleted_at`, `user_id`, `workspace_id`, `sync_status`); `id` PK; FK to `import_batches`.
  - `prompt_log_tags`: `prompt_log_id` FK, `tag`, unique `(prompt_log_id, tag)`.
  - Indexes: `prompt_logs.import_batch_id`, `prompt_logs.prompt_hash`, `prompt_logs.deleted_at`, `prompt_log_tags.tag`.
  - No columns for banned full-answer fields.
  - No `tags` blob column on `prompt_logs`.
- **Notes**: Schema is the privacy enforcement point. Keep it boring and Postgres-portable.

---

## Wave 3 — Repository Layer

### Task 3.1 — ImportBatchRepository

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 2.2
- **Files likely touched**: `src/storage/sqlite/repositories/import-batch-repository.ts`
- **Goal**: Insert and read import batch metadata.
- **Acceptance**:
  - `insert(batch)`, `getById(id)`, `list({ limit, offset })`.
  - List queries are bounded.
  - Round-trips `ImportBatch` fields correctly.

### Task 3.2 — PromptLogRepository (core CRUD + queries)

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 2.2
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-log-repository.ts`
- **Goal**: Insert and read prompt logs, excluding soft-deleted rows by default.
- **Acceptance**:
  - `insert(entry)`, `getById(id)`, `listByBatch(id, { limit, offset })`, `list({ limit, offset })`.
  - `findExistingIds(ids)` returns the subset already present.
  - Default reads exclude rows where `deleted_at` is set.
  - Maps only the allow-list of `PromptLogEntry` columns; ignores unknown/banned keys.
  - Bounded list queries.

### Task 3.3 — Tags persistence and hydration

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 3.2
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-log-repository.ts`
- **Goal**: Persist tags to `prompt_log_tags` on insert and rehydrate `tags` on read.
- **Acceptance**:
  - Each trimmed non-empty tag inserted as one row; unique `(prompt_log_id, tag)` respected.
  - Reads rehydrate `PromptLogEntry.tags` as `string[]` (empty array when none).
  - No delimiter/blob storage of tags.

---

## Wave 4 — StorageHandoffPort Adapter

### Task 4.1 — Implement checkDuplicateIds

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 3.2
- **Files likely touched**: `src/storage/sqlite/sqlite-storage-adapter.ts`
- **Goal**: Implement `checkDuplicateIds(ids)` per the port contract.
- **Acceptance**:
  - Returns the subset of provided IDs already present in `prompt_logs`.
  - Read-only, no side effects.
  - Empty DB or empty input → `[]`.

### Task 4.2 — Implement saveImportBatch (transactional)

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 3.1, Task 3.2, Task 3.3, Task 4.1
- **Files likely touched**: `src/storage/sqlite/sqlite-storage-adapter.ts`
- **Goal**: Implement `saveImportBatch(batch, entries)` as an all-or-nothing transaction with duplicate rejection.
- **Acceptance**:
  - Single transaction covering batch + entries + tags.
  - If any entry `id` already exists → roll back, return `{ success: false, entries_saved: 0, error }` (error references count, not content).
  - On success → `{ success: true, entries_saved: N }`.
  - On any error → rollback, no partial persistence.
  - Accepts only `PromptLogEntry`; never persists banned fields.
  - No prompt content in error messages.

### Task 4.3 — SqliteStorageAdapter implements StorageHandoffPort

- **Status**: Completed (2026-07-03) — type-level conformance confirmed via typecheck.
- **Role**: review
- **Depends on**: Task 4.1, Task 4.2
- **Files likely touched**: `src/storage/sqlite/sqlite-storage-adapter.ts`
- **Goal**: Confirm the adapter class satisfies `StorageHandoffPort` exactly (both methods, async signatures).
- **Acceptance**:
  - Type-level conformance to `StorageHandoffPort` (no importer changes).
  - Async contract preserved (sync internals wrapped in resolved promises).

---

## Wave 5 — Public Factory and Exports

### Task 5.1 — createSqliteStorage factory

- **Status**: Completed (2026-07-03) — opens connection, runs migrations, returns StorageHandoffPort.
- **Role**: implementation
- **Depends on**: Task 4.3
- **Files likely touched**: `src/storage/sqlite/index.ts`
- **Goal**: Provide `createSqliteStorage({ databasePath })` that opens the connection, runs migrations, and returns an initialized adapter.
- **Acceptance**:
  - Factory returns a ready `StorageHandoffPort` implementation.
  - Idempotent init (safe to call on existing DB).
  - Test-friendly (accepts `:memory:`).

### Task 5.2 — Public barrel exports

- **Status**: Completed (2026-07-03)
- **Role**: implementation
- **Depends on**: Task 5.1
- **Files likely touched**: `src/storage/sqlite/index.ts`
- **Goal**: Export the factory and public types; keep concrete SQLite details behind the boundary.
- **Acceptance**:
  - Exports `createSqliteStorage` and public config/result types.
  - Does not leak `better-sqlite3` internals as the public surface.

---

## Wave 6 — Tests and Verification

All tests use synthetic data only, with `:memory:` or temp-file databases.

### Task 6.1 — Connection + initialization tests

- **Status**: Completed (2026-07-03) — `tests/storage/sqlite/connection.test.ts` (9 tests).
- **Role**: test
- **Depends on**: Task 1.2, Task 5.1
- **Files likely touched**: `tests/storage/sqlite/connection.test.ts`
- **Acceptance**: fresh DB initializes; repeated init is idempotent; `foreign_keys` enabled.
- **Coverage**: in-memory open, `foreign_keys=1`, safe error on empty/whitespace/missing path, factory returns port surface, `checkDuplicateIds` [] on fresh DB, temp-file port creation, repeated init on a persisted file keeps a single `schema_migrations` row.

### Task 6.2 — Migration tests

- **Status**: Completed (2026-07-03) — `tests/storage/sqlite/migrations.test.ts` (6 tests).
- **Role**: test
- **Depends on**: Task 2.2
- **Files likely touched**: `tests/storage/sqlite/migrations.test.ts`
- **Acceptance**: migrations apply, tracked in `schema_migrations`, idempotent; all tables/indexes exist.
- **Coverage**: all four tables created, version 1 recorded, idempotent re-run, all four required indexes, no banned answer columns, no tags blob column.

### Task 6.3 — Repository tests

- **Status**: Completed (2026-07-03) — `tests/storage/sqlite/repositories.test.ts` (18 tests).
- **Role**: test
- **Depends on**: Task 3.1, Task 3.2, Task 3.3
- **Files likely touched**: `tests/storage/sqlite/repositories.test.ts`
- **Acceptance**: save/read import batches; save/read prompt logs; nullable fields round-trip; tags persist and hydrate; `findExistingIds` correct; bounded lists; empty DB returns `[]`; soft-deleted excluded by default.
- **Coverage**: batch + prompt-log round-trips (required, nullable, populated), tag trim/dedupe/empty-drop/ordered hydration, `listByBatch` scoping, `findExistingIds` order preservation, pagination validation (limit/offset) + `MAX_LIST_LIMIT` capping, soft-delete default exclusion with `includeDeleted` override.

### Task 6.4 — Adapter behavior tests

- **Status**: Completed (2026-07-03) — `tests/storage/sqlite/adapter.test.ts` (10 tests).
- **Role**: test
- **Depends on**: Task 4.2, Task 4.3, Task 5.1
- **Files likely touched**: `tests/storage/sqlite/adapter.test.ts`
- **Acceptance**: `saveImportBatch` persists batch + entries; `checkDuplicateIds` correct; duplicate-on-save rejects whole batch (no partial); rollback on failure; `StorageHandoffPort` contract compliance.
- **Coverage**: port assignability, save success + zero-entry batch, `checkDuplicateIds` ordering, in-batch duplicate / existing-DB duplicate / entry-batch mismatch rejection with no partial persistence, transactional rollback on CHECK-constraint failure, content-free error messages.

### Task 6.5 — Privacy/no-network guard tests

- **Status**: Completed (2026-07-03) — `tests/storage/sqlite/privacy.test.ts` (4 tests).
- **Role**: privacy-review
- **Depends on**: Task 4.2, Task 5.1
- **Files likely touched**: `tests/storage/sqlite/privacy.test.ts`
- **Acceptance**: banned full-answer fields never persisted (even if present on input object); no raw-row storage; no network calls during any operation; error messages contain no prompt content.
- **Coverage**: banned fields dropped from a widened input object (schema + serialized row checked), no raw/blob tables or columns, no `globalThis.fetch` during init/save/duplicate-check, failure payloads leak neither prompt text nor banned placeholder.

---

## Wave 7 — Documentation and Closeout

### Task 7.1 — Storage documentation

- **Status**: Completed (2026-07-03) — `docs/storage.md` created.
- **Role**: documentation
- **Depends on**: Waves 0–6 complete
- **Files likely touched**: `docs/storage.md` (if useful)
- **Goal**: Concise docs — purpose, schema summary, factory usage, privacy rules, non-goals.
- **Acceptance**: brief and practical; no large code dumps; no real prompt data.

### Task 7.2 — Project memory and changelog closeout

- **Status**: Completed (2026-07-03) — spec marked complete in HANDOFF.md, CHANGELOG.md, tasks.md. Backup branch created.
- **Role**: documentation
- **Depends on**: Waves 0–6 complete
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`, `.kiro/specs/02-sqlite-data-layer/tasks.md`
- **Goal**: Mark spec complete; record model/reasoning, files, verification.
- **Acceptance**: HANDOFF reflects completion; CHANGELOG entry accurate; no planned work marked complete. Optional backup snapshot after implementation completes.

---

## Parallelization Guidance

Do not parallelize early implementation until the user approves.

**Safe future parallel candidates:**
- Repository tests (Task 6.3) after repository interfaces are stable.
- Documentation (Task 7.1) after implementation is stable.
- Migration tests (Task 6.2) after Wave 2, alongside repository work if files do not overlap.

**Do not parallelize:**
- Package install (Task 0.3) and runtime code that depends on it.
- Migration/schema work (Wave 2).
- Transaction/duplicate handling (Task 4.2).
- Privacy/no-answer-storage tests (Task 6.5) — verify serially against final adapter.
- Adapter work before repositories and migrations are stable.
- Any tasks editing the same file (e.g., 3.2 and 3.3 both touch the prompt-log repository).

---

## Recommended Implementation Order

1. Wave 0: Task 0.1, Task 0.2, then Task 0.3 (install only after preflight passes).
2. Wave 1: Task 1.1, Task 1.2.
3. Wave 2: Task 2.1, Task 2.2.
4. Wave 3: Task 3.1, Task 3.2, Task 3.3.
5. Wave 4: Task 4.1, Task 4.2, Task 4.3.
6. Wave 5: Task 5.1, Task 5.2.
7. Wave 6: Task 6.1–6.5.
8. Wave 7: Task 7.1, Task 7.2.

### Suggested First Implementation Pass

- Task 0.1 — scaffolding (folder + barrel)
- Task 0.2 — better-sqlite3 compatibility preflight
- Task 0.3 — install better-sqlite3 (+ types) only if preflight passes

Keep runtime logic out of the first pass. Confirm the native dependency installs cleanly and `typecheck`/`test` stay green before writing connection/migration code.
