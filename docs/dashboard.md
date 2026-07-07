# Dashboard V1

## Purpose

Dashboard V1 provides a local-first dashboard data service, a minimal CLI viewing surface, and a loopback-only dashboard UI for scored prompt logs. It answers a focused set of questions from locally stored scores: what scored prompts exist, overall prompt quality, which prompts need action, common issue labels, confidence distribution, dimension-level weaknesses, and prompt detail for local review.

Product framing: roast the prompt, coach the user, improve the habit.

## What Dashboard V1 Includes

- `DashboardDataService` - typed, privacy-safe views over scored prompt logs.
- `createDashboardDataService(db)` - composition function that wires repositories from a SQLite database.
- DTO contracts for all dashboard views.
- Overview metrics (total scored, average overall score, low-confidence count, needs-action count, most common label).
- Scored prompt list with filters and pagination.
- Issue label counts.
- Confidence counts.
- Dimension summary (per-dimension averages and low counts).
- Score detail (including prompt text for local review).
- CLI report and CLI detail mode.
- Loopback-only dashboard UI with overview, prompt list, and prompt detail pages.
- Tests and privacy verification.

## Architecture

Files:

- `src/dashboard/types.ts` - DTO contracts and filter options for all dashboard views.
- `src/dashboard/dashboard-data-service.ts` - `DashboardDataService`, the core view layer.
- `src/dashboard/create-dashboard-service.ts` - composition function that wires repositories from a SQLite DB.
- `src/dashboard/cli-report.ts` - plain-text CLI report and detail rendering, argument parsing, and a runner.
- `src/dashboard/index.ts` - module boundary and public exports.
- `src/dashboard-ui/` - server-rendered loopback dashboard UI runtime.
- `src/cli/dashboard-ui.ts` - CLI launcher for the local dashboard UI.
- `tests/dashboard/dashboard-data-service.test.ts` - service behavior tests.
- `tests/dashboard/dashboard-privacy.test.ts` - privacy and no-network verification.
- `tests/dashboard/cli-report.test.ts` - CLI report integration tests.
- `tests/dashboard-ui/*.test.ts` - route, privacy, and launcher verification for the dashboard UI.

Design:

- The data service wraps `PromptScoreRepository` and `PromptLogRepository`.
- Dependencies are provided by constructor injection.
- `createDashboardDataService(db)` is the composition function that instantiates both repositories from a SQLite database and returns a wired service.
- The CLI report and dashboard UI both call the service; they do not query storage directly.
- No UI framework is used.
- No new packages are added.
- The caller owns the database lifecycle (open and close).

## Data Service API

- `getOverview(filters?)` - returns overview metrics: total scored, average overall score (one decimal), low-confidence count, needs-action count (overall score <= 2), and most common issue label. Optional batch/version filters.
- `listScores(options)` - returns a paginated, filtered list of scored prompts with prompt metadata. No prompt text.
- `getScoreDetail(scoreId)` - returns full detail for one score, including prompt metadata and prompt text for local review. Returns null if the score is not found.
- `getIssueLabelCounts(filters?)` - returns issue label counts. Optional batch/version filters.
- `getConfidenceCounts(filters?)` - returns confidence-level counts. Optional batch/version filters.
- `getDimensionSummary(filters?)` - returns per-dimension average score (one decimal) and low count (scores 0-2) for the 8 score dimensions. Optional batch/version filters.

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

- `renderDashboardReport(service, options?)` - renders the full report (overview, issue labels, confidence, dimensions, scored prompt list) as plain text. No prompt text.
- `renderDashboardDetail(service, scoreId)` - renders full detail for one score, including prompt text.
- `parseDashboardCliArgs(argv)` - parses CLI arguments into a database path and report options.
- `renderDashboardCliHelp()` - returns help text.
- `runDashboardCliReport(argv?)` - opens the DB, creates the service, prints the report or detail, and closes the DB. Returns 0 on success, 1 on error.

Supported args:

```text
<dbPath> --limit <number> --offset <number> --batch <importBatchId> --version <scoringVersion> --detail <scoreId> --help
```

The module exposes `runDashboardCliReport()` for a future CLI runner or compiled entrypoint. The main local browser runtime now lives in `npm run dashboard:ui`.

## Local Dashboard UI

Launch shape:

```bash
npm run dashboard:ui -- <database_path> [--port <n>]
```

UI guarantees:

- Binds to `127.0.0.1` only.
- Uses server-rendered HTML only.
- Shows only the database basename, never the full path.
- Overview and prompt list pages do not show prompt text.
- Prompt text appears only on the local prompt detail page.
- Prompt detail uses the existing local masking approach before display, so raw secrets and similar sensitive spans are not rendered back to the browser.
- No assistant/model answers, telemetry, provider calls, or remote assets.
- The UI is read-only in V1.

## Privacy Guarantees

- Local SQLite only. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge.
- No full answer fields.
- No `prompt_text` in overview, list, or aggregate DTOs.
- No `prompt_text` in normal report output.
- Prompt text appears only in the explicit detail view/report.
- Dashboard detail masks secrets and similar sensitive spans before rendering them in the browser.
- No raw prompt log dumps.
- No debug dump mode.
- No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`, `template_body`).
- Tests use synthetic data only.

## What Dashboard V1 Does Not Do

- No static HTML export flow.
- No chart packages.
- No export workflow redesign.
- No auth, cloud, or team analytics.
- No model recommendation recomputation.
- No rewrite/template recomputation.
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

Dashboard service and dashboard UI coverage now live in the main repo test suite. See `CHANGELOG.md` for the latest verified test count tied to each dashboard wave.

## Future Work

The service and UI are intentionally read-only in V1. Future product work can decide whether the next step should be importer preview, richer local dashboard filtering, or a separate capture-oriented spec.
