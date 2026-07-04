# 03-scoring-engine Tasks

## Purpose

Convert the approved requirements and design into a practical, wave-based implementation plan for the cookedPrompts V1 deterministic scoring engine. Each wave can be implemented in one focused pass, reviewed, and committed before moving to the next.

## Current Status

- Requirements: created and approved.
- Design: created and approved.
- Tasks: this document.
- Implementation: not started.
- Tests: not yet.

---

## Global Guardrails

All waves must respect these rules:

- No network calls.
- No external AI / LLM judge.
- No telemetry.
- No storage writes in this spec (persistence is deferred).
- No SQLite persistence in this spec.
- No full model answer fields read, required, or stored.
- No raw parsed rows.
- No prompt content in logs, errors, or explanations.
- No provider/model name hardcoding in scoring rules.
- No new package installs.
- Synthetic test data only.
- TypeScript strict mode.
- ESM with `.js` import specifiers.
- Scoring may read `PromptLogEntry.prompt_text` in memory.
- Scoring output references `prompt_log_id`, never copies `prompt_text`.
- `scored_at` must come from an injectable `Clock` (default: system time; tests: fixed clock).
- `id` must come from an injectable `idFactory` (default: local UUID-style; tests: deterministic).

---

## Wave 0 — Scoring Module Boundary and Core Types

Create the module skeleton and shared types. No scoring rules yet.

### Task 0.1 — Create scoring module boundary

- **Status**: Completed (2026-07-03) — `src/scoring/index.ts` created.
- **Role**: implementation
- **Depends on**: none
- **Files likely touched**: `src/scoring/index.ts`
- **Goal**: Create the `src/scoring/` folder with a barrel `index.ts`.
- **Acceptance**: barrel file exists; `npm run typecheck` passes; no runtime logic yet.

### Task 0.2 — Define core public types

- **Status**: Completed (2026-07-03) — `src/scoring/types.ts` created.
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/scoring/types.ts`, `src/scoring/index.ts`
- **Goal**: Define and export `ScoreValue`, `ScoreConfidence`, `ScoringIssueLabel`, `CapabilityClass`, `PromptScore`, `ScoringOptions`, `ScoringConfig`, `ScoringEngine`, `DimensionResult`, `PromptSignals`.
- **Acceptance**: types match design; exported from barrel; typecheck passes; no runtime logic; no storage/network types.

### Task 0.3 — Define clock and idFactory options

- **Status**: Completed (2026-07-03) — `src/scoring/clock.ts` created (`node:crypto` randomUUID; no new deps).
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/scoring/clock.ts`, `src/scoring/index.ts`
- **Goal**: Define `Clock` interface with `now(): string` (ISO 8601). Provide a `defaultClock` (uses `new Date().toISOString()`). Provide a default `idFactory` using built-in `crypto.randomUUID()` — no package install needed.
- **Acceptance**: clock and idFactory injectable; default implementations provided; no new deps; typecheck passes.

### Task 0.4 — Define scoring version constant

- **Status**: Completed (2026-07-03) — `src/scoring/scoring-version.ts` created (`SCORING_VERSION = '1.0.0'`).
- **Role**: implementation
- **Depends on**: Task 0.1
- **Files likely touched**: `src/scoring/scoring-version.ts`, `src/scoring/index.ts`
- **Goal**: Define and export `SCORING_VERSION = '1.0.0'` (bumped when rules/weights/labels/output shape change).
- **Acceptance**: constant exported; typecheck passes.

---

## Wave 1 — Rule Constants and Signal Extraction

Define stable labels, capability constants, safety patterns, and the shared signal extraction step.

### Task 1.1 — Define issue label constants and stable ordering

- **Status**: Completed (2026-07-03) — `src/scoring/rules/issue-labels.ts`.
- **Role**: implementation
- **Depends on**: Task 0.2
- **Files likely touched**: `src/scoring/rules/issue-labels.ts`, `src/scoring/index.ts`
- **Goal**: Export the `SCORING_ISSUE_LABELS` array in the stable documented order (matches `ScoringIssueLabel` union). Export a dedupe helper that returns labels in this stable order.
- **Acceptance**: labels match requirements minimum (12); exported; stable ordering; typecheck.

### Task 1.2 — Define capability class constants

- **Status**: Completed (2026-07-03) — `src/scoring/rules/capability-classes.ts`.
- **Role**: implementation
- **Depends on**: Task 0.2
- **Files likely touched**: `src/scoring/rules/capability-classes.ts`, `src/scoring/index.ts`
- **Goal**: Export the `CAPABILITY_CLASSES` array and a minimal heuristic model→capability map for V1. The map classifies `model_used` strings by keyword/heuristic without hardcoding specific provider names.
- **Acceptance**: classes match design (9 constants); map is replaceable; no provider names hardcoded; typecheck.

### Task 1.3 — Define local safety/privacy pattern categories

- **Status**: Completed (2026-07-03) — `src/scoring/rules/safety-patterns.ts` (`matchSafetyPatterns`, category+severity only).
- **Role**: implementation
- **Depends on**: Task 0.2
- **Files likely touched**: `src/scoring/rules/safety-patterns.ts`
- **Goal**: Define regex/heuristic patterns in severity categories (high: secret/key/token/private-key patterns; medium: email/PII/company/confidential hints; prompt-injection phrases). Export a function `matchSafetyPatterns(text: string)` returning matches with severity and category label.
- **Acceptance**: patterns are local only; no real secrets in source; matched values never logged/returned — only category labels and severity; typecheck.

### Task 1.4 — Implement extractSignals(entry)

- **Status**: Completed (2026-07-03) — `src/scoring/signals.ts` (pure; not exported from barrel).
- **Role**: implementation
- **Depends on**: Tasks 1.1, 1.2, 1.3
- **Files likely touched**: `src/scoring/signals.ts`, `src/scoring/index.ts`
- **Goal**: Compute `PromptSignals` from a `PromptLogEntry` once. Derives: `length`, `lowered` (in-memory only), `hasFormatMarker`, `hasConstraintMarker`, `hasContextMarker`, `vagueTaskOnly`, `requiredCapabilities`, `hasModelMetadata`, `hasUsageMetadata`.
- **Acceptance**: pure function; no I/O; no logging of prompt_text; signals reusable by all dimension scorers; typecheck.

### Task 1.5 — Ensure signal extraction keeps prompt text in memory only

- **Status**: Completed (2026-07-03) — privacy review passed.
- **Role**: privacy-review
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/signals.ts` (review)
- **Goal**: Verify by code review that `extractSignals` never persists, logs, or exposes prompt content beyond the internal `lowered` field.
- **Acceptance**: `extractSignals` is exported only from `signals.ts` (not the public barrel); no `console.*`/errors include prompt text; `lowered` documented as internal-only; `matchSafetyPatterns` returns only category/severity (never matched substrings); no storage/network/LLM; no provider names or real secrets in source.

---

## Wave 2 — Dimension Scorers

Implement each pure per-dimension scorer. Each returns a `DimensionResult` (score + labels + explanations).

### Task 2.1 — Implement clarity scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/clarity.ts` (`scoreClarity`).
- **Role**: implementation
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/dimensions/clarity.ts`
- **Goal**: Detect vague-task-only prompts ("help", "fix this", "make it better" with no object). Score 0–5.
- **Acceptance**: pure; labels: `unclear_task`; explanation does not quote prompt; typecheck.

### Task 2.2 — Implement context scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/context.ts` (`scoreContext`).
- **Role**: implementation
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/dimensions/context.ts`
- **Goal**: Detect missing background/domain/input information. Score 0–5.
- **Acceptance**: pure; labels: `missing_context`; typecheck.

### Task 2.3 — Implement constraints scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/constraints.ts` (`scoreConstraints`).
- **Role**: implementation
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/dimensions/constraints.ts`
- **Goal**: Detect missing boundaries (length/tone/audience/scope) and overbroad multi-topic asks. Score 0–5.
- **Acceptance**: pure; labels: `missing_constraints`, `overbroad_prompt`; typecheck.

### Task 2.4 — Implement output-format scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/output-format.ts` (`scoreOutputFormat`).
- **Role**: implementation
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/dimensions/output-format.ts`
- **Goal**: Detect missing expected output format markers (table/JSON/list/code/markdown/email). Score 0–5.
- **Acceptance**: pure; labels: `missing_output_format`; typecheck.

### Task 2.5 — Implement capability-fit scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/capability-fit.ts` (`scoreCapabilityFit`).
- **Role**: implementation
- **Depends on**: Tasks 1.2, 1.4
- **Files likely touched**: `src/scoring/dimensions/capability-fit.ts`
- **Goal**: Compare inferred `requiredCapabilities` vs model metadata interpreted through capability map. Mismatch lowers score; missing metadata pushes toward neutral (3).
- **Acceptance**: pure; labels: `wrong_model_class`, `overpowered_model`, `needs_search`, `needs_tool_use`; no provider names hardcoded; typecheck.

### Task 2.6 — Implement efficiency scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/efficiency.ts` (`scoreEfficiency`).
- **Role**: implementation
- **Depends on**: Task 1.4
- **Files likely touched**: `src/scoring/dimensions/efficiency.ts`
- **Goal**: Flag excessive length/repetition for simple tasks. Use `prompt_text.length` as rough proxy; token metadata refines when available. Score 0–5.
- **Acceptance**: pure; labels: `too_long_for_task`; no tokenizer dependency; typecheck.

### Task 2.7 — Implement safety/privacy scorer

- **Status**: Completed (2026-07-03) — `src/scoring/dimensions/safety-privacy.ts` (`scoreSafetyPrivacy`).
- **Role**: implementation
- **Depends on**: Tasks 1.3, 1.4
- **Files likely touched**: `src/scoring/dimensions/safety-privacy.ts`
- **Goal**: Run local safety pattern matches. High-severity match → score 0–1; medium → moderate reduction. Consider `redaction_status`.
- **Acceptance**: pure; labels: `possible_secret`, `privacy_risk`; never returns matched substrings or values; typecheck.

### Task 2.8 — Normalize dimension result behavior

- **Status**: Completed (2026-07-03) — all 7 scorers return consistent `DimensionResult`; typed labels; safe explanations; no throws on missing metadata.
- **Role**: implementation
- **Depends on**: Tasks 2.1–2.7
- **Files likely touched**: `src/scoring/dimensions/` (all)
- **Goal**: Confirm all 7 scorers return consistent `DimensionResult` shape; labels are from the typed union; explanations are short and safe; no scorer throws on missing optional fields.
- **Acceptance**: consistent return shape; typecheck; review pass.

---

## Wave 3 — Orchestrator, Overall Score, Confidence, and Public API

Wire scorers into the pipeline and expose the public API.

### Task 3.1 — Implement scorePrompt pipeline

- **Status**: Completed (2026-07-03) — `src/scoring/score-prompt.ts` (`scorePrompt`).
- **Role**: implementation
- **Depends on**: Tasks 2.1–2.8, 0.3, 0.4
- **Files likely touched**: `src/scoring/score-prompt.ts`
- **Goal**: Orchestrate: `extractSignals` → run 7 dimension scorers → compute overall → aggregate labels/explanations → derive confidence → stamp scoring_version + scored_at → return `PromptScore`.
- **Acceptance**: pure except injectable clock/id; no I/O; typecheck; handles missing metadata gracefully.

### Task 3.2 — Implement scorePrompts batch helper

- **Status**: Completed (2026-07-03) — `scorePrompts` (order-preserving; `[]` for empty).
- **Role**: implementation
- **Depends on**: Task 3.1
- **Files likely touched**: `src/scoring/score-prompt.ts` or `src/scoring/index.ts`
- **Goal**: Map `scorePrompt` over an array. Return `[]` for empty input. Preserve input order.
- **Acceptance**: `scorePrompts([])` returns `[]`; order preserved; typecheck.

### Task 3.3 — Implement overall score weighted average

- **Status**: Completed (2026-07-03) — weighted average with `toScoreValue` clamp.
- **Role**: implementation
- **Depends on**: Task 3.1
- **Files likely touched**: `src/scoring/score-prompt.ts`
- **Goal**: Compute rounded weighted average of 7 dimension scores using design-specified starting weights: clarity 0.20, context 0.20, constraints 0.15, output_format 0.15, capability_fit 0.10, efficiency 0.10, safety_privacy 0.10.
- **Acceptance**: deterministic; result is `ScoreValue`; weights sum to 1.0; typecheck.

### Task 3.4 — Implement safety gate

- **Status**: Completed (2026-07-03) — `safety_privacy_score <= 1` caps overall at 1.
- **Role**: implementation
- **Depends on**: Task 3.3
- **Files likely touched**: `src/scoring/score-prompt.ts`
- **Goal**: If `safety_privacy_score <= 1`, cap `overall_score` at `1`.
- **Acceptance**: deterministic; overall never exceeds 1 when safety is critical; typecheck.

### Task 3.5 — Implement confidence derivation

- **Status**: Completed (2026-07-03) — `deriveConfidence` (high/medium/low by metadata).
- **Role**: implementation
- **Depends on**: Task 3.1
- **Files likely touched**: `src/scoring/score-prompt.ts`
- **Goal**: Derive `confidence` from metadata: high (model + usage present), medium (partial), low (neither).
- **Acceptance**: deterministic; uses `hasModelMetadata`/`hasUsageMetadata` signals; typecheck.

### Task 3.6 — Implement explanation aggregation/capping

- **Status**: Completed (2026-07-03) — `src/scoring/explanations/explanation-builder.ts` (dedupe, cap 6 × 120 chars).
- **Role**: implementation
- **Depends on**: Tasks 3.1, 2.1–2.7
- **Files likely touched**: `src/scoring/explanations/explanation-builder.ts`
- **Goal**: Flatten dimension explanations, dedupe, cap at ~6 entries max ~120 chars each, ensure none quotes prompt_text.
- **Acceptance**: no prompt text in output; deduped; deterministic order; typecheck.

### Task 3.7 — Implement optional createScoringEngine wrapper

- **Status**: Completed (2026-07-03) — `src/scoring/scoring-engine.ts` (`createScoringEngine`).
- **Role**: implementation
- **Depends on**: Tasks 3.1, 3.2
- **Files likely touched**: `src/scoring/scoring-engine.ts`, `src/scoring/index.ts`
- **Goal**: Thin wrapper: `createScoringEngine(config?) → { score, scoreMany }`.
- **Acceptance**: delegates to `scorePrompt`/`scorePrompts`; no storage/network; typecheck.

### Task 3.8 — Finalize public barrel exports

- **Status**: Completed (2026-07-03) — barrel exports `scorePrompt`, `scorePrompts`, `createScoringEngine`; internals stay private.
- **Role**: implementation
- **Depends on**: Tasks 3.1–3.7
- **Files likely touched**: `src/scoring/index.ts`
- **Goal**: Export `scorePrompt`, `scorePrompts`, `createScoringEngine`, core types, `SCORING_VERSION`, capability classes, issue labels. Do not export internal signals or `lowered` text.
- **Acceptance**: public surface is clean; no internal/private exports; typecheck; no storage/network types.

---

## Wave 4 — Tests and Privacy Verification

Add synthetic tests proving scoring behavior. All data synthetic; no real prompts, secrets, or model answers.

### Task 4.1 — Add scoring test helpers

- **Status**: Completed (2026-07-03) — `tests/scoring/test-helpers.ts`.
- **Role**: test
- **Depends on**: Task 3.8
- **Files likely touched**: `tests/scoring/test-helpers.ts`
- **Goal**: Shared synthetic `PromptLogEntry` fixtures, a fixed clock, a fixed idFactory, and helper functions for creating test entries.
- **Acceptance**: synthetic only; no real prompts; reusable across scoring tests.

### Task 4.2 — Test core types/constants and stable labels

- **Status**: Completed (2026-07-03) — `tests/scoring/types.test.ts`.
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/scoring/types.test.ts`
- **Goal**: Verify label ordering stability, capability class completeness, version constant.
- **Acceptance**: stable label order; all 12 labels present; all 9 capability classes present.

### Task 4.3 — Test signal extraction

- **Status**: Completed (2026-07-03) — `tests/scoring/signals.test.ts`.
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/scoring/signals.test.ts`
- **Goal**: Test that `extractSignals` produces expected signal values for various synthetic entries.
- **Acceptance**: format markers, constraint markers, context markers, vague-task detection, capability inference, metadata flags all verified.

### Task 4.4 — Test dimension scorer behavior

- **Status**: Completed (2026-07-03) — `tests/scoring/dimensions.test.ts`.
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/scoring/dimensions.test.ts`
- **Goal**: Test each of the 7 dimension scorers with good/bad synthetic prompts.
- **Acceptance**: good prompt vs weak prompt produces expected score differences; correct labels emitted.

### Task 4.5 — Test scorePrompt and scorePrompts pipeline

- **Status**: Completed (2026-07-03) — `tests/scoring/score-prompt.test.ts`.
- **Role**: test
- **Depends on**: Task 4.1
- **Files likely touched**: `tests/scoring/score-prompt.test.ts`
- **Goal**: End-to-end pipeline test: synthetic entry in, full `PromptScore` out, all fields valid.
- **Acceptance**: overall + dimension scores within 0–5; labels deduped; explanations present; confidence correct; scored_at from clock; id from idFactory.

### Task 4.6 — Test overall score and safety gate

- **Status**: Completed (2026-07-03) — `tests/scoring/score-prompt.test.ts`.
- **Role**: test
- **Depends on**: Task 4.5
- **Files likely touched**: `tests/scoring/score-prompt.test.ts`
- **Goal**: Verify weighted average produces expected overall; verify safety gate caps at 1 when safety_privacy_score <= 1.
- **Acceptance**: formula verified with known inputs; gate demonstrated.

### Task 4.7 — Test confidence behavior

- **Status**: Completed (2026-07-03) — `tests/scoring/score-prompt.test.ts`.
- **Role**: test
- **Depends on**: Task 4.5
- **Files likely touched**: `tests/scoring/score-prompt.test.ts`
- **Goal**: No metadata → low; full metadata → high; partial → medium.
- **Acceptance**: deterministic; covers all three confidence levels.

### Task 4.8 — Test capability-fit labels

- **Status**: Completed (2026-07-03) — `tests/scoring/dimensions.test.ts`.
- **Role**: test
- **Depends on**: Task 4.4
- **Files likely touched**: `tests/scoring/dimensions.test.ts`
- **Goal**: Test `needs_search`, `needs_tool_use`, `overpowered_model`, `wrong_model_class` labels with synthetic prompts/metadata.
- **Acceptance**: correct labels for matching scenarios; no labels for non-matching scenarios.

### Task 4.9 — Test privacy/no-network guardrails

- **Status**: Completed (2026-07-03) — `tests/scoring/privacy.test.ts`.
- **Role**: test
- **Depends on**: Task 4.5
- **Files likely touched**: `tests/scoring/privacy.test.ts`
- **Goal**: Spy on `globalThis.fetch`; confirm no calls during scoring. Confirm no banned full-answer fields required or emitted. Confirm no prompt_text in explanations/errors.
- **Acceptance**: fetch not called; banned fields absent; prompt text absent from output.

### Task 4.10 — Test deterministic output with fixed clock/idFactory

- **Status**: Completed (2026-07-03) — `tests/scoring/score-prompt.test.ts`.
- **Role**: test
- **Depends on**: Task 4.5
- **Files likely touched**: `tests/scoring/score-prompt.test.ts`
- **Goal**: Same entry + fixed clock + fixed idFactory → identical `PromptScore` across multiple calls.
- **Acceptance**: deep equality of full score object across two calls.

---

## Wave 5 — Documentation and Closeout

Document scoring usage and mark the spec complete.

### Task 5.1 — Create concise scoring documentation

- **Status**: Completed (2026-07-03) — `docs/scoring.md` created.
- **Role**: documentation
- **Depends on**: Waves 0–4 complete
- **Files likely touched**: `docs/scoring.md`
- **Goal**: Brief docs covering public API, dimensions, labels, confidence, privacy rules, non-goals.
- **Acceptance**: concise; no real prompt data; no large code dumps.

### Task 5.2 — Mark 03-scoring-engine complete

- **Status**: Completed (2026-07-03) — all tasks marked complete.
- **Role**: documentation
- **Depends on**: Waves 0–4 complete
- **Files likely touched**: `.kiro/specs/03-scoring-engine/tasks.md`
- **Goal**: Mark all tasks completed in this file.
- **Acceptance**: only mark complete after all tests pass.

### Task 5.3 — Update project handoff and changelog

- **Status**: Completed (2026-07-03) — HANDOFF + CHANGELOG updated.
- **Role**: documentation
- **Depends on**: Task 5.2
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`
- **Goal**: Mark spec complete in HANDOFF; add final changelog entry with `## YYYY-MM-DD HH:MM +08:00`.
- **Acceptance**: accurate; no planned work marked as done.

### Task 5.4 — Optional backup branch after completion

- **Status**: Completed (2026-07-03) — `backup/after-03-scoring-engine-complete` created and pushed.
- **Role**: documentation
- **Depends on**: Task 5.3
- **Files likely touched**: none (git operation only)
- **Goal**: Create `backup/after-03-scoring-engine-complete` after full implementation and test confirmation.
- **Acceptance**: branch points at final closeout commit; pushed to origin.

---

## Deferred / Out of Scope

The following items are explicitly deferred and must not be implemented in this spec:

- **SQLite score persistence** — `prompt_scores` migration and repository. Should be its own later wave/spec after pure scoring is stable and tested.
- **`prompt_score_labels` migration** — normalized labels join table for querying. Part of storage.
- **Dashboard UI** — consumes scoring output; separate spec.
- **Full model recommendation engine** — uses capability-fit signal; separate spec.
- **LLM judge** — optional V2+ enhancement.
- **Rewrite engine** — separate spec.
- **Cloud sync / Supabase** — V2+.
- **Auth/login** — V2+.
- **Team analytics** — V2+.
- **Browser/API/VS Code/Kiro extensions** — V3+.
- **Provider-specific model catalog** — later, replaceable capability map is sufficient for V1.
- **Paid features** — V5+.

Score persistence is storage/dashboard-adjacent and should become its own wave (possibly under a new spec or as a scoring-storage addendum) after pure scoring is stable and all 142+ existing tests plus new scoring tests pass cleanly.

---

## Parallelization Guidance

- Do not parallelize early implementation unless the user explicitly approves.
- Safe future parallel candidates:
  - Independent dimension scorers (Tasks 2.1–2.7) after core types and signals are stable.
  - Independent test files (Tasks 4.2–4.10) after the public API is stable.
- Do not parallelize:
  - Core type definitions and public API (Wave 0 → Wave 3 barrel).
  - Signal extraction and dimension rules if they share constants.
  - Privacy/safety rules and related scorer (must be reviewed together).
  - Tasks editing the same files.

## Recommended Implementation Order

1. Wave 0: Task 0.1, 0.2, 0.3, 0.4.
2. Wave 1: Task 1.1, 1.2, 1.3, 1.4, 1.5.
3. Wave 2: Task 2.1–2.8.
4. Wave 3: Task 3.1–3.8.
5. Wave 4: Task 4.1–4.10.
6. Wave 5: Task 5.1–5.4.
