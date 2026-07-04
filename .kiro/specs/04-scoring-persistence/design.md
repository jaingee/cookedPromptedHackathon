# 04-scoring-persistence Design

## 1. Overview

`04-scoring-persistence` adds local SQLite storage for `PromptScore` records produced by `03-scoring-engine`. It defines two new tables (`prompt_scores`, `prompt_score_labels`), a forward-only migration (version 2), and a `PromptScoreRepository` for saving and querying scores.

It does not change scoring heuristics, does not alter the `PromptScore` shape, does not store `prompt_text` or model answers, and does not build the dashboard. It prepares queryable data for later dashboard/query workflows.

---

## 2. Goals and Non-goals

### Goals

- Persist `PromptScore` records locally in SQLite.
- Persist issue labels in a normalized, queryable join table.
- Persist explanations safely (display-only JSON text).
- Support single and batch (transactional) saves.
- Support read/list/filter queries for the future dashboard.
- Respect `scoring_version` so scores from different rule versions coexist.
- Preserve local-first privacy (no prompt text, no answers, no network).

### Non-goals

- Dashboard UI, charts, frontend.
- Scoring heuristic changes; `PromptScore` shape changes (unless a real mismatch blocks persistence).
- Model recommendation engine, rewrite system, exports.
- Cloud/Supabase/auth/billing.
- LLM judge, full answer storage, prompt-text duplication in score tables.

---

## 3. Architecture

```
PromptLogEntry[]  (from importer / SQLite prompt_logs)
      │
      ▼
scorePrompts(entries, options)   (03-scoring-engine — pure, in memory)
      │
      ▼
PromptScore[]
      │
      ▼
PromptScoreRepository.saveMany(scores)   (this spec)
      │
      ▼
SQLite:
  - prompt_scores          (one row per prompt_log_id + scoring_version)
  - prompt_score_labels    (normalized labels; mirrors prompt_log_tags)
```

Boundaries:

- The repository consumes `PromptScore` objects only. It never calls `scorePrompt`/`scorePrompts` itself, never imports dimension scorers or `extractSignals`, and never duplicates scoring rules.
- Wiring `scorePrompts(...) → saveMany(...)` into an end-to-end job is deferred; this spec provides the storage half only.
- The repository is composed the same way as existing repositories (constructed with a `SqliteDatabase`), and may later be exposed through the storage factory/adapter. For V1 the repository is standalone.

---

## 4. Data Model

Source type: `PromptScore` from `src/scoring/types.ts`. Column mapping:

| PromptScore field | prompt_scores column |
|-------------------|----------------------|
| `id` | `id` |
| `prompt_log_id` | `prompt_log_id` |
| `overall_score` | `overall_score` |
| `clarity_score` | `clarity_score` |
| `context_score` | `context_score` |
| `constraints_score` | `constraints_score` |
| `output_format_score` | `output_format_score` |
| `capability_fit_score` | `capability_fit_score` |
| `efficiency_score` | `efficiency_score` |
| `safety_privacy_score` | `safety_privacy_score` |
| `confidence` | `confidence` |
| `scoring_version` | `scoring_version` |
| `scored_at` | `scored_at` |
| `issue_labels[]` | rows in `prompt_score_labels` |
| `explanations[]` | `explanations_json` (JSON text array) |

Storage-managed columns (not from `PromptScore`): `created_at`, `updated_at`, `user_id` (nullable), `workspace_id` (nullable), `sync_status` (nullable).

Never stored: `prompt_text`, `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`, raw import rows, matched secret substrings.

---

## 5. SQLite Schema

### prompt_scores

```sql
CREATE TABLE IF NOT EXISTS prompt_scores (
  id                    TEXT PRIMARY KEY,
  prompt_log_id         TEXT NOT NULL,
  overall_score         INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
  clarity_score         INTEGER NOT NULL CHECK (clarity_score BETWEEN 0 AND 5),
  context_score         INTEGER NOT NULL CHECK (context_score BETWEEN 0 AND 5),
  constraints_score     INTEGER NOT NULL CHECK (constraints_score BETWEEN 0 AND 5),
  output_format_score   INTEGER NOT NULL CHECK (output_format_score BETWEEN 0 AND 5),
  capability_fit_score  INTEGER NOT NULL CHECK (capability_fit_score BETWEEN 0 AND 5),
  efficiency_score      INTEGER NOT NULL CHECK (efficiency_score BETWEEN 0 AND 5),
  safety_privacy_score  INTEGER NOT NULL CHECK (safety_privacy_score BETWEEN 0 AND 5),
  confidence            TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  explanations_json     TEXT NOT NULL,
  scoring_version       TEXT NOT NULL,
  scored_at             TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  user_id               TEXT,
  workspace_id          TEXT,
  sync_status           TEXT,
  UNIQUE (prompt_log_id, scoring_version),
  FOREIGN KEY (prompt_log_id) REFERENCES prompt_logs(id)
);
```

### prompt_score_labels

```sql
CREATE TABLE IF NOT EXISTS prompt_score_labels (
  prompt_score_id TEXT NOT NULL,
  label           TEXT NOT NULL,
  UNIQUE (prompt_score_id, label),
  FOREIGN KEY (prompt_score_id) REFERENCES prompt_scores(id) ON DELETE CASCADE
);
```

**Label validation decision**: No SQL `CHECK` constraint enumerating labels. Hardcoding the 12 `SCORING_ISSUE_LABELS` values into SQL creates maintenance risk (the label set may grow, per requirements RL-4) and would require a migration each time. Instead, the repository validates labels against `SCORING_ISSUE_LABELS` before insert. This keeps SQL flexible and keeps the single source of truth in `src/scoring/rules/issue-labels.ts`.

**Cascade decision**: `prompt_score_labels` uses `ON DELETE CASCADE` on `prompt_score_id` because labels are wholly owned child rows of a score — when a score row is deleted or replaced, its labels must go with it. This also simplifies the replace/upsert path.

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_prompt_scores_prompt_log_id ON prompt_scores(prompt_log_id);
CREATE INDEX IF NOT EXISTS idx_prompt_scores_scoring_version ON prompt_scores(scoring_version);
CREATE INDEX IF NOT EXISTS idx_prompt_scores_confidence ON prompt_scores(confidence);
CREATE INDEX IF NOT EXISTS idx_prompt_scores_overall_score ON prompt_scores(overall_score);
CREATE INDEX IF NOT EXISTS idx_prompt_scores_scored_at ON prompt_scores(scored_at);
CREATE INDEX IF NOT EXISTS idx_prompt_score_labels_label ON prompt_score_labels(label);
```

The `UNIQUE (prompt_log_id, scoring_version)` constraint provides the composite lookup index implicitly. No denormalized `import_batch_id` column on `prompt_scores` — batch listing joins to `prompt_logs` (already indexed by `idx_prompt_logs_import_batch_id`).

---

## 6. Migration Plan

- Add `src/storage/sqlite/migrations/migration-002-scoring.ts` exporting a `SqliteMigration` with `version: 2`, `name: 'scoring_persistence'`, and an `up(db)` that runs the two `CREATE TABLE` statements and the six `CREATE INDEX` statements.
- Update `src/storage/sqlite/migrations/index.ts`: append `migration002Scoring` to the `MIGRATIONS` array (after `migration001Initial`).
- Follows the established pattern: in-code SQL constants, no `.sql` files, forward-only, transactional per migration, idempotent (`CREATE TABLE IF NOT EXISTS`, version tracked in `schema_migrations`), no network, no prompt content in errors/logs.
- Existing migration 001 is untouched; existing storage tests must continue to pass.

---

## 7. Repository API

New file: `src/storage/sqlite/repositories/prompt-score-repository.ts`.

```typescript
export interface PromptScoreListOptions extends SqliteListOptions {
  promptLogId?: string;
  importBatchId?: string;
  issueLabel?: ScoringIssueLabel;
  confidence?: ScoreConfidence;
  scoringVersion?: string;
  overallScoreMin?: ScoreValue;
  overallScoreMax?: ScoreValue;
  includeDeletedPromptLogs?: boolean;
}

export interface PromptScoreSaveResult {
  saved_count: number;    // rows inserted (new)
  replaced_count: number; // rows replaced (existing prompt_log_id + scoring_version)
}

export class PromptScoreRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(score: PromptScore): PromptScoreSaveResult;
  saveMany(scores: readonly PromptScore[]): PromptScoreSaveResult;

  getById(id: string): PromptScore | null;
  getByPromptLogId(
    promptLogId: string,
    options?: { scoringVersion?: string; includeDeletedPromptLog?: boolean },
  ): PromptScore | null;
  getByPromptLogIds(
    promptLogIds: readonly string[],
    options?: { scoringVersion?: string; includeDeletedPromptLogs?: boolean },
  ): PromptScore[];

  list(options: PromptScoreListOptions): PromptScore[];

  countByIssueLabel(
    options?: { importBatchId?: string; scoringVersion?: string },
  ): Array<{ label: ScoringIssueLabel; count: number }>;
  countByConfidence(
    options?: { importBatchId?: string; scoringVersion?: string },
  ): Array<{ confidence: ScoreConfidence; count: number }>;
}
```

Mapping rules:

- Explicit column-by-column mapping (no object spread into SQL), matching `PromptLogRepository`.
- Hydrate `issue_labels` from `prompt_score_labels` (`ORDER BY` canonical order — see below).
- Parse `explanations_json` safely with a guarded `JSON.parse`; on parse failure, return `explanations: []` rather than throwing or leaking content.
- Return the exact `PromptScore` shape. Never include `prompt_text`; never return raw SQLite rows.
- Types (`PromptScore`, `ScoreValue`, `ScoringIssueLabel`, `ScoreConfidence`) imported from `src/scoring/types.ts` (or the scoring public index). `SCORING_ISSUE_LABELS` imported for label validation and canonical ordering.

Label hydration ordering: labels are re-ordered to canonical `SCORING_ISSUE_LABELS` order on read (a `dedupeIssueLabels`-style filter) so output matches what the scoring engine produces, keeping round-trips stable.

---

## 8. Query and Filter Design

Supported reads:

- **By score id** — `getById(id)`.
- **Latest by prompt_log_id** — `getByPromptLogId(id)` returns the most recent by `scored_at DESC, scoring_version DESC` when no version specified; exact when `scoringVersion` given.
- **By prompt_log_id + scoring_version** — via `getByPromptLogId(id, { scoringVersion })`.
- **Many by prompt_log_ids** — `getByPromptLogIds(ids)`; preserve caller order where practical (filter/re-sort in memory by input index).
- **Paginated list** — `list(options)`, newest first (`scored_at DESC, id DESC`), bounded by `normalizePagination` / `MAX_LIST_LIMIT`.
- **By import batch** — join `prompt_scores` → `prompt_logs ON prompt_logs.id = prompt_scores.prompt_log_id WHERE prompt_logs.import_batch_id = ?`.
- **By issue label** — join `prompt_score_labels` on `label = ?`.
- **By confidence** — `WHERE confidence = ?`.
- **By scoring_version** — `WHERE scoring_version = ?`.
- **By overall score range** — `WHERE overall_score >= ? AND overall_score <= ?` (either bound optional).
- **Aggregates** — `countByIssueLabel`, `countByConfidence` computed at query time with `GROUP BY`.

Soft-delete: all queries that join `prompt_logs` exclude `prompt_logs.deleted_at IS NOT NULL` by default. `includeDeletedPromptLogs` (or `includeDeletedPromptLog`) opts in for admin/debug. Filters compose (label + confidence + version + batch + range) via conjunctive `WHERE`/join clauses.

---

## 9. Batch and Transaction Design

- `saveMany(scores)` wraps the entire batch in a single `db.transaction(...)`. Any validation failure, constraint violation, or write error rolls back the whole batch; nothing persists.
- For each score: write the `prompt_scores` row (insert or replace) and its `prompt_score_labels` rows atomically. `explanations_json` is written on the score row in the same statement.
- **Pre-write batch guards** (before any write, to return safe content-free errors):
  - Reject if the batch contains duplicate `PromptScore.id` values.
  - Reject if the batch contains duplicate `(prompt_log_id, scoring_version)` pairs.
  - Reject if any score fails validation (Section 10).
- `save(score)` is `saveMany([score])` semantically (single-element transaction) or a direct transactional path; both return `PromptScoreSaveResult`.

---

## 10. Duplicate / Re-score Policy

**Decision: one active score per `(prompt_log_id, scoring_version)`; replace/upsert on conflict.**

- Enforced by `UNIQUE (prompt_log_id, scoring_version)`.
- On save, if no row exists for the pair → insert (`saved_count++`).
- If a row exists for the pair → replace transactionally (`replaced_count++`):
  1. Look up the existing row's id for the `(prompt_log_id, scoring_version)` pair.
  2. Delete the existing `prompt_scores` row (its labels cascade-delete via `ON DELETE CASCADE`).
  3. Insert the incoming score using the incoming `PromptScore.id`, then insert its labels.
- **Stored id equals the incoming `PromptScore.id`** (delete-old + insert-new keeps mapping simple and makes the stored row match the object the caller holds). This is preferred over `UPDATE`-in-place because the incoming id may differ from the previously stored id, and a clean delete+insert guarantees labels and explanations are fully refreshed.
- Different `scoring_version` values for the same `prompt_log_id` coexist as separate rows.

Rationale: scoring is deterministic and local; re-running for the same version should refresh the stored score without manual cleanup, while new versions preserve historical comparability.

---

## 11. Integration with Scoring Engine

- This spec consumes `PromptScore` and imports only types (`PromptScore`, `ScoreValue`, `ScoringIssueLabel`, `ScoreConfidence`) plus `SCORING_ISSUE_LABELS` for validation/ordering.
- It does not import dimension scorers, `extractSignals`, `matchSafetyPatterns`, or the explanation builder.
- It does not call `scorePrompt`/`scorePrompts`. Example future workflow (deferred, not implemented here):

```typescript
const scores = scorePrompts(entries, options);
promptScoreRepository.saveMany(scores);
```

---

## 12. Privacy and Safety Design

Hard boundaries:

- No `prompt_text` in `prompt_scores` or `prompt_score_labels`.
- No banned full-answer fields anywhere.
- No raw parsed rows; no matched secret substrings.
- No network/fetch, no cloud sync/Supabase, no telemetry, no LLM judge.
- Errors and logs are content-free (field/category names only).

Labels and explanations are safe by construction: the scoring engine already emits category-level labels and short category-level explanations (verified by `03-scoring-engine` Wave 4 tests). This spec adds repository-level privacy tests to confirm nothing leaks through persistence.

---

## 13. Error Handling

Validate each incoming `PromptScore` before any SQL write:

- All eight score values are integers within 0–5.
- `confidence` ∈ `{low, medium, high}`.
- `id`, `prompt_log_id`, `scoring_version`, `scored_at` are non-empty strings.
- `issue_labels` are all known `SCORING_ISSUE_LABELS` values.
- `explanations` is an array of strings and is JSON-serializable.
- No banned full-answer fields present on the object.

Safe error style (no prompt content, no matched values):

- `"Invalid PromptScore: overall_score must be between 0 and 5."`
- `"Invalid PromptScore: unknown issue label."`
- `"Duplicate PromptScore in batch for prompt_log_id + scoring_version."`
- `"Duplicate PromptScore id in batch."`

Raw SQLite errors are caught and replaced with content-free messages where practical.

---

## 14. Testing Strategy

Test groups (synthetic data only; to become task requirements later):

- Migration 002 creates `prompt_scores` + `prompt_score_labels` + indexes; migration list includes version 2; idempotent re-run; existing migration/storage tests still pass.
- Repository save/read round-trip (all fields), label hydration, `explanations_json` parse.
- `saveMany` all-or-nothing rollback on an invalid score.
- Duplicate `(prompt_log_id, scoring_version)` replacement/upsert (`saved_count`/`replaced_count`).
- Duplicate id or duplicate pair within one batch rejected pre-write.
- Different `scoring_version` values coexist.
- List by `import_batch_id` via join; label / confidence / version / overall-range filters.
- `countByIssueLabel`, `countByConfidence`.
- Soft-deleted prompt logs excluded by default; `includeDeletedPromptLogs` opts in.
- Privacy: no `prompt_text` / banned fields stored; no fetch during operations; safe errors contain no prompt text or fake secret values.
- Existing 203 tests continue passing.

---

## 15. Implementation Waves Preview

Preview only (tasks.md is a later pass):

- **Wave 0** — repository/types prep (shared types, options interfaces).
- **Wave 1** — `migration-002-scoring.ts` + migration list update.
- **Wave 2** — `PromptScoreRepository` save/read mapping + replace policy.
- **Wave 3** — query/filter/count methods.
- **Wave 4** — tests and privacy verification.
- **Wave 5** — docs (`docs/scoring-persistence.md` or extend `docs/storage.md`), closeout, backup branch.

---

## 16. Deferred Items

- End-to-end scoring job (`scorePrompts → saveMany` orchestration).
- Exposing the repository through the storage factory/adapter public surface.
- `scoring_runs` batch-metadata table.
- `deleted_at` soft-delete on `prompt_scores` (respect `prompt_logs.deleted_at` for now).
- Dashboard UI, model recommendation, rewrite system, exports, cloud sync.
- Normalized `prompt_score_explanations` table (JSON text is sufficient for V1).
