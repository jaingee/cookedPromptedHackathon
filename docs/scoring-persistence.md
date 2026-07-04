# Scoring Persistence

## Purpose

Scoring persistence stores deterministic `PromptScore` results in local SQLite for dashboard queries and data viewing. It bridges the scoring engine (pure, in-memory) with queryable storage so future UI features can list, filter, and aggregate scores without recalculating.

Product framing: roast the prompt, coach the user, improve the habit.

## Scope

- Migration 002 (`scoring_persistence`): creates `prompt_scores` and `prompt_score_labels` tables with indexes.
- `PromptScoreRepository`: save, read, query, filter, and count operations.
- Privacy guardrails: local-only, no prompt text in score tables, no network.

Out of scope: end-to-end scoring job orchestration, dashboard UI, factory/adapter exposure, cloud sync.

## Schema Summary

### prompt_scores

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID-style string |
| prompt_log_id | TEXT NOT NULL | FK → prompt_logs(id) |
| overall_score | INTEGER 0–5 | CHECK constraint |
| clarity_score | INTEGER 0–5 | CHECK constraint |
| context_score | INTEGER 0–5 | CHECK constraint |
| constraints_score | INTEGER 0–5 | CHECK constraint |
| output_format_score | INTEGER 0–5 | CHECK constraint |
| capability_fit_score | INTEGER 0–5 | CHECK constraint |
| efficiency_score | INTEGER 0–5 | CHECK constraint |
| safety_privacy_score | INTEGER 0–5 | CHECK constraint |
| confidence | TEXT | CHECK IN ('low','medium','high') |
| explanations_json | TEXT NOT NULL | JSON array of strings |
| scoring_version | TEXT NOT NULL | Rule version that produced this score |
| scored_at | TEXT NOT NULL | ISO 8601 |
| created_at | TEXT NOT NULL | Storage-managed |
| updated_at | TEXT NOT NULL | Storage-managed |
| user_id | TEXT | Nullable (future auth) |
| workspace_id | TEXT | Nullable (future workspaces) |
| sync_status | TEXT | Nullable (future sync) |

Unique constraint: `(prompt_log_id, scoring_version)`.

### prompt_score_labels

| Column | Type | Notes |
|--------|------|-------|
| prompt_score_id | TEXT NOT NULL | FK → prompt_scores(id) ON DELETE CASCADE |
| label | TEXT NOT NULL | One of the known issue labels |

Unique constraint: `(prompt_score_id, label)`.

### Relationships

- `prompt_scores.prompt_log_id` → `prompt_logs.id` (FK).
- `prompt_score_labels.prompt_score_id` → `prompt_scores.id` (cascade delete).
- No `deleted_at` on `prompt_scores` in V1.
- No `scoring_runs` table in V1.

## Repository API Summary

```typescript
class PromptScoreRepository {
  save(score: PromptScore): PromptScoreSaveResult;
  saveMany(scores: readonly PromptScore[]): PromptScoreSaveResult;
  getById(id: string): PromptScore | null;
  getByPromptLogId(promptLogId: string, options?): PromptScore | null;
  getByPromptLogIds(ids: readonly string[], options?): PromptScore[];
  list(options: PromptScoreListOptions): PromptScore[];
  countByIssueLabel(options?): Array<{ label; count }>;
  countByConfidence(options?): Array<{ confidence; count }>;
}
```

## Replace/Upsert Policy

- One active score per `(prompt_log_id, scoring_version)` pair.
- Same pair replaces: delete old score row (labels cascade-delete), then insert incoming score.
- Stored id becomes the incoming `PromptScore.id`.
- Different `scoring_version` values coexist as separate rows.

## Query/Filter/Count Behavior

- `list(options)` supports bounded pagination (newest first) and composable AND filters: `promptLogId`, `importBatchId`, `issueLabel`, `confidence`, `scoringVersion`, `overallScoreMin`, `overallScoreMax`.
- Soft-deleted prompt logs (`deleted_at IS NOT NULL`) are excluded by default.
- `includeDeletedPromptLogs` opt-in overrides soft-delete exclusion.
- `countByIssueLabel` and `countByConfidence` aggregate with optional batch/version filters and soft-delete exclusion.

## Privacy Guardrails

- Local SQLite only. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge.
- No `prompt_text` column in scoring tables.
- Score repository queries never select or return `prompt_logs.prompt_text`.
- No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).
- No raw parsed rows. No matched secret substrings.
- Error messages are content-free (field/category names only, never prompt content).
- Explicit column selection in all queries (no `SELECT *`).

## Tests and Verification

Wave 4 added 63 new scoring persistence tests across three files:

- `prompt-score-repository.test.ts` — save/read round-trip, batch transactions, replace/upsert, list/filter, aggregates.
- `prompt-score-privacy.test.ts` — no prompt_text/banned fields, no fetch, content-free errors, source code guardrails.
- `migrations.test.ts` — scoring table/index creation, constraint enforcement, cascade behavior.

Baseline at Wave 4 completion: 22 test files, 268 tests passing. Verified with `npm run typecheck`, `npm test`, and `git diff --check`.

## Deferred / Out of Scope

- Factory/adapter exposure of `PromptScoreRepository`.
- End-to-end scoring job (`scorePrompts → saveMany` orchestration).
- Dashboard UI.
- `scoring_runs` table.
- `deleted_at` on `prompt_scores`.
- Supabase/cloud sync, auth/login, billing.
- Browser extension, API wrapper, VS Code/Kiro extension.
- LLM judge, scoring heuristic changes.
- `PromptScore` shape changes.
