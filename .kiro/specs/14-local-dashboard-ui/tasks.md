# 14-local-dashboard-ui Implementation Plan

## 1. Spec Foundation

- [x] 1.1 Create `requirements.md`
- [x] 1.2 Create `design.md`
- [x] 1.3 Create `tasks.md`
- [x] 1.4 Update `HANDOFF.md` and `CHANGELOG.md` for the new dashboard UI spec

## 2. Wave 14B - App Shell and Local UI Boundary

- [x] 2.1 Create the `src/dashboard-ui/` module boundary and route/app-shell structure
- [x] 2.2 Add a local dashboard runner/launcher surface that stays local-only
- [x] 2.3 Reuse `src/dashboard/` service contracts through a narrow UI adapter layer
- [x] 2.4 Add contract tests for route output shape, content-free errors, and no-network behavior

## 3. Wave 14C - Overview and List Views

- [x] 3.1 Render the overview dashboard page from existing aggregate DTOs
- [x] 3.2 Render the scored prompt list with safe filters and pagination
- [x] 3.3 Keep the prompt detail route as a safe 14D placeholder with no prompt text
- [x] 3.4 Add deterministic rendering tests and privacy checks for prompt-text boundaries

## 4. Wave 14D - Prompt Detail, Docs, Closeout, and Final Dashboard Review

- [x] 4.1 Render the prompt detail page with local-only prompt text and score breakdowns
- [x] 4.2 Update `HANDOFF.md`, `CHANGELOG.md`, and any dashboard/runtime docs
- [x] 4.3 Review the local dashboard UI for readability, usefulness, and privacy fit
- [x] 4.4 Verify the dashboard runtime with the standard repo checks plus local UI review
- [x] 4.5 Close out the spec and create a backup branch if the runtime work is stable

## Wave Discipline

- Keep the first local dashboard UI read-only.
- Do not fold report/export redesign into this spec.
- Do not bypass the existing dashboard data service with direct repository access from UI pages unless a later implementation pass proves that the service is missing a required DTO.
- Keep prompt text out of overview/list/aggregate surfaces.
- Allow prompt text only in the local detail view.
- Do not add cloud, auth, telemetry, provider calls, or external assets.
- Do not assume a frontend framework or new package dependency in 14B.

## Verification

### 14A

- `git diff --check`
- `git status --short --branch`

### 14B

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `npm run demo -- --export ./tmp-export-bundle`
- `npm run dashboard:ui -- --help`
- `git diff --check`

### 14C

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`

### 14D

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`
- `git status --short --branch`

## Cleanup Rules

- Do not commit `cooked-report.md` or any `cooked-report-*.md` files.
- Do not commit local dashboard-generated artifacts or screenshots unless a later spec explicitly requires review fixtures.
- Do not commit `dist/`.
- Report the final `git status --short --branch` before closing each wave.

## Stop Conditions

- Stop if the local dashboard UI cannot be built cleanly on top of the existing dashboard service boundary.
- Stop if the UI requires cloud sync, auth, or a package-heavy frontend stack to become minimally useful.
- Stop if prompt-text detail behavior conflicts with established privacy boundaries.
- Stop if the scope starts drifting into report redesign, export redesign, or importer/scoring/storage rewrites.
