# 04-scoring-persistence Requirements

## 1. Purpose

Persist deterministic `PromptScore` results locally in SQLite so that future dashboard, UI, and export features can query prompt scores, issue labels, explanations, confidence, and scoring metadata without recalculating scores every time.

This spec bridges `02-sqlite-data-layer` (local persistence) and `03-scoring-engine` (pure scoring) by defining the storage layer for scoring output.

---

## 2. Current Context

### Completed dependencies

- **01-local-importer** — imports and normalizes `PromptLogEntry` records.
- **02-sqlite-data-layer** — persists `ImportBatch` and `PromptLogEntry` in SQLite with migrations, repositories, and a factory.
- **03-scoring-engine** — produces `PromptScore` in memory via `scorePrompt`/`scorePrompts`.

### What exists today

- `PromptScore` is generated purely in memory.
- 203 tests pass across importer, storage, and scoring.
- SQLite has `import_batches`, `prompt_logs`, `prompt_log_tags`, and `schema_migrations`.
- The migration runner is in-code, forward-only, and idempotent.
- Tags are stored in a normalized join table (`prompt_log_tags`).

### What is missing

- No SQLite tables for `prompt_scores` or score labels.
- No repository for saving/reading scores.
- No migration for the scoring schema.
- No batch-save workflow connecting scoring output to storage.

---

## 3. Functional Requirements

### FR-1: Save a single PromptScore

Persist a complete `PromptScore` record (all dimension scores, overall score, labels, explanations, confidence, version, scored_at) to local SQLite.

### FR-2: Save a batch of PromptScores

Persist multiple `PromptScore` records in a single transactional operation. All-or-nothing: if any record fails, none persist.

### FR-3: Read a score by prompt_log_id

Retrieve the stored score for a given prompt log ID. If multiple scores exist for the same prompt (different versions), return the most recent by default.

### FR-4: Read scores by multiple prompt_log_ids

Retrieve stored scores for a list of prompt log IDs in a single query.

### FR-5: List scores with pagination

Support bounded, paginated listing of scores (newest first by `scored_at`).

### FR-6: Filter by issue label

Support querying scores that contain a specific issue label (e.g., "all prompts flagged `possible_secret`").

### FR-7: Filter by confidence level

Support querying scores by confidence (`low`, `medium`, `high`).

### FR-8: Filter by score range

Support querying scores where a given dimension or overall score falls within a range (e.g., `overall_score <= 2`).

### FR-9: Filter by scoring_version

Support querying scores by the version of the scoring rules that produced them.

### FR-10: Handle duplicate/re-score

Define clear behavior when a prompt is scored again:
- Same `prompt_log_id` + same `scoring_version`: the design must decide whether to reject, replace, or coexist. Requirements expect at most one active score per `prompt_log_id` + `scoring_version` pair.
- Same `prompt_log_id` + new `scoring_version`: must be allowed (scores from different rule versions coexist).

### FR-11: Version-aware records

Each persisted score records `scoring_version` so results remain interpretable when rules change.

### FR-12: Integrate with existing migration system

Add new tables via the existing in-code migration runner (`runSqliteMigrations`). Must not break existing tables or tests.

### FR-13: Integrate with scoring engine output

Accept `PromptScore` objects as produced by `03-scoring-engine`. Must not duplicate scoring heuristics, call external AI, or mutate `PromptScore` semantics.

---

## 4. Data Requirements

### DR-1: prompt_scores table

Store core score fields:
- `id` (unique, UUID-style string)
- `prompt_log_id` (references `prompt_logs.id`)
- `overall_score` (integer 0–5)
- `clarity_score` (integer 0–5)
- `context_score` (integer 0–5)
- `constraints_score` (integer 0–5)
- `output_format_score` (integer 0–5)
- `capability_fit_score` (integer 0–5)
- `efficiency_score` (integer 0–5)
- `safety_privacy_score` (integer 0–5)
- `confidence` (text: `'low'`, `'medium'`, or `'high'`)
- `scoring_version` (text)
- `scored_at` (ISO 8601 text)
- `created_at` (ISO 8601 text, storage-managed)
- `user_id` (nullable, for future auth)
- `workspace_id` (nullable, for future workspaces)

### DR-2: prompt_score_labels table (normalized)

Store issue labels in a normalized join table (mirrors the `prompt_log_tags` precedent):
- `prompt_score_id` (references `prompt_scores.id`)
- `label` (text, one of the stable `ScoringIssueLabel` values)
- Unique constraint on `(prompt_score_id, label)`.

Labels must be queryable independently (e.g., "find all scores with `possible_secret`").

### DR-3: Explanations storage

Store explanations safely. Explanations are display-only text and not typically filtered/queried individually.
- Explanations must never contain `prompt_text` or matched secret substrings.
- Storage format (JSON text array or normalized rows) is a design decision.

### DR-4: Referential integrity

`prompt_scores.prompt_log_id` must logically reference `prompt_logs.id`. Whether this is enforced via a foreign key constraint is a design decision (considering cascade behavior).

### DR-5: Supabase-portable schema

Follow the established conventions: explicit columns, UUID-style string IDs, ISO 8601 timestamps, nullable `user_id`/`workspace_id`, no SQLite-only tricks.

### DR-6: No prompt_text duplication

Score tables must never store `prompt_text`. Scores reference prompts by `prompt_log_id` only.

---

## 5. Repository / API Requirements

### RA-1: Save operations

- `savePromptScore(score: PromptScore)` — persist a single score with its labels and explanations.
- `savePromptScores(scores: PromptScore[])` — persist many scores transactionally (all-or-nothing).

### RA-2: Read operations

- `getByPromptLogId(promptLogId: string)` — return the latest score for a prompt log.
- `getByPromptLogIds(ids: string[])` — return scores for multiple prompt logs.
- `list(options: { limit, offset, ... })` — paginated listing.

### RA-3: Query/filter operations

- Filter by `issue_label` (via join on `prompt_score_labels`).
- Filter by `confidence`.
- Filter by score range (e.g., `overall_score <= 2`).
- Filter by `scoring_version`.

### RA-4: Error safety

- Errors must be content-free (no prompt text, no matched substrings).
- Invalid inputs produce safe errors, not crashes.

---

## 6. Batch and Transaction Requirements

### BT-1: All-or-nothing batch save

Saving multiple scores in one call must be transactional: if any score fails validation or constraint checks, no scores are persisted.

### BT-2: Label consistency

When a score is saved, all its labels must persist atomically with the score. No partial label inserts.

### BT-3: Explanation consistency

When a score is saved, its explanations must persist atomically.

### BT-4: Duplicate detection

If a score with the same `prompt_log_id` + `scoring_version` already exists, the system must either reject the new save with a clear error or replace it transactionally. The design pass chooses exact behavior.

---

## 7. Query Requirements

These are needed by the future dashboard but should be designed now:

### QR-1: Scores by import batch

List all scores for prompt logs in a given import batch (joinable via `prompt_logs.import_batch_id`).

### QR-2: Aggregate counts

Support counting scores grouped by label, confidence, or score bucket (e.g., "how many prompts scored <= 2 overall?"). May be computed at query time rather than pre-aggregated.

### QR-3: Soft-delete awareness

If `prompt_logs` supports soft-delete (`deleted_at`), score queries should exclude deleted prompt logs by default (joinable behavior).

### QR-4: Bounded pagination

All list/query operations must use bounded pagination matching the existing `MAX_LIST_LIMIT` pattern.

---

## 8. Privacy and Safety Requirements

### PSR-1: Local-only

All persistence is local SQLite. No network calls, cloud sync, telemetry, or external AI.

### PSR-2: No prompt_text in score tables

Score tables never store `prompt_text`. Scores reference `prompt_log_id` only.

### PSR-3: No banned full-answer fields

Score tables never contain `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, or `generated_text`.

### PSR-4: No matched secret substrings

Explanations and labels never contain matched secret values. Labels are stable category constants; explanations are safe category-level text.

### PSR-5: Content-free errors

Error messages from save/read operations must not include prompt text, matched patterns, or raw SQLite internals.

### PSR-6: No raw parsed row storage

No table stores raw imported rows or source blobs.

---

## 9. Testing Requirements

### TR-1: Migration creates scoring tables and indexes

Verify the new migration creates `prompt_scores`, `prompt_score_labels`, and expected indexes without breaking existing tables.

### TR-2: Save and read single score

Round-trip a `PromptScore` through save + read; verify all fields.

### TR-3: Batch save is transactional

Verify all-or-nothing: an invalid score in a batch causes the entire batch to roll back.

### TR-4: Labels are normalized and queryable

Verify labels persist in the join table and can be queried independently.

### TR-5: Duplicate/conflict behavior

Verify the chosen duplicate policy (reject or replace for same `prompt_log_id` + `scoring_version`).

### TR-6: Version-aware reads

Verify that scores from different `scoring_version` values coexist and can be queried by version.

### TR-7: Explanations persist safely

Verify explanations round-trip correctly and never contain prompt text.

### TR-8: Privacy guardrails

Verify no `prompt_text`, banned fields, or matched substrings appear in stored data or error messages.

### TR-9: No network calls

Verify no `globalThis.fetch` during persistence operations.

### TR-10: Pagination and filtering

Verify bounded queries, label filtering, confidence filtering, and score-range filtering work correctly.

### TR-11: Existing tests continue passing

All 203 existing tests must continue to pass after migration and repository additions.

### TR-12: Synthetic data only

All test data must be synthetic. No real prompts, secrets, or model answers.

---

## 10. Non-goals / Out of Scope

- Dashboard UI, charts, frontend routes/components.
- Model recommendation engine.
- Rewrite/template system.
- Export UI.
- Cloud sync / Supabase.
- Auth/login.
- Billing.
- Browser extension / API wrapper / VS Code / Kiro extension.
- LLM scoring judge.
- Changing `PromptScore` output shape (unless a real mismatch blocks persistence).
- Changing scoring heuristics.
- Full model answer storage.
- Prompt text duplication in score tables.

---

## 11. Open Questions for Design

1. **Duplicate policy**: Should saving a score for the same `prompt_log_id` + `scoring_version` reject the new save, or replace/upsert the existing record? Which is simpler for V1?
2. **Explanations storage format**: JSON text array column on `prompt_scores`, or a normalized `prompt_score_explanations` table? JSON is simpler; normalized rows are more consistent with labels but add schema complexity for display-only data.
3. **Foreign key cascade**: Should `prompt_scores.prompt_log_id` use `ON DELETE CASCADE` so deleting a prompt log auto-deletes its scores? Or should scores be preserved with a dangling reference for audit?
4. **Score run/batch concept**: Is a `scoring_version` + `scored_at` on each record sufficient for V1, or does a separate `scoring_runs` table add value for batch-level metadata?
5. **First dashboard query shape**: What specific queries will the first dashboard page need? (List of prompt scores with labels and confidence, grouped/sorted by overall_score or scored_at.)
6. **Index strategy**: Which indexes are needed for the expected query patterns (label lookups, version filtering, batch-based listing, score-range scans)?
7. **Soft-delete on scores**: Should `prompt_scores` have a `deleted_at` column for future soft-delete support, matching the `prompt_logs` pattern?
