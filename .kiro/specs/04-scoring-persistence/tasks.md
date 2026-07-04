# 04-scoring-persistence Tasks

## Current Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.

Baseline before implementation: 20 test files, 203 tests passing.
Final baseline: 22 test files, 268 tests passing.

## Guardrails

All waves must respect these rules:

- Local SQLite only. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge.
- No `prompt_text` in score tables.
- No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).
- No raw parsed rows; no matched secret substrings; no source answer storage.
- No scoring heuristic changes.
- No `PromptScore` shape changes unless a real mismatch blocks persistence.
- No dashboard, model recommendation, rewrite/template, or exports UI work.
- No auth/login/billing/extensions.
- No new packages.
- Synthetic test data only.
- TypeScript strict mode; ESM `.js` import specifiers.
- Explicit column mapping (no object spread into SQL).

---

## Wave 0 — Task Plan and Public Boundaries

### Task 0.1 — Create 04-scoring-persistence tasks document

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: requirements + design complete
- **Files likely touched**: `.kiro/specs/04-scoring-persistence/tasks.md`
- **Goal**: Create a reviewable task plan from requirements/design.
- **Acceptance**: tasks split into migration, repository core, query/filter, tests/privacy, and closeout waves; no implementation started.

### Task 0.2 — Confirm implementation boundaries

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Task 0.1
- **Goal**: Capture what this spec will and will not implement.
- **Acceptance**: end-to-end scoring job, dashboard, factory/adapter exposure, model recommendation, rewrite system, and exports remain deferred unless later tasks explicitly add them.

---

## Wave 1 — Migration 002 Scoring Schema

### Task 1.1 — Add migration-002-scoring.ts

- **Status**: Completed (2026-07-03) — `src/storage/sqlite/migrations/migration-002-scoring.ts`.
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/storage/sqlite/migrations/migration-002-scoring.ts`
- **Goal**: Create migration version 2 named `scoring_persistence`.
- **Acceptance**: creates `prompt_scores`, `prompt_score_labels`, and six indexes; in-code TypeScript migration style; no `.sql` files; no `prompt_text`/full-answer columns; typecheck passes.

### Task 1.2 — Add prompt_scores table

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/storage/sqlite/migrations/migration-002-scoring.ts`
- **Goal**: Persist core `PromptScore` fields.
- **Acceptance** — columns: `id TEXT PRIMARY KEY`, `prompt_log_id TEXT NOT NULL`, eight `*_score INTEGER NOT NULL CHECK (BETWEEN 0 AND 5)`, `confidence TEXT NOT NULL CHECK IN ('low','medium','high')`, `explanations_json TEXT NOT NULL`, `scoring_version TEXT NOT NULL`, `scored_at TEXT NOT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `user_id TEXT`, `workspace_id TEXT`, `sync_status TEXT`, `UNIQUE (prompt_log_id, scoring_version)`, `FOREIGN KEY (prompt_log_id) REFERENCES prompt_logs(id)`.

### Task 1.3 — Add prompt_score_labels table

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/storage/sqlite/migrations/migration-002-scoring.ts`
- **Goal**: Persist issue labels in a normalized queryable join table.
- **Acceptance**: `prompt_score_id TEXT NOT NULL`, `label TEXT NOT NULL`, `UNIQUE (prompt_score_id, label)`, `FOREIGN KEY (prompt_score_id) REFERENCES prompt_scores(id) ON DELETE CASCADE`; no SQL CHECK for labels (repository validates via `SCORING_ISSUE_LABELS`).

### Task 1.4 — Add scoring indexes

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/storage/sqlite/migrations/migration-002-scoring.ts`
- **Goal**: Support lookup, filters, sorting, and dashboard query needs.
- **Acceptance** — indexes: `idx_prompt_scores_prompt_log_id`, `idx_prompt_scores_scoring_version`, `idx_prompt_scores_confidence`, `idx_prompt_scores_overall_score`, `idx_prompt_scores_scored_at`, `idx_prompt_score_labels_label`.

### Task 1.5 — Register migration 002

- **Status**: Completed (2026-07-03) — appended `migration002Scoring` to `MIGRATIONS`.
- **Role**: implementation
- **Depends on**: Tasks 1.1–1.4
- **Files likely touched**: `src/storage/sqlite/migrations/index.ts`
- **Goal**: Append `migration002Scoring` to `MIGRATIONS` after `migration001Initial`.
- **Acceptance**: versions unique and increasing; runner remains forward-only and idempotent; existing migrations still pass.

---

## Wave 2 — PromptScoreRepository Save/Read Core

### Task 2.1 — Add PromptScoreRepository file and types

- **Status**: Completed (2026-07-03) — `src/storage/sqlite/repositories/prompt-score-repository.ts`.
- **Role**: implementation
- **Depends on**: Wave 1
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Create the repository class and supporting interfaces.
- **Acceptance**: exports `PromptScoreListOptions`, `PromptScoreSaveResult`, `PromptScoreRepository`; imports `PromptScore`/`ScoreValue`/`ScoreConfidence`/`ScoringIssueLabel` and `SCORING_ISSUE_LABELS`; uses `SqliteDatabase` and `normalizePagination`; typecheck passes.

### Task 2.2 — Implement PromptScore validation

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 2.1
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Validate a `PromptScore` before any SQL write.
- **Acceptance**: all score values integers 0–5; `confidence` in low/medium/high; `id`/`prompt_log_id`/`scoring_version`/`scored_at` non-empty; `issue_labels` all known; `explanations` an array of strings and JSON-serializable; reject banned full-answer fields present on the object; content-free errors (no prompt_text, matched substrings, raw content, fake secrets, or answers).

### Task 2.3 — Implement save(score)

- **Status**: Completed (2026-07-03) — delegates to `saveMany([score])`.
- **Role**: implementation
- **Depends on**: Tasks 2.1, 2.2
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Persist a single `PromptScore` transactionally.
- **Acceptance**: saves `prompt_scores` row + `prompt_score_labels` rows + `explanations_json`; explicit column mapping; no object spread; no `prompt_text` stored; returns `PromptScoreSaveResult`.

### Task 2.4 — Implement saveMany(scores)

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 2.3
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Persist multiple records in one all-or-nothing transaction.
- **Acceptance**: empty array returns `{ saved_count: 0, replaced_count: 0 }`; rejects duplicate `PromptScore.id` in batch before writing; rejects duplicate `(prompt_log_id, scoring_version)` in batch before writing; any failure rolls back all; labels and explanations persist atomically.

### Task 2.5 — Implement replace/upsert policy

- **Status**: Completed (2026-07-03) — delete-old + insert-new; stored id = incoming id.
- **Role**: implementation
- **Depends on**: Tasks 2.3, 2.4
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Enforce one active score per `(prompt_log_id, scoring_version)`.
- **Acceptance**: same pair replaces transactionally; different versions coexist; replacement stores incoming `PromptScore.id`; old labels removed (cascade or explicit); new labels inserted; `saved_count`/`replaced_count` accurate.

### Task 2.6 — Implement read mapping helpers

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 2.1
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Map raw rows back to the exact `PromptScore` shape.
- **Acceptance**: hydrates `issue_labels` from `prompt_score_labels`; orders labels canonically via `SCORING_ISSUE_LABELS`; parses `explanations_json` safely (returns `[]` on parse failure); never returns raw rows; never includes `prompt_text`.

### Task 2.7 — Implement getById

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 2.6
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Read one `PromptScore` by score id.
- **Acceptance**: returns `PromptScore` or `null`; excludes soft-deleted prompt logs by default if joining `prompt_logs`; no `prompt_text` returned.

### Task 2.8 — Implement getByPromptLogId

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 2.6
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Read latest or version-specific score for one prompt log.
- **Acceptance**: returns that version when `scoringVersion` provided; otherwise latest by `scored_at DESC, scoring_version DESC`; excludes soft-deleted prompt logs by default; `includeDeletedPromptLog` opts in; returns `null` if not found.

### Task 2.9 — Implement getByPromptLogIds

- **Status**: Completed (2026-07-03) — delegates per-id to getByPromptLogId, preserving order.
- **Role**: implementation
- **Depends on**: Task 2.6
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Read scores for multiple prompt log IDs.
- **Acceptance**: optional `scoringVersion`; preserves caller order where practical; empty input returns `[]`; excludes soft-deleted prompt logs by default; no `prompt_text` returned.

---

## Wave 3 — Query, Filter, and Aggregate Methods

### Task 3.1 — Implement list(options)

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: List records with bounded pagination and composable filters.
- **Acceptance**: uses `normalizePagination`/`MAX_LIST_LIMIT`; orders newest first (`scored_at DESC, id DESC`); supports `promptLogId`, `importBatchId` (join `prompt_logs`), `issueLabel` (join `prompt_score_labels`), `confidence`, `scoringVersion`, `overallScoreMin`/`overallScoreMax`; excludes soft-deleted prompt logs by default; `includeDeletedPromptLogs` opts in.

### Task 3.2 — Implement countByIssueLabel

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 3.1
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Support dashboard label counts.
- **Acceptance**: counts grouped by label; optional `importBatchId`/`scoringVersion`; excludes soft-deleted prompt logs by default; typed `{ label, count }` results; no `prompt_text` selected.

### Task 3.3 — Implement countByConfidence

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 3.1
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts`
- **Goal**: Support dashboard confidence counts.
- **Acceptance**: counts grouped by confidence; optional `importBatchId`/`scoringVersion`; excludes soft-deleted prompt logs by default; typed `{ confidence, count }` results; no `prompt_text` selected.

### Task 3.4 — Query privacy review

- **Status**: Completed (2026-07-03).
- **Role**: privacy-review
- **Depends on**: Tasks 3.1–3.3
- **Files likely touched**: `src/storage/sqlite/repositories/prompt-score-repository.ts` (review)
- **Goal**: Ensure persistence never selects or returns `prompt_text`.
- **Acceptance**: no `SELECT *` joins that hydrate `prompt_logs.prompt_text`; queries explicitly select `prompt_scores` columns only; errors/logs contain no prompt content; no network/fetch.

---

## Wave 4 — Tests and Privacy Verification

### Task 4.1 — Add scoring persistence test helpers

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Wave 3
- **Files likely touched**: `tests/storage/sqlite/prompt-score-test-helpers.ts`
- **Goal**: Synthetic `PromptScore` and `PromptLogEntry` fixtures for persistence tests.
- **Acceptance**: synthetic only; no real prompts/secrets/full-answer fields; reusable across migration/repository/privacy tests.

### Task 4.2 — Test migration 002

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Wave 1, Task 4.1
- **Files likely touched**: `tests/storage/sqlite/migrations.test.ts`
- **Goal**: Verify scoring tables and indexes are created.
- **Acceptance**: `prompt_scores` + `prompt_score_labels` exist; `schema_migrations` records version 2; expected indexes exist; re-run idempotent; existing migration tests still pass.

### Task 4.3 — Test save/read single PromptScore

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Wave 2, Task 4.1
- **Files likely touched**: `tests/storage/sqlite/prompt-score-repository.test.ts`
- **Goal**: Round-trip one `PromptScore`.
- **Acceptance**: all score fields round-trip; `issue_labels` canonical; `explanations` round-trip from `explanations_json`; `prompt_log_id` preserved; no `prompt_text` returned.

### Task 4.4 — Test saveMany transaction behavior

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Task 4.3
- **Files likely touched**: `tests/storage/sqlite/prompt-score-repository.test.ts`
- **Goal**: Verify all-or-nothing batch persistence.
- **Acceptance**: valid batch persists all; invalid score rolls back all; duplicate `PromptScore.id` in batch rejected pre-write; duplicate `(prompt_log_id, scoring_version)` pair in batch rejected pre-write.

### Task 4.5 — Test duplicate/re-score policy

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Task 4.3
- **Files likely touched**: `tests/storage/sqlite/prompt-score-repository.test.ts`
- **Goal**: Verify replace/upsert behavior.
- **Acceptance**: same pair replaces old score; stored id equals incoming id after replacement; old labels removed; new labels inserted; `replaced_count` increments; different `scoring_version` values coexist.

### Task 4.6 — Test list/filter methods

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Wave 3, Task 4.1
- **Files likely touched**: `tests/storage/sqlite/prompt-score-repository.test.ts`
- **Goal**: Verify list query behavior.
- **Acceptance**: bounded pagination; newest-first order; filters by `promptLogId`, `importBatchId`, `issueLabel`, `confidence`, `scoringVersion`, `overallScoreMin`/`overallScoreMax`; soft-deleted prompt logs excluded by default; `includeDeletedPromptLogs` opts in.

### Task 4.7 — Test aggregate methods

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Wave 3, Task 4.1
- **Files likely touched**: `tests/storage/sqlite/prompt-score-repository.test.ts`
- **Goal**: Verify `countByIssueLabel` and `countByConfidence`.
- **Acceptance**: counts grouped correctly; optional `importBatchId`/`scoringVersion` filters work; soft-deleted prompt logs excluded by default.

### Task 4.8 — Test privacy/no-network guardrails

- **Status**: Completed (2026-07-03)
- **Role**: privacy-review
- **Depends on**: Wave 3, Task 4.1
- **Files likely touched**: `tests/storage/sqlite/prompt-score-privacy.test.ts`
- **Goal**: Prove persistence does not leak prompt text, banned fields, or network calls.
- **Acceptance**: `globalThis.fetch` not called during save/read/list/count; `prompt_scores` and `prompt_score_labels` have no `prompt_text` column; no banned full-answer columns; repository outputs contain no `prompt_text`; error messages contain no fake prompt text or secret values; stored explanations contain no fake secret substrings.

### Task 4.9 — Existing baseline regression

- **Status**: Completed (2026-07-03)
- **Role**: test
- **Depends on**: Tasks 4.2–4.8
- **Files likely touched**: none (verification)
- **Goal**: Ensure prior importer/storage/scoring tests still pass.
- **Acceptance**: all existing 203 tests continue passing; new tests added and passing.

---

## Wave 5 — Documentation and Closeout

### Task 5.1 — Add scoring persistence documentation

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Waves 1–4
- **Files likely touched**: `docs/scoring-persistence.md` (or extend `docs/storage.md`)
- **Goal**: Document schema, repository API, duplicate policy, privacy guardrails, and non-goals.
- **Acceptance**: concise; no real prompt data; no real secrets; no large code dumps.

### Task 5.2 — Mark 04-scoring-persistence complete

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Waves 1–4
- **Files likely touched**: `.kiro/specs/04-scoring-persistence/tasks.md`
- **Goal**: Mark all tasks complete after implementation, tests, and docs pass.
- **Acceptance**: only mark complete after verification passes; deferred items remain deferred.

### Task 5.3 — Update HANDOFF and CHANGELOG closeout

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Task 5.2
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`
- **Goal**: Mark spec complete and record final verification.
- **Acceptance**: accurate status; no dashboard/model recommendation/rewrite/export work marked done.

### Task 5.4 — Backup branch after completion

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Task 5.3
- **Files likely touched**: none (git operation only)
- **Goal**: Create `backup/after-04-scoring-persistence-complete` after full closeout.
- **Acceptance**: branch points at final closeout commit; pushed to origin; no force push.

---

## Deferred / Out of Scope

- End-to-end scoring job (`scorePrompts → saveMany` orchestration).
- Exposing `PromptScoreRepository` through the storage factory/adapter public surface.
- `scoring_runs` table.
- `deleted_at` on `prompt_scores`.
- Dashboard UI, model recommendation, rewrite/template system, exports.
- Cloud sync / Supabase, auth/login, billing.
- Browser extension, API wrapper/proxy, VS Code/Kiro extension.
- LLM judge, scoring heuristic changes.
- `PromptScore` shape changes (unless a real persistence blocker is found).
- Prompt text duplication in score tables; full model answer storage.

---

## Recommended Implementation Order

1. Wave 1: Task 1.1–1.5 (migration + registration).
2. Wave 2: Task 2.1–2.9 (repository core).
3. Wave 3: Task 3.1–3.4 (query/filter/count).
4. Wave 4: Task 4.1–4.9 (tests + privacy).
5. Wave 5: Task 5.1–5.4 (docs + closeout + backup).

## Parallelization Guidance

- Do not parallelize early implementation unless the user approves.
- Safe future parallel candidates: independent query/count methods (Wave 3) after the repository core and read mapping are stable; independent test files (Wave 4) after Wave 3 stabilizes.
- Do not parallelize: the migration and its registration; save/replace logic and read mapping that share helpers; privacy-sensitive query construction.
