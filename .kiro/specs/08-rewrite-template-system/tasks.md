# 08-rewrite-template-system Tasks

## Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.

## Global Guardrails

Apply to every wave:

- local-first
- no network/provider calls
- no cloud sync
- no telemetry
- no LLM / external AI
- no prompt_text in any output object
- no matched secret substrings in output
- no full model answer fields in output
- no banned full-answer fields (assistant_message, response, completion, model_answer, output_text, generated_text)
- no persistence/storage in this spec
- no dashboard UI / CLI display / file export
- no packages
- deterministic/rule-based V1 behavior only
- content-free errors
- safety/privacy guidance must always outrank rewrite convenience

## Wave 0 — Task Plan and Boundaries

- [x] 0.1 Create task plan (this file).
- [x] 0.2 Confirm implementation boundaries: no storage, no dashboard, no CLI, no export, no LLM, no packages; prompt_text used in-memory only and never in output.

Acceptance: requirements/design translated into implementation waves; deferred work remains deferred; no implementation started.

## Wave 1 — Data Contracts and Public Module Boundary

Likely files: `src/rewrite-template/types.ts`, `src/rewrite-template/index.ts`.

- [x] 1.1 Define `GuidanceSeverity`, `GuidanceDimension`, `TemplateCategoryTag` types.
- [x] 1.2 Define `RewriteInput` interface (imports `PromptScore`, `SafetyScanResult`, `ModelRecommendation` from sibling modules).
- [x] 1.3 Define `GuidanceItem` interface.
- [x] 1.4 Define `RewriteSuggestion` interface.
- [x] 1.5 Define `PromptTemplate` interface.
- [x] 1.6 Define `TemplateSuggestion` interface.
- [x] 1.7 Define `RewriteEngineOptions` interface.
- [x] 1.8 Export `REWRITE_ENGINE_VERSION` and `TEMPLATE_GENERATOR_VERSION` constants.
- [x] 1.9 Establish module boundary (`index.ts` barrel) with type-only exports and placeholder function signatures for `generateRewriteSuggestion` and `generateTemplateSuggestion`.

Acceptance: types compile; no prompt_text in output types; no banned full-answer fields in output types; public API shape matches design; typecheck + existing test baseline unchanged.

## Wave 2 — Guidance Rules and Rewrite Engine

Likely files: `src/rewrite-template/guidance-rules.ts`, `src/rewrite-template/rewrite-engine.ts`.

- [x] 2.1 Implement issue-label-to-guidance mapping (all 12 `ScoringIssueLabel` values → predefined `GuidanceItem` factories per design table).
- [x] 2.2 Implement dimension-score guidance rules (scores 0–1 produce supplementary guidance where not already covered by an issue-label item).
- [x] 2.3 Implement safety/privacy priority ordering (critical/high safety items always priority 1; `do_not_route_until_redacted` → redaction-first item; citation-needed and prompt-injection rules).
- [x] 2.4 Implement model recommendation lower-priority guidance (minimize_cost → simplify; frontier_reasoning → ensure thorough; local_or_open_weight → keep concise; overpowered_model → shorter prompt).
- [x] 2.5 Implement no-guidance case (all scores ≥ 4, no issue labels, no safety warnings → empty guidance_items, summary says "no coaching guidance needed").
- [x] 2.6 Implement `generateRewriteSuggestion()` orchestration: extract signals → apply Layer 1 → apply Layer 2 → apply safety priority → append model-rec items → assign priority numbers → compute overall_severity/priority → build summary → return `RewriteSuggestion`.
- [x] 2.7 Verify prompt_text is used in-memory only and never serialized into the output object.

Acceptance: all 12 ScoringIssueLabels mapped; scores 0–1 produce supplementary guidance where not already covered; safety/privacy items always first; model-rec guidance appended lower priority; empty guidance returned for strong prompts; deterministic ordering; no prompt_text in output; typecheck + existing test baseline unchanged.

## Wave 3 — Template Catalog and Template Generator

Likely files: `src/rewrite-template/template-catalog.ts`, `src/rewrite-template/template-generator.ts`.

- [x] 3.1 Create static template catalog (~16 entries: 12 label-specific + 4 cross-cutting templates).
- [x] 3.2 Each template uses bracket placeholders only ([TASK], [CONTEXT], [CONSTRAINTS], [OUTPUT_FORMAT], etc.). No prompt_text. No secrets.
- [x] 3.3 Each template has `template_id`, `template_name`, `template_body`, `category_tags`, `applicable_issue_labels`, `description`.
- [x] 3.4 Implement template selection logic in `generateTemplateSuggestion()`: match input issue_labels to template `applicable_issue_labels`; prefer templates covering more labels; prefer higher-severity label matches; stable catalog-order tiebreaker; max 3 templates returned.
- [x] 3.5 Verify no prompt_text, matched secrets, or banned fields in any template output.

Acceptance: template bodies use placeholders only; no prompt_text in output; no matched secrets; no banned full-answer fields; multi-label templates preferred; stable ordering; max 3 returned; typecheck + existing test baseline unchanged.

## Wave 4 — Tests and Privacy Verification

Likely files: `tests/rewrite-template/rewrite-engine.test.ts`, `tests/rewrite-template/template-generator.test.ts`, `tests/rewrite-template/rewrite-template-privacy.test.ts`.

- [x] 4.1 Issue-label mapping tests (each of the 12 labels produces correct guidance item with expected dimension/action/severity).
- [x] 4.2 Dimension-score guidance tests (scores 0–1 produce supplementary guidance; scores 4–5 do not).
- [x] 4.3 Safety priority tests (critical/high safety items always first; do_not_route_until_redacted → redaction-first; citation-needed; prompt-injection).
- [x] 4.4 Model recommendation guidance tests (minimize_cost, frontier_reasoning, local_or_open_weight signals produce expected items at lower priority).
- [x] 4.5 No-guidance case test (all scores ≥ 4, no labels, no safety → empty guidance).
- [x] 4.6 Template selection tests (matching by issue labels, multi-label preference, max 3, stable ordering).
- [x] 4.7 Deterministic output tests (same input → deep-equal output for both functions).
- [x] 4.8 No-network tests (globalThis.fetch spy confirms zero calls during generateRewriteSuggestion and generateTemplateSuggestion).
- [x] 4.9 No prompt_text leakage tests (inject sentinel into prompt_text → not found in JSON.stringify of output).
- [x] 4.10 No matched secret substrings tests (sentinel in safety warning messages → not found in output).
- [x] 4.11 No banned full-answer fields tests (recursive key scan + JSON.stringify scan).
- [x] 4.12 Existing baseline regression (all previous tests still pass).

Acceptance: synthetic test data only; no real prompts; no fake secrets echoed in output; globalThis.fetch not called; existing tests still pass; new test count should exceed current 483.

## Wave 5 — Documentation and Closeout

Likely files: `docs/rewrite-template.md`.

- [x] 5.1 Write feature documentation.
- [x] 5.2 Update HANDOFF/CHANGELOG.
- [x] 5.3 Mark spec complete.
- [x] 5.4 Create backup branch `backup/after-08-rewrite-template-system-complete`.

Acceptance: docs concise and privacy-safe; spec marked complete only after all waves pass; backup branch created only after closeout; no dashboard/CLI/export/storage work accidentally marked done.

## Deferred / Out of Scope

- LLM-generated rewrites
- Polished rewrite text
- Provider/network/cloud calls
- Persistence/storage
- Dashboard UI / CLI display / file export
- Packages
- Dynamic template growth (V2)
- Composable template chaining (V2)
- Improvement-potential scoring (V2)
- Full model answer storage
- prompt_text leakage into output
- Matched secret substrings in output
