# 05-dashboard-v1 Design

## 1. Overview

The V1 dashboard is implemented as a **dashboard data service layer** — a TypeScript service that wraps existing repositories and exposes clean, privacy-safe DTOs for dashboard views. No UI framework is introduced in the data layer; the viewing surface is chosen and implemented separately in a later wave.

This approach is lowest-risk:

- Testable without a UI framework.
- No new package dependencies for the data layer.
- Clean separation: data service defines what to show, viewing surface decides how to render it.
- Can serve CLI, local web, or static HTML later.

---

## 2. Goals and Non-goals

### Goals

- Provide a typed, testable data service for all dashboard views (overview, list, detail, aggregates).
- Define clean DTO types that enforce privacy (no prompt_text in aggregates/lists).
- Expose PromptScoreRepository through a composable entry point.
- Compute dimension summaries in-memory from list results.
- Handle empty/error states gracefully with content-free errors.
- Support all existing PromptScoreRepository filters.

### Non-goals

- UI framework selection or implementation (deferred to Wave 5 design decision).
- New repository methods or database schema changes.
- End-to-end scoring orchestration.
- New package dependencies.
- Cloud, auth, billing, team features.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│              Dashboard Data Service              │
│  (src/dashboard/dashboard-data-service.ts)      │
├─────────────────────────────────────────────────┤
│  getOverview(filters?)                          │
│  listScores(options)                            │
│  getScoreDetail(scoreId)                        │
│  getIssueLabelCounts(filters?)                  │
│  getConfidenceCounts(filters?)                  │
│  getDimensionSummary(filters?)                  │
└───────────────┬──────────────┬──────────────────┘
                │              │
    ┌───────────▼───┐    ┌────▼──────────────┐
    │PromptScore    │    │PromptLog          │
    │Repository     │    │Repository         │
    │(score data)   │    │(prompt metadata)  │
    └───────────────┘    └───────────────────┘
                │              │
          ┌─────▼──────────────▼─────┐
          │     Local SQLite DB       │
          └───────────────────────────┘
```

Key architecture decisions:

- **Constructor injection**: DashboardDataService receives repositories via constructor.
- **No singleton/global**: consumers create the service with their own repository instances.
- **Same pattern as existing repos**: follows the project's established DI approach.
- **Privacy by design**: DTOs are shaped to exclude prompt_text at the type level.

---

## 4. Data Sources

| Data | Source | Notes |
|------|--------|-------|
| Score records | `PromptScoreRepository.list()` | Never selects prompt_text |
| Score by ID | `PromptScoreRepository.getById()` | Never selects prompt_text |
| Issue label counts | `PromptScoreRepository.countByIssueLabel()` | Pure score metadata |
| Confidence counts | `PromptScoreRepository.countByConfidence()` | Pure score metadata |
| Prompt metadata | `PromptLogRepository.getById()` | Returns prompt_text — used only in detail view |
| Total count | Computed from `PromptScoreRepository.list()` with limit | Or use COUNT query if added later |

---

## 5. View Model / DTO Shapes

```typescript
import type {
  ScoreValue,
  ScoreConfidence,
  ScoringIssueLabel,
  PromptScore,
} from '../scoring/types.js';

/** Overview card data for the dashboard landing. */
export interface DashboardOverview {
  total_scored: number;
  average_overall_score: number; // 0–5, one decimal
  low_confidence_count: number;
  needs_action_count: number; // overall_score <= 2
  most_common_label: ScoringIssueLabel | null;
}

/** One item in the scored prompt list. No prompt_text. */
export interface DashboardScoreListItem {
  score_id: string;
  prompt_log_id: string;
  timestamp: string; // from prompt_log
  source: string;
  provider: string;
  model_used: string;
  overall_score: ScoreValue;
  confidence: ScoreConfidence;
  issue_labels: ScoringIssueLabel[];
  scoring_version: string;
  scored_at: string;
}

/** Full detail for a single scored prompt. */
export interface DashboardScoreDetail {
  score: PromptScore;
  prompt_metadata: {
    id: string;
    timestamp: string;
    source: string;
    provider: string;
    model_used: string;
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    estimated_cost: number | null;
    latency_ms: number | null;
    tags: string[];
  };
  /** Prompt text loaded separately for local display only. Null if prompt log not found. */
  prompt_text: string | null;
}

/** Filter options for list and aggregate queries. */
export interface DashboardFilterOptions {
  importBatchId?: string;
  scoringVersion?: string;
  confidence?: ScoreConfidence;
  issueLabel?: ScoringIssueLabel;
  overallScoreMin?: ScoreValue;
  overallScoreMax?: ScoreValue;
  includeDeletedPromptLogs?: boolean;
  limit: number;
  offset?: number;
}

/** Issue label with its count. */
export interface IssueLabelCount {
  label: ScoringIssueLabel;
  count: number;
}

/** Confidence level with its count. */
export interface ConfidenceCount {
  confidence: ScoreConfidence;
  count: number;
}

/** Per-dimension average summary. */
export interface ScoreDimensionSummary {
  dimension: string;
  average_score: number; // 0–5, one decimal
  low_count: number; // scores 0–2
}
```

---

## 6. Repository and Service Gaps

### Gap 1: PromptScoreRepository not in public factory

**Current state**: `createSqliteStorage` returns `StorageHandoffPort` (importer-focused). `PromptScoreRepository` is standalone — importable but not wired through the factory.

**Resolution for this spec**: Create a dashboard-specific composition function or extend the factory pattern. Recommended approach:

```typescript
// src/dashboard/create-dashboard-service.ts
export function createDashboardDataService(db: SqliteDatabase): DashboardDataService {
  const scoreRepo = new PromptScoreRepository(db);
  const logRepo = new PromptLogRepository(db);
  return new DashboardDataService(scoreRepo, logRepo);
}
```

This keeps the existing factory unchanged (no breaking changes to importer surface) while providing dashboard access.

### Gap 2: No total count method

**Resolution**: Compute total from `countByConfidence` sums (low + medium + high = total). No new repo method needed.

### Gap 3: No average-by-dimension method

**Resolution**: Compute in-memory from `list()` results. For V1 local datasets (typically < 10,000 scores), fetching a page and computing averages is acceptable. If datasets grow, a dedicated SQL aggregate can be added later.

---

## 7. Dashboard Data Service API

```typescript
export class DashboardDataService {
  constructor(
    private readonly scoreRepo: PromptScoreRepository,
    private readonly logRepo: PromptLogRepository,
  ) {}

  /** Get overview card data. Optionally filtered by batch/version. */
  getOverview(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): DashboardOverview;

  /** List scored prompts with filters and pagination. */
  listScores(options: DashboardFilterOptions): DashboardScoreListItem[];

  /** Get full detail for one score (including prompt text for local display). */
  getScoreDetail(scoreId: string): DashboardScoreDetail | null;

  /** Get issue label counts, optionally filtered. */
  getIssueLabelCounts(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): IssueLabelCount[];

  /** Get confidence level counts, optionally filtered. */
  getConfidenceCounts(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
  }): ConfidenceCount[];

  /** Get per-dimension average summary, optionally filtered. */
  getDimensionSummary(filters?: {
    importBatchId?: string;
    scoringVersion?: string;
    limit?: number;
  }): ScoreDimensionSummary[];
}
```

---

## 8. Query Strategy

### getOverview

1. Call `countByConfidence(filters)` → sum all counts for `total_scored`; extract low count for `low_confidence_count`.
2. Call `countByIssueLabel(filters)` → find label with max count for `most_common_label`.
3. Call `list({ ...filters, limit: MAX_LIST_LIMIT })` → compute `average_overall_score` (mean of `overall_score` values) and `needs_action_count` (count where `overall_score <= 2`).
4. If total exceeds MAX_LIST_LIMIT, iterate with offset to cover all scores for accurate averages.

### listScores

1. Call `scoreRepo.list(options)` → get `PromptScore[]`.
2. For each score, call `logRepo.getById(score.prompt_log_id)` → extract metadata fields (no prompt_text in list item).
3. Map to `DashboardScoreListItem[]`.
4. If prompt log not found (deleted/missing), use fallback empty metadata.

### getScoreDetail

1. Call `scoreRepo.getById(scoreId)` → get `PromptScore` or return null.
2. Call `logRepo.getById(score.prompt_log_id)` → extract metadata + prompt_text.
3. Assemble `DashboardScoreDetail` with prompt_text for local display.

### getIssueLabelCounts

1. Delegate directly to `scoreRepo.countByIssueLabel(filters)`.
2. Return typed `IssueLabelCount[]`.

### getConfidenceCounts

1. Delegate directly to `scoreRepo.countByConfidence(filters)`.
2. Return typed `ConfidenceCount[]`.

### getDimensionSummary

1. Call `scoreRepo.list({ ...filters, limit: filters?.limit ?? MAX_LIST_LIMIT })`.
2. Compute per-dimension averages and low counts in-memory.
3. Dimensions: overall, clarity, context, constraints, output_format, capability_fit, efficiency, safety_privacy.
4. Return `ScoreDimensionSummary[]`.

---

## 9. Privacy Design

| Method | prompt_text access | Rationale |
|--------|-------------------|-----------|
| `getOverview` | Never | Aggregates from score metadata only |
| `listScores` | Never | List items contain score + prompt metadata (no text) |
| `getScoreDetail` | Yes (local display) | Loaded via separate `logRepo.getById` call |
| `getIssueLabelCounts` | Never | Pure label counts from score data |
| `getConfidenceCounts` | Never | Pure confidence counts from score data |
| `getDimensionSummary` | Never | Computed from score values only |

Additional privacy guarantees:

- All aggregate methods: never touch prompt_text.
- Error messages: content-free (no prompt content, no secret substrings).
- No fetch/network calls in any dashboard method.
- No banned full-answer fields in any DTO.
- Detail view prompt_text is strictly for local display — never serialized to network, never included in aggregate responses.

---

## 10. Error Handling

- **Score not found**: return `null` from `getScoreDetail`.
- **Prompt log not found for a score**: return the score with null prompt metadata and null prompt_text.
- **Empty database**: return zero counts, empty lists, null most_common_label — never throw.
- **Invalid filter values**: let repository validation handle (content-free errors propagate).
- **Database corruption**: catch SQLite errors, re-throw as content-free dashboard errors.
- **No matched results**: return empty arrays/zero counts — not an error condition.

Error message format: `"Dashboard [method]: [category description]"` — never includes prompt content, score values, or user data.

---

## 11. Testing Strategy

### Unit tests for each service method

- `getOverview`: correct totals, averages, needs-action count, most-common label.
- `listScores`: pagination, filter composition, metadata joining, newest-first order.
- `getScoreDetail`: full assembly, missing prompt log handling, prompt_text presence.
- `getIssueLabelCounts`: delegation and typing.
- `getConfidenceCounts`: delegation and typing.
- `getDimensionSummary`: in-memory computation, low-count accuracy, rounding.

### Privacy tests

- No prompt_text in overview/list/aggregate DTOs.
- No banned full-answer fields in any returned object.
- No fetch calls during any dashboard method.
- Error messages contain no prompt content.

### Empty state tests

- Zero prompt logs → all methods return empty/zero.
- Prompt logs exist but no scores → all methods return empty/zero.
- Filters match nothing → empty results, no errors.

### Filter composition tests

- Each filter works individually.
- Multiple filters compose via AND.
- Edge cases: min = max score, unknown batch ID, etc.

### No-network tests

- `globalThis.fetch` is never called during dashboard operations.

---

## 12. Implementation Waves Preview

| Wave | Focus | Key deliverables |
|------|-------|-----------------|
| 0 | Spec and scope lock | Tasks document, boundaries confirmed |
| 1 | Data contracts | DTO types, filter options, service interface |
| 2 | Repository/service access | Composition function, metadata read helper |
| 3 | Service implementation | All 6 service methods |
| 4 | Tests and privacy | Unit tests, privacy tests, empty states, no-network |
| 5 | Minimal viewing surface | Design decision + minimal CLI/web/static output |
| 6 | Docs and closeout | Documentation, HANDOFF/CHANGELOG, backup |

---

## 13. Deferred Items

- Cloud dashboard, auth/login, billing.
- Team analytics, sharing, export flows.
- Browser extension, VS Code/Kiro extension, API wrapper.
- LLM judge, rewrite generation, template system.
- Model recommendation engine, gamification.
- Advanced charts/visualization packages.
- Full-text search.
- Editing/deleting prompt logs via dashboard.
- Cursor-based pagination (offset-based is sufficient for V1 local datasets).
- Sorting options beyond newest-first.
- `scoring_runs` table or scoring job orchestration.
- Factory/adapter pattern unification (composition function is sufficient for V1).
- Real-time data updates or WebSocket streaming.
- New repository aggregate methods (in-memory computation is fine for V1 scale).


---

## 14. Wave 5 Viewing Surface Decision

**Decision date**: 2026-07-04
**Selected approach**: CLI Report (Option A)

### Options Considered

| Criterion | CLI Report | Static HTML | Local Web UI |
|-----------|-----------|-------------|--------------|
| New packages needed | None | None | Yes (React/Vite/Express) |
| Implementation size | Small | Medium | Large |
| Testability | High (stdout capture) | Medium (file assertions) | Low (browser testing) |
| Privacy risk | Low (terminal only) | Medium (file on disk) | Medium (localhost) |
| Prompt text boundary | Clean (--detail flag) | Harder (in-file toggle) | Complex (route/state) |
| Usefulness for V1 | Good (verify data) | Good (demo artifact) | Best long-term |
| Scope creep risk | Low | Medium (CSS/charts) | High (routing/state) |
| Future upgrade path | Easy (keeps working) | Moderate | N/A (is the upgrade) |

### Decision

CLI report. It requires no new packages, is easy to test, enforces a clean privacy boundary (no prompt_text unless `--detail <scoreId>` is used), and is the smallest implementation that proves the dashboard data service works end-to-end.

### Implementation boundary for Wave 5B

- File: `src/dashboard/cli-report.ts`
- Entry: can be run via `npx tsx src/dashboard/cli-report.ts <dbPath>` or a new npm script
- Uses `createDashboardDataService(db)` to get a wired service
- Output sections:
  - **Overview**: total scored, average overall, low confidence, needs action, most common label
  - **Issue labels**: table of label counts
  - **Confidence**: table of confidence counts
  - **Dimensions**: table of dimension averages and low counts
  - **Score list**: paginated table (first page, configurable limit)
  - **Detail** (optional `--detail <scoreId>`): full dimension breakdown + explanations + prompt text
- No prompt_text in overview/list/aggregate output sections
- Prompt text displayed only in detail mode
- No network calls, no cloud, no telemetry
- No new packages
- Console output only (stdout)
- Content-free errors (no prompt content in error messages)

### Privacy boundary

- Overview/list/aggregate sections: never display prompt_text
- Detail mode (`--detail <scoreId>`): displays prompt_text for the single requested score — local terminal display only
- No banned full-answer fields in any output

### Non-goals for Wave 5B

- Colors, box-drawing, or rich terminal formatting (plain text tables are fine)
- Interactive mode or REPL
- File output or export (this is a viewing tool, not an exporter)
- Watching for changes
- Custom sorting or advanced query syntax

### Test expectations for Wave 5C

- Test that CLI report functions produce expected output structure
- Test that overview/list/aggregate output does not contain prompt_text
- Test that detail output does contain prompt_text
- Test no-network (no fetch during report generation)
- Can test format functions directly without spawning a subprocess
