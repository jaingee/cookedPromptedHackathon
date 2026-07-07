# 13-exports Implementation Plan

## 1. Spec Foundation

- [x] 1.1 Create `requirements.md`
- [x] 1.2 Create `design.md`
- [x] 1.3 Create `tasks.md`
- [x] 1.4 Update `HANDOFF.md` and `CHANGELOG.md` for the new exports spec

## 2. Wave 13B - Export Contracts and Pure Artifact Builders

- [x] 2.1 Define export bundle data contracts and artifact metadata
- [x] 2.2 Add deterministic builders for `coaching-report.md`, `memory.md`, and `workflow.md`
- [x] 2.3 Add privacy-safe redaction and output-shape tests for export content
- [x] 2.4 Verify export builders stay local-only and do not depend on CLI/file I/O

## 3. Wave 13C - CLI and File-Writing Integration

- [x] 3.1 Wire export bundle generation through the existing CLI surface
- [x] 3.2 Add collision-safe directory writing for export bundles
- [x] 3.3 Distinguish report saving from export bundle generation in help text and docs
- [x] 3.4 Add integration tests for export command behavior and generated artifact contents

## 4. Wave 13D - Docs, Closeout, and Final Export Review

- [x] 4.1 Update `HANDOFF.md` with the completed export contract and next step
- [x] 4.2 Update `CHANGELOG.md` with the completed export pass and verification results
- [x] 4.3 Review generated export output for readability, determinism, and privacy safety
- [x] 4.4 Close out the spec and create a backup branch if the implementation is stable

## Wave Discipline

- Keep the existing report-save path distinct from the export bundle contract.
- Do not combine bundle contracts, CLI integration, and docs closeout into one runtime pass.
- Keep privacy-sensitive export logic in its own verified wave.
- 13-exports is complete when 13D closeout and verification are done.

## Verification

### 13A

- `git diff --check`
- `git status --short --branch`

### 13B

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`

### 13C

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `npm run demo -- --export ./tmp-export-bundle`
- `git diff --check`

### 13D

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
- Do not commit future export artifacts generated during verification.
- Do not commit `dist/`.
- Report the final `git status --short --branch` before closing each wave.

## Stop Conditions

- Stop and revisit the spec if the export bundle needs raw prompt answers or raw secrets.
- Stop if the export contract expands into PDF/DOCX, cloud sync, auth, or browser work.
- Stop if the existing report-save behavior and the new export bundle cannot be separated cleanly.
