# Implementation Plan: Detailed Coaching Report

## Overview

This spec should be implemented in waves so the report upgrade stays reviewable.

The recommended order is:

1. 12A - spec/design/tasks only
2. 12B - score/report contract foundation
3. 12C - prompt examples, redaction, better prompts, roast, good prompt, model waste, safety lessons
4. 12D - copy polish, docs, final demo review

## Tasks

- [x] 1. Spec creation
  - [x] 1.1 Create `requirements.md`
  - [x] 1.2 Create `design.md`
  - [x] 1.3 Create `tasks.md`
  - [x] 1.4 Update `HANDOFF.md` and `CHANGELOG.md` if required by workflow

- [x] 2. Wave 12B - score/report contract foundation
  - [x] 2.1 Add 0-100 score conversion helpers and score band labels
  - [x] 2.2 Update report types to carry `overall_score_100` and `category_scores_100`
  - [x] 2.3 Add batch verdict and category scorecard section builders
  - [x] 2.4 Update markdown rendering for scorecard output
  - [x] 2.5 Add score conversion and section-structure tests
  - [x] 2.6 Verify existing privacy behavior remains unchanged

- [ ] 3. Wave 12C - prompt examples and redaction
  - [x] 3.0 12C1 - add report-layer redaction/masking foundation and tests
  - [x] 3.1 Add prompt example card types and deterministic selection rules
  - [x] 3.2 Implement redaction/masking for sensitive spans in examples
  - [x] 3.3 Add better prompt generation using deterministic template rules
  - [x] 3.4 Add Roast of the Batch and One Good Prompt Worth Copying sections
  - [x] 3.5 Add model waste / overkill and safety/privacy coaching sections
  - [x] 3.6 Add privacy regression tests for file/user mode and demo mode
  - [x] 3.7 Verify no banned fields, no full answers, and no raw secrets appear

- [x] 4. Wave 12D - copy and docs polish
  - [x] 4.1 Tighten report copy so it reads like a coach
  - [x] 4.2 Update docs and any workflow notes affected by the new report shape
  - [x] 4.3 Run a final demo review and tune wording if needed
  - [x] 4.4 Close out the spec and update handoff/changelog

## Wave Discipline

- Do not bundle 12B, 12C, and 12D into one implementation pass.
- Stop at each wave boundary for verification and review.
- Keep privacy-sensitive work in its own wave so redaction behavior can be tested independently.

## Verification

### 12A

- `git diff --check`
- `git status --short --branch`

### 12B

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`

### 12C

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`

### 12D

- `npm run typecheck`
- `npm run build:cli`
- `npm test`
- `npm run demo`
- `npm run demo -- --help`
- `npm run demo:save`
- `git diff --check`
- `git status --short --branch`

## Cleanup Rules

- Delete `cooked-report.md` and any `cooked-report-*.md` files after `npm run demo:save`.
- Do not commit generated reports.
- Do not commit `dist/`.
- Report final `git status` before closing each wave.

## Stop Conditions

Stop and revisit the design if:

- prompt redaction cannot be made deterministic
- example cards require raw model answers
- file/user mode privacy behavior becomes ambiguous
- score conversion produces confusing or unstable output
- the report becomes too large to review cleanly

## Notes

- The spec is intentionally split so the first runtime wave only locks report contracts and score structure.
- Example-heavy work is allowed, but it must stay redacted and local.
- 12C1 establishes masking helpers and privacy tests only.
- 12C2 adds prompt example rendering and redacted local examples.
- 12C3 adds better prompt rewrites, Roast of the Batch, and One Good Prompt Worth Copying.
- 12D closes the spec with copy polish, docs cleanup, and final demo review.
- The detailed coaching report spec is complete.
