# Dashboard V1

## Purpose

Dashboard V1 provides a local-first dashboard data service and a minimal CLI viewing surface for scored prompt logs. It answers a focused set of questions from locally stored scores: what scored prompts exist, overall prompt quality, which prompts need action, common issue labels, confidence distribution, dimension-level weaknesses, and prompt detail for local review.

Product framing: roast the prompt, coach the user, improve the habit.

## What Dashboard V1 Includes

- `DashboardDataService` — typed, privacy-safe views over scored prompt logs.
- `createDashboardDataService(db)` — composition function that wires repositories from a SQLite database.
- DTO contracts for all dashboard views.
- Overview metrics (total scored, average overall score, low-confidence count, needs-action count, most common label).
- Scored prompt list with filters and pagination.
- Issue label counts.
- Confidence counts.
- Dimension summary (per-dimension averages and low counts).
- Score detail (including prompt text for local review).
- CLI report and CLI detail mode.
- Tests and privacy verification.

## Architecture

Files:

- `src/dashboard/types.ts` — DTO contracts and filter options for all dashboard views.
- `src/dashboard/dashboard-data-service.ts` — `DashboardDataService`, the core view layer.
- `src/dashboard/create-dashboard-service.ts` — composition function that wires repositories from a SQLite DB.
- `src/dashboard/cli-report.ts` — plain-text CLI report and detail rendering, argument parsing, and a runner.
- `src/dashboard/index.ts` — module boundary and public exports.
- `tests/dashboard/dashboard-data-service.test.ts` — service behavior tests.
- `tests/dashboard/dashboard-privacy.test.ts` — privacy and no-network verification.
- `tests/dashboard/cli-report.test.ts` — CLI report integration tests.

Design:

- The data service wraps `PromptScoreRepository` and `PromptLogRepository`.
- Dependencies are provided by constructor injection.
- `createDashboardDataService(db)` is the composition function that instantiates both repositories from a SQLite database and returns a wired service.
- The CLI report calls the service; it does not query storage directly.
- No UI framework is used.
- No new packages are added.
- The caller owns the database lifecycle (open and close).

## Data Service API

- `getOverview(filters?)` — returns overview metrics: total scored, average overall score (one decimal), low-confidence count, needs-action count (overall score ≤ 2), and most common issue label. Optional batch/version filters.
- `listScores(options)` — returns a paginated, filtered list of scored prompts with prompt metadata. No prompt text.
- `getScoreDetail(scoreId)` — returns full detail for one score, including prompt metadata and prompt text for local review. Returns null if the score is not found.
- `getIssueLabelCounts(filters?)` — returns issue label counts. Optional batch/version filters.
- `getConfidenceCounts(filters?)` — returns confidence-level counts. Optional batch/version filters.
- `getDimensionSummary(filters?)` — returns per-dimension average score (one decimal) and low count (scores 0–2) for the 8 score dimensions. Optional batch/version filters.

## DTOs

- `DashboardOverview`
- `DashboardScoreListItem`
- `DashboardScoreDetail`
- `DashboardPromptMetadata`
- `DashboardFilterOptions`
- `IssueLabelCount`
- `ConfidenceCount`
- `ScoreDimensionSummary`

Privacy note: the list, overview, and aggregate DTOs do not include `prompt_text`. Only `DashboardScoreDetail` includes `prompt_text`, for local detail display.

## CLI Report

Exported functions:

- `renderDashboardReport(service, options?)` — renders the full report (overview, issue labels, confidence, dimensions, scored prompt list) as plain text. No prompt text.
- `renderDashboardDetail(service, scoreId)` — renders full detail for one score, including prompt text.
- `parseDashboardCliArgs(argv)` — parses CLI arguments into a database path and report options.
- `renderDashboardCliHelp()` — returns help text.
- `runDashboardCliReport(argv?)` — opens the DB, creates the service, prints the report or detail, and closes the DB. Returns 0 on success, 1 on error.

Supported args:

```
<dbPath> --limit <number> --offset <number> --batch <importBatchId> --version <scoringVersion> --detail <scoreId> --help
```

The module exposes `runDashboardCliReport()` for a future CLI runner or compiled entrypoint. There is no npm script and no bundled runtime command in V1.

## Privacy Guarantees

- Local SQLite only. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge.
- No full answer fields.
- No `prompt_text` in overview, list, or aggregate DTOs.
- No `prompt_text` in normal report output.
- Prompt text appears only in the explicit detail view/report.
- No raw prompt log dumps.
- No debug dump mode.
- No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).
- Tests use synthetic data only.

## What Dashboard V1 Does Not Do

- No web UI.
- No static HTML.
- No chart packages.
- No export workflow.
- No auth, cloud, or team analytics.
- No model recommendation.
- No rewrite/template system.
- No end-to-end scoring orchestration.
- No full-text search.
- No editing or deleting prompt logs via the dashboard.
- No real-time updates.

## Usage Notes

The data service and CLI report are library functions. Wire them from a SQLite connection and own the database lifecycle:

```typescript
import { openSqliteConnection } from '../src/storage/sqlite/index.js';
import { createDashboardDataService, renderDashboardReport } from '../src/dashboard/index.js';

const db = openSqliteConnection({ databasePath: './local.db' });
try {
  const service = createDashboardDataService(db);
  const report = renderDashboardReport(service, { limit: 20 });
  console.log(report);
} finally {
  db.close();
}
```

## Testing Baseline

Before Wave 6: 25 test files, 367 tests passing. After Wave 6: remains 25 test files, 367 tests passing (docs-only change).

## Future Work

The pass after closeout is not another dashboard implementation wave. Next product specs may be safety/redaction, model recommendation, rewrite/template, or exports. A richer viewing upgrade can happen later. The CLI report is intentionally minimal.
