# 05-dashboard-v1 Requirements

## 1. Purpose

Local-first prompt quality dashboard for viewing, filtering, and understanding imported prompt scores. The dashboard provides the first user-facing data surface for cookedPrompts — making scored prompt data visible, navigable, and actionable.

Product framing: roast the prompt, coach the user, improve the habit.

The dashboard assumes prompt logs have been imported (01-local-importer) and scored (03-scoring-engine + 04-scoring-persistence). It reads existing data from local SQLite — it does not trigger import or scoring workflows.

---

## 2. Current Context

Foundation already implemented:

- **PromptScoreRepository**: save/saveMany, getById, getByPromptLogId, getByPromptLogIds, list(options with composable filters), countByIssueLabel, countByConfidence. Never selects prompt_text.
- **PromptLogRepository**: insert, getById, list, listByBatch, findExistingIds. Returns full PromptLogEntry including prompt_text.
- **SqliteStorageAdapter**: wraps ImportBatch + PromptLog repos for importer handoff only. Does NOT expose PromptScoreRepository.
- **createSqliteStorage**: returns StorageHandoffPort (importer-focused).
- **scorePrompt/scorePrompts**: pure in-memory scoring, produces PromptScore.
- **PromptScore type**: id, prompt_log_id, 8 dimension scores, issue_labels, explanations, confidence, scoring_version, scored_at. No prompt_text.
- **PromptLogEntry type**: id, timestamp, source, provider, model_used, prompt_text, import_batch_id, plus metadata fields.
- **MAX_LIST_LIMIT = 1000** for bounded pagination.

Key gaps identified:

1. PromptScoreRepository is standalone — not exposed via factory/adapter yet. Dashboard will need it.
2. No average-by-dimension method exists — list + in-memory calculation or new repo method needed.
3. No total scored prompt count method — would need to be added or computed from list.
4. ImportBatchRepository is accessible but not through the public factory surface.

---

## 3. User Stories

1. As a user, I can see a local overview of my imported prompt quality (total scored, average score, needs-action count, most common issue).
2. As a user, I can identify weak prompts that need improvement by browsing a filterable scored prompt list.
3. As a user, I can see common issue labels across my prompt history to understand recurring patterns.
4. As a user, I can inspect one prompt's full score breakdown, explanations, and metadata to understand what went wrong.
5. As a user, I can filter scores by import batch, scoring version, confidence, issue label, and score range.
6. As a user, I can use the dashboard without sending any data to the cloud or network.

---

## 4. Functional Requirements

### 4.1 Summary/Overview Cards

The dashboard must provide an overview with:

- **Total scored prompts**: count of all scored prompt log entries.
- **Average overall score**: mean of `overall_score` across scored prompts (0–5, one decimal).
- **Low-confidence count**: number of scores with `confidence = 'low'`.
- **Needs-action count**: number of scores with `overall_score <= 2`.
- **Most common issue label**: the `ScoringIssueLabel` with the highest count (null if no labels exist).

### 4.2 Score List

A paginated list of scored prompts, newest first, showing per item:

- Score ID.
- Prompt log ID (or safe display identifier).
- Timestamp (from prompt log).
- Source, provider, model_used (from prompt log metadata).
- Overall score (0–5).
- Confidence (low/medium/high).
- Issue labels (array).
- Scoring version.
- Scored at (ISO 8601).

The list must:

- Support bounded pagination (limit/offset, max 1000 per page).
- Default to newest first (`scored_at DESC`).
- Never include `prompt_text` in list items.

### 4.3 Detail View

A single-prompt detail view showing:

- All 8 dimension scores (overall, clarity, context, constraints, output_format, capability_fit, efficiency, safety_privacy).
- Issue labels.
- Explanations (array of strings).
- Confidence.
- Scoring version and scored_at.
- Prompt metadata: id, timestamp, source, provider, model_used, input_tokens, output_tokens, total_tokens, estimated_cost, latency_ms, tags.
- Prompt text (local-only display, loaded separately from PromptLogRepository.getById).

Privacy decision: prompt_text is displayed locally in the detail view only. It is never included in list DTOs, aggregate results, or transmitted anywhere.

### 4.4 Filters

Composable AND filters for list and aggregate views:

- `importBatchId`: filter by import batch.
- `scoringVersion`: filter by scoring rule version.
- `confidence`: filter by low/medium/high.
- `issueLabel`: filter by a specific issue label.
- `overallScoreMin` / `overallScoreMax`: filter by score range.
- `includeDeletedPromptLogs`: opt-in to include soft-deleted.

### 4.5 Aggregate Views

- **Counts by issue label**: number of scores per issue label.
- **Counts by confidence**: number of scores per confidence level.
- **Average score by dimension**: average of each dimension score across matching results (computed in-memory from list results for V1).

### 4.6 Data Refresh

The dashboard must support reloading/refreshing data from the local database without restarting the application.

---

## 5. Data Requirements

- Dashboard reads from `PromptScoreRepository` and `PromptLogRepository`.
- Aggregates (overview, counts, dimension summaries) must not require or return `prompt_text`.
- Detail view may read `prompt_text` from `PromptLogRepository.getById` for local display only.
- No new tables needed for V1 dashboard (uses existing repos).
- `PromptScoreRepository` must be accessible — currently not exposed via public factory. This is a gap to address.
- All queries must respect `MAX_LIST_LIMIT = 1000` pagination bounds.
- Average-by-dimension computed in-memory from paginated list results (no new repository method needed for V1).

---

## 6. Privacy Requirements

- **Local-only**: no network calls, no cloud sync, no telemetry.
- **No prompt text in aggregates/list DTOs**: overview, list items, counts, and dimension summaries never include `prompt_text`.
- **No full model answers**: not stored, not queried, not displayed.
- **No banned full-answer fields**: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text` — never present.
- **No telemetry or cloud sync**: no fetch calls, no external endpoints.
- **No secret substrings in logs/errors**: error messages are content-free (field names and categories only).
- **Detail view prompt_text**: local-only display, loaded via separate repository call, never aggregated or transmitted.
- **Content-free errors**: all error messages reference option names and categories, never prompt content.

---

## 7. Non-Functional Requirements

- Dashboard data service must be testable without a UI framework.
- No new package dependencies for the data service layer.
- TypeScript strict mode; ESM `.js` import specifiers.
- Deterministic test results with synthetic data.
- All methods must handle empty databases gracefully.
- Response time for overview/list on datasets up to 10,000 scores must remain acceptable for local use.

---

## 8. Empty and Error States

- **No imports exist** (zero prompt logs): overview returns zeroes/nulls, list returns empty.
- **Imports exist but no scores** (scoring not yet run): same behavior — zero counts, empty lists.
- **Corrupt/invalid local database**: content-free error, no stack traces with prompt data.
- **Unsupported scoring version in filter**: returns empty results (no error).
- **No matching filter results**: returns empty list, zero counts — not an error.
- **Score references a deleted/missing prompt log**: score excluded from list by default (soft-delete filter); detail view returns null for prompt metadata.

---

## 9. Non-goals / Out of Scope

- Cloud dashboard, auth/login, billing.
- Team analytics, sharing, export flows.
- Browser extension, VS Code/Kiro extension, API wrapper.
- LLM judge, rewrite generation, template system.
- Model recommendation engine, gamification.
- Advanced charts requiring new visualization packages.
- Full-text search.
- Editing/deleting prompt logs via dashboard.
- New package dependencies in spec tasks unless separately approved.
- End-to-end scoring orchestration (scores assumed to already exist).
- Real-time data streaming or WebSocket updates.
- User preferences/settings persistence.
- Sorting options beyond newest-first (V1 uses scored_at DESC only).

---

## 10. Open Questions for Design

1. **Implementation approach**: CLI report, local web UI, or data service layer first?
2. **Should PromptScoreRepository be exposed through the factory/adapter in this spec?**
3. **How to compute average-by-dimension**: new repository method or in-memory from list results?
4. **Should the dashboard assume scores already exist, or should it trigger scoring?**
5. **Safe prompt text preview**: full text or truncated preview in list view?
6. **Pagination UX**: cursor-based or offset-based for the viewing surface?
