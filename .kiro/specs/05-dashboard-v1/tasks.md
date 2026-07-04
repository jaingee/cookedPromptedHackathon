# 05-dashboard-v1 Tasks

## Current Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.

Baseline before implementation: 22 test files, 268 tests passing.

## Guardrails

All waves must respect these rules:

- Local SQLite only. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge.
- No `prompt_text` in aggregate/list DTOs or queries.
- No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).
- No raw parsed rows; no matched secret substrings; no source answer storage.
- No scoring heuristic changes.
- No `PromptScore` shape changes.
- No new database tables or migrations.
- No auth/login/billing/extensions.
- No new packages (unless explicitly approved for viewing surface in Wave 5).
- Synthetic test data only.
- TypeScript strict mode; ESM `.js` import specifiers.
- Content-free error messages (no prompt content, no secret substrings).

---

## Wave 0 — Spec and Scope Lock

### Task 0.1 — Create 05-dashboard-v1 tasks document

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: requirements + design complete
- **Files likely touched**: `.kiro/specs/05-dashboard-v1/tasks.md`
- **Goal**: Create a reviewable wave-based task plan from requirements/design.
- **Acceptance**: tasks split into data contracts, repository access, service implementation, tests, viewing surface, and closeout waves; no implementation started.

### Task 0.2 — Confirm dashboard scope

- **Status**: Completed (2026-07-03).
- **Role**: documentation
- **Depends on**: Task 0.1
- **Goal**: Capture what this spec will and will not implement.
- **Acceptance**: dashboard data service layer only for Waves 1–4; viewing surface deferred to Wave 5 design decision; end-to-end scoring, model recommendation, rewrite system, exports, and cloud remain deferred.

---

## Wave 1 — Dashboard Data Contracts

### Task 1.1 — Define dashboard DTO types

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/dashboard/types.ts`
- **Goal**: Create the typed data contracts for all dashboard views.
- **Acceptance**: exports `DashboardOverview`, `DashboardScoreListItem`, `DashboardScoreDetail`, `IssueLabelCount`, `ConfidenceCount`, `ScoreDimensionSummary`; imports scoring types; no `prompt_text` in overview/list/aggregate DTOs; TypeScript strict; typecheck passes.

### Task 1.2 — Define DashboardFilterOptions

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/dashboard/types.ts`
- **Goal**: Create the filter options type for list and aggregate queries.
- **Acceptance**: exports `DashboardFilterOptions` with importBatchId, scoringVersion, confidence, issueLabel, overallScoreMin/Max, includeDeletedPromptLogs, limit, offset; uses scoring types for value constraints; typecheck passes.

### Task 1.3 — Define DashboardDataService interface

- **Status**: Completed (2026-07-03).
- **Role**: implementation
- **Depends on**: Tasks 1.1, 1.2
- **Files likely touched**: `src/dashboard/types.ts` or `src/dashboard/dashboard-data-service.ts`
- **Goal**: Define the service class shell with method signatures.
- **Acceptance**: class `DashboardDataService` with constructor accepting `PromptScoreRepository` and `PromptLogRepository`; method signatures for getOverview, listScores, getScoreDetail, getIssueLabelCounts, getConfidenceCounts, getDimensionSummary; stub implementations (throw or return empty); typecheck passes.

---

## Wave 2 — Repository/Service Access

### Task 2.1 — Expose PromptScoreRepository through composition

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 1
- **Files likely touched**: `src/dashboard/create-dashboard-service.ts`, `src/dashboard/index.ts`
- **Goal**: Provide a composition function that creates DashboardDataService from a SqliteDatabase.
- **Acceptance**: `createDashboardDataService(db: SqliteDatabase): DashboardDataService` instantiates `PromptScoreRepository` and `PromptLogRepository`, returns wired service; does not modify existing factory/adapter; typecheck passes.

### Task 2.2 — Add safe prompt metadata read method

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 2.1
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Create a private helper that reads prompt log metadata without exposing prompt_text in list context.
- **Acceptance**: private method reads `PromptLogRepository.getById` and extracts only metadata fields (id, timestamp, source, provider, model_used, tokens, cost, latency, tags); returns null if prompt log not found; prompt_text is NOT included in the metadata-only return type; used by `listScores` only.

### Task 2.3 — Verify existing query methods suffice for dashboard needs

- **Status**: Completed (2026-07-04).
- **Role**: review
- **Depends on**: Task 2.1
- **Files likely touched**: none (review only)
- **Goal**: Confirm that existing `PromptScoreRepository` list/count methods cover all dashboard filter and aggregate needs without modification.
- **Acceptance**: documented confirmation that list, countByIssueLabel, countByConfidence, getById cover requirements; any gaps identified and documented for future work; no source changes needed.

---

## Wave 3 — Dashboard Data Service Implementation

### Task 3.1 — Implement getOverview

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Compute dashboard overview card data.
- **Acceptance**: returns `DashboardOverview` with total_scored, average_overall_score (one decimal), low_confidence_count, needs_action_count, most_common_label; delegates to countByConfidence + countByIssueLabel + list; handles empty DB (zeros/null); no prompt_text accessed; typecheck passes.

### Task 3.2 — Implement listScores

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Return paginated, filtered score list items with prompt metadata.
- **Acceptance**: returns `DashboardScoreListItem[]`; delegates to scoreRepo.list + logRepo.getById for metadata; supports all DashboardFilterOptions; no prompt_text in returned items; handles missing prompt log (fallback empty metadata); typecheck passes.

### Task 3.3 — Implement getScoreDetail

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Return full score detail with prompt text for local display.
- **Acceptance**: returns `DashboardScoreDetail | null`; loads score via getById; loads prompt log via getById (includes prompt_text for local display); returns null if score not found; handles missing prompt log gracefully (null metadata/text); typecheck passes.

### Task 3.4 — Implement getIssueLabelCounts

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Return issue label counts.
- **Acceptance**: delegates to `scoreRepo.countByIssueLabel(filters)`; returns typed `IssueLabelCount[]`; no prompt_text; typecheck passes.

### Task 3.5 — Implement getConfidenceCounts

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Return confidence level counts.
- **Acceptance**: delegates to `scoreRepo.countByConfidence(filters)`; returns typed `ConfidenceCount[]`; no prompt_text; typecheck passes.

### Task 3.6 — Implement getDimensionSummary

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 2
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Compute per-dimension average scores and low counts.
- **Acceptance**: fetches scores via list (with limit); computes average_score (one decimal rounding) and low_count (score 0–2) for each of 8 dimensions; returns `ScoreDimensionSummary[]`; handles empty results (all zeros); no prompt_text; typecheck passes.

### Task 3.7 — Implement empty/error state handling

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Tasks 3.1–3.6
- **Files likely touched**: `src/dashboard/dashboard-data-service.ts`
- **Goal**: Ensure all methods handle empty databases and error conditions gracefully.
- **Acceptance**: no throws on empty DB; content-free error messages on corruption; all methods return typed defaults (empty arrays, zero counts, null); typecheck passes.

---

## Wave 4 — Tests and Privacy Verification

### Task 4.1 — Add dashboard test helpers

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Wave 3
- **Files likely touched**: `tests/dashboard/dashboard-test-helpers.ts`
- **Goal**: Synthetic fixtures and helper functions for dashboard tests.
- **Acceptance**: reuses existing prompt-score-test-helpers where possible; adds dashboard-specific setup (DB with scores + prompt logs); synthetic only; no real prompts/secrets.

### Task 4.2 — Test getOverview

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-data-service.test.ts`
- **Goal**: Verify overview computation.
- **Acceptance**: tests total_scored accuracy, average_overall_score rounding, low_confidence_count, needs_action_count, most_common_label, empty DB case, filtered overview.

### Task 4.3 — Test listScores with filters

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-data-service.test.ts`
- **Goal**: Verify list behavior with various filter combinations.
- **Acceptance**: tests pagination, each filter individually, combined filters, newest-first order, missing prompt log fallback, no prompt_text in items.

### Task 4.4 — Test getScoreDetail

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-data-service.test.ts`
- **Goal**: Verify detail view assembly.
- **Acceptance**: tests full assembly, prompt_text presence, missing score returns null, missing prompt log graceful handling.

### Task 4.5 — Test aggregate methods

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-data-service.test.ts`
- **Goal**: Verify issue label counts, confidence counts, and dimension summary.
- **Acceptance**: tests correct counts, filter support, dimension average rounding, low_count accuracy, empty results.

### Task 4.6 — Test empty states

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-data-service.test.ts`
- **Goal**: Verify graceful behavior with no data.
- **Acceptance**: tests all methods with empty DB; tests with prompt logs but no scores; no throws; correct typed defaults returned.

### Task 4.7 — Test privacy guardrails (no prompt_text in aggregates/list)

- **Status**: Completed (2026-07-04).
- **Role**: privacy-review
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-privacy.test.ts`
- **Goal**: Prove dashboard data service never leaks prompt_text except in detail view.
- **Acceptance**: getOverview results have no prompt_text; listScores items have no prompt_text; aggregate results have no prompt_text; getDimensionSummary has no prompt_text; getScoreDetail does include prompt_text (intentional for local display); no banned fields in any DTO.

### Task 4.8 — Test no-network

- **Status**: Completed (2026-07-04).
- **Role**: privacy-review
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/dashboard/dashboard-privacy.test.ts`
- **Goal**: Prove no network calls during any dashboard operation.
- **Acceptance**: `globalThis.fetch` is never called during getOverview, listScores, getScoreDetail, getIssueLabelCounts, getConfidenceCounts, getDimensionSummary.

### Task 4.9 — Baseline regression

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Tasks 4.2–4.8
- **Files likely touched**: none (verification only)
- **Goal**: Ensure all prior tests still pass.
- **Acceptance**: `npm test` passes all existing 268 tests plus new dashboard tests; `npm run typecheck` passes; `git diff --check` passes.

---

## Wave 5A — Minimal Viewing Surface Decision

### Task 5.1 — Choose viewing approach

- **Status**: Completed (2026-07-04).
- **Role**: design-decision
- **Depends on**: Wave 4
- **Files likely touched**: `.kiro/specs/05-dashboard-v1/design.md`
- **Goal**: Decide between CLI report, local web UI, or static HTML as the minimal viewing surface.
- **Acceptance**: documented decision with rationale in design.md section 14; CLI report selected; considers no-new-packages constraint.

---

## Wave 5B — Minimal Viewing Surface Implementation

### Task 5.2 — Implement CLI report

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 5.1
- **Files likely touched**: `src/dashboard/cli-report.ts`, `src/dashboard/index.ts`, `package.json` (script only)
- **Goal**: Create a CLI report that displays dashboard data locally.
- **Acceptance**: uses DashboardDataService; shows overview, label/confidence/dimension summaries, score list; supports `--detail <scoreId>` for full detail with prompt text; no prompt_text in aggregate/list output; no new packages; typecheck passes.

---

## Wave 5C — Viewing Surface Tests

### Task 5.3 — Integration test viewing surface

- **Status**: Completed (2026-07-04).
- **Role**: test
- **Depends on**: Task 5.2
- **Files likely touched**: `tests/dashboard/cli-report.test.ts`
- **Goal**: Verify the CLI report integrates with the data service correctly.
- **Acceptance**: tests format functions produce expected output; no prompt_text in aggregate/list output; detail output includes prompt_text; no fetch calls; typecheck passes.

---

## Wave 6 — Docs and Closeout

### Task 6.1 — Add dashboard documentation

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Waves 3–5
- **Files likely touched**: `docs/dashboard.md`
- **Goal**: Document the dashboard data service API, DTO shapes, privacy guarantees, and usage.
- **Acceptance**: concise; no real prompt data; no real secrets; covers service API, composition, privacy design, and limitations.

### Task 6.2 — Mark 05-dashboard-v1 complete

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Waves 1–5
- **Files likely touched**: `.kiro/specs/05-dashboard-v1/tasks.md`
- **Goal**: Mark all tasks complete after implementation, tests, and docs pass.
- **Acceptance**: only mark complete after verification passes; deferred items remain deferred.

### Task 6.3 — Update HANDOFF and CHANGELOG

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Task 6.2
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`
- **Goal**: Mark spec complete and record final verification.
- **Acceptance**: accurate status; no model recommendation/rewrite/export work marked done.

### Task 6.4 — Backup branch

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Task 6.3
- **Files likely touched**: none (git operation only)
- **Goal**: Create `backup/after-05-dashboard-v1-complete` after full closeout.
- **Acceptance**: branch points at final closeout commit; pushed to origin; no force push.

---

## Deferred / Out of Scope

- Cloud dashboard, auth/login, billing.
- Team analytics, sharing, export flows.
- Browser extension, VS Code/Kiro extension, API wrapper.
- LLM judge, rewrite generation, template system.
- Model recommendation engine, gamification.
- Advanced charts requiring new visualization packages.
- Full-text search.
- Editing/deleting prompt logs via dashboard.
- New package dependencies (except Wave 5 if explicitly approved).
- End-to-end scoring orchestration.
- Real-time data streaming.
- Cursor-based pagination.
- Sorting options beyond newest-first.
- `scoring_runs` table.
- Factory/adapter unification (composition function is sufficient).

---

## Recommended Implementation Order

1. Wave 1: Tasks 1.1–1.3 (data contracts and service interface).
2. Wave 2: Tasks 2.1–2.3 (composition and access verification).
3. Wave 3: Tasks 3.1–3.7 (service implementation).
4. Wave 4: Tasks 4.1–4.9 (tests + privacy verification).
5. Wave 5: Tasks 5.1–5.3 (viewing surface — after user design decision).
6. Wave 6: Tasks 6.1–6.4 (docs + closeout + backup).

## Parallelization Guidance

- Do not parallelize early implementation unless the user approves.
- Safe future parallel candidates:
  - Wave 1 tasks 1.1 and 1.2 (DTO types and filter options are independent).
  - Wave 3 tasks 3.4 and 3.5 (getIssueLabelCounts and getConfidenceCounts are independent delegations).
  - Wave 4 test files (dashboard-data-service.test.ts and dashboard-privacy.test.ts can be written in parallel once all service methods are stable).
- Do not parallelize: composition function and service implementation (Wave 2 must complete before Wave 3); privacy tests and implementation (tests verify implementation correctness).
