# 14-local-dashboard-ui Design

## Design Summary

14-local-dashboard-ui adds the first real local browser dashboard to cookedPrompts. It does not replace the coaching report, export bundle, or existing dashboard CLI layer. Instead, it adds a read-only visual surface on top of the already-complete local dashboard data service.

The design goal is simple:

- keep the data boundary conservative,
- keep privacy rules obvious,
- keep the implementation small enough to review,
- and avoid introducing a frontend framework unless a later runtime pass proves it is necessary.

## Delivery Surface

The first UI implementation should use a local browser dashboard served from the user's machine only.

Recommended V1 shape:

- a loopback-only local HTTP surface,
- server-rendered or template-rendered HTML,
- minimal CSS/JS for layout and navigation,
- no external assets, CDNs, analytics, or remote APIs.

Why this direction:

- it matches the repo's current Node/TypeScript shape,
- it avoids inventing a packaging stack too early,
- it keeps privacy boundaries easier to audit,
- and it builds directly on the existing dashboard service.

## Relationship to Existing Dashboard Work

05-dashboard-v1 is complete, but it intentionally stopped at:

- typed dashboard DTOs,
- a local dashboard data service,
- repository composition,
- and a minimal CLI report/detail surface.

14-local-dashboard-ui is the visual layer that was deferred there. It should reuse that existing service boundary rather than bypassing it with direct repository calls from the UI layer.

## Architecture Direction

Recommended module split for later runtime work:

- `src/dashboard-ui/` for the local UI runtime and view rendering.
- `src/dashboard/` remains the data-service boundary.
- UI routes/pages consume dashboard DTOs and detail data through a small app-layer adapter.

Recommended responsibilities:

### `src/dashboard/`

- Existing typed data access.
- Existing privacy-safe aggregate/list/detail contracts.
- No HTML rendering concerns.

### `src/dashboard-ui/`

- Local app shell.
- Route handling.
- HTML page rendering.
- Small view-model formatting helpers.
- Content-free UI error states.

### Local runner entry

- A future local dashboard runner or launcher may live beside existing CLI code.
- It should open or print a local URL only.
- It should not change importer/scoring/report/export behavior.

## Page Set

### 1. Overview page

Purpose:

- Give the user a fast read on prompt health.
- Provide entry points into weaker prompts.

Required content:

- overview summary cards,
- dimension summary,
- issue-label summary,
- confidence summary,
- a recent or weak prompt list preview.

### 2. Prompt list page

Purpose:

- Browse prompts without reading a full report.
- Filter and page through scored prompt history.

Required content:

- table or list of scored prompts,
- score,
- confidence,
- issue labels,
- timestamp/model metadata,
- safe filters and paging controls.

Privacy rule:

- no prompt text in the list view.

### 3. Prompt detail page

Purpose:

- Let the user inspect one prompt deeply in a local-only surface.

Required content:

- all current score dimensions,
- issue labels,
- explanations,
- prompt metadata,
- original prompt text,
- clear "local-only" framing in the page copy or layout.

Privacy rule:

- prompt text is detail-only.
- no assistant answer or completion content.
- no raw safety warning text.

## Data Boundary Decisions

The UI should rely on the existing dashboard service for:

- overview,
- prompt lists,
- issue counts,
- confidence counts,
- dimension summary,
- prompt detail.

This keeps the first dashboard UI limited to data the project already persists and understands well.

The first UI implementation should not try to add live recomputation of:

- rewrite generation,
- model recommendation,
- safety rescans,
- or report/export bundle generation

unless a later dedicated pass explicitly expands the scope.

That means the first dashboard UI is a strong exploration surface, not a second orchestration pipeline.

## Prompt Text Privacy Model

The spec deliberately keeps a split boundary:

- overview/list/aggregate pages: no prompt text,
- prompt detail page: original prompt text allowed for local review.

Reason:

- this matches the current dashboard service contract,
- it respects local-first use,
- and it keeps the first UI useful without inventing a second redaction policy before it is needed.

If a later pass adds in-UI sharing, exports, screenshots, or copy helpers, those flows must use the stricter redaction-safe rules already established elsewhere in the product.

## Error Handling

User-facing errors must be content-free.

The local UI may distinguish:

- no data,
- missing item,
- invalid path/database,
- generic local failure.

But it must not surface:

- raw exception text,
- stack traces,
- prompt contents in error messages,
- raw matched secrets,
- raw safety warning text.

## UI Constraints

- Read-only in V1.
- No login/auth state.
- No remote fetches.
- No telemetry.
- No external assets or analytics.
- No chart package assumption.
- No package additions assumed by the spec foundation.

Simple visual blocks, tables, labels, and local navigation are enough for the first wave.

## Recommended Wave Breakdown

### 14B - App shell and local UI boundary

- Create the local dashboard UI module.
- Add a local runner / route shell.
- Reuse the existing dashboard service through a narrow adapter boundary.
- Add initial route and privacy contract tests.

### 14C - Overview, list, and detail views

- Implement overview page rendering.
- Implement list page rendering with safe filters/paging.
- Implement prompt detail page rendering.
- Add deterministic UI/output tests and privacy checks.

### 14D - Docs, closeout, and final dashboard review

- Update docs and handoff records.
- Review the local dashboard UI for usability and privacy fit.
- Close out the spec and create a backup branch if the runtime work is stable.

## Verification Expectations for Later Runtime Waves

Later runtime waves should still run the standard repo verification set:

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`

In addition, dashboard UI runtime waves should inspect the rendered local dashboard output before and after changes so page structure, privacy boundaries, and route behavior do not drift unintentionally.
