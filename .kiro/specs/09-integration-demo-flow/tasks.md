# 09-integration-demo-flow Tasks

## Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.
- Documentation: Completed.

## Global Guardrails

Apply to every wave:

- local-first
- no network/cloud/telemetry/provider calls
- no external AI / LLM calls
- no login/auth/billing
- no browser/VS Code/Kiro extension
- no team workspace
- no production web app
- no new packages
- no full model answer storage
- no raw parsed row output
- no matched secret substrings in output
- no banned full-answer fields (assistant_message, response, completion, model_answer, output_text, generated_text)
- no prompt_text in batch summary or aggregate output
- prompt_text in prompt-level result only when explicitly requested via include_prompt_text option
- deterministic/rule-based behavior only
- content-free errors (no prompt text, no stack traces, no secrets)
- safety/privacy findings outrank demo polish
- orchestrator returns structured data only — no console output, file writing, or rendering
- all engine imports via public module boundaries only

## Wave 0 — Boundary Confirmation and Task Plan

- [x] 0.1 Create task plan (this file).
- [x] 0.2 Confirm V1 scope boundaries (no UI, no cloud, no auth, no packages, no LLM).
- [x] 0.3 Confirm public API boundaries for all 8 engines. Note: `PromptScoreRepository` is NOT currently exported from `src/storage/sqlite/index.ts` or `src/storage/sqlite/repositories/index.ts`. A small export fix is required in Wave 1.

Acceptance: task plan created; public boundary gap identified; no implementation started.

## Wave 1 — Data Contracts, Module Boundary, and Public Export Fix

Likely files: `src/integration-demo/types.ts`, `src/integration-demo/index.ts`, `src/storage/sqlite/index.ts` (small export addition), `src/storage/sqlite/repositories/index.ts` (small export addition).

- [x] 1.1 Export `PromptScoreRepository` from `src/storage/sqlite/repositories/index.ts` and re-export from `src/storage/sqlite/index.ts`. This is a minimal boundary fix — do not change the repository implementation.
- [x] 1.2 Define `DemoInput` interface (mode: demo/file/entries, file_path, source_type, entries).
- [x] 1.3 Define `PipelineOptions` interface (include_prompt_text, now, idFactory, database_path, user_model_constraints).
- [x] 1.4 Define `PromptResult` interface (prompt_log_id, do_not_send_external, optional prompt_text, optional score/safety/model-rec/rewrite/template, error, failed_step).
- [x] 1.5 Define `BatchSummary` interface (total/succeeded/failed, averages, issue_label_counts, most_common_labels, safety_summary, model_class_distribution).
- [x] 1.6 Define `PipelineMetadata` interface (orchestrator_version, engines_used, timestamps, duration, input_source).
- [x] 1.7 Define `UnifiedDemoOutput` interface (prompt_results, batch_summary, metadata, optional error).
- [x] 1.8 Export `ORCHESTRATOR_VERSION` constant.
- [x] 1.9 Establish module boundary (`index.ts` barrel) with type exports and placeholder `runIntegrationDemo` that throws content-free "not implemented" error.

Acceptance: types compile; PromptScoreRepository accessible through public storage barrel; no prompt_text in BatchSummary or PipelineMetadata types; no banned fields in any output type; typecheck + existing tests pass.

## Wave 2 — Batch Summary and Privacy Helpers

Likely files: `src/integration-demo/batch-summary.ts`, optionally `src/integration-demo/privacy-guards.ts` if useful.

- [x] 2.1 Implement `computeBatchSummary(results: PromptResult[]): BatchSummary` — aggregate averages, issue-label counts, safety severity counts, do_not_send_external count, model class distribution, most common labels.
- [x] 2.2 Implement privacy helper: `shouldIncludePromptText(options?: PipelineOptions): boolean` (default false).
- [x] 2.3 Implement content-free error helper: `makeContentFreeError(step: string): string` (returns "Pipeline failed at [step]." — no prompt text, no stack trace).
- [x] 2.4 Verify BatchSummary computation never includes prompt_text, secrets, or banned fields.

Acceptance: batch summary produces correct aggregates from synthetic PromptResult data; privacy helpers enforce defaults; no prompt_text in batch summary output; deterministic.

## Wave 3 — Orchestrator Core

Likely file: `src/integration-demo/demo-orchestrator.ts`.

- [x] 3.1 Implement input mode handling: `'demo'` → `loadDemoDataset()`; `'file'` → import/normalize via local importer public API; `'entries'` → use directly.
- [x] 3.2 Implement storage lifecycle: open SQLite connection (default `:memory:`), run migrations, create repositories; close on completion; return top-level error on init failure.
- [x] 3.3 Implement per-prompt pipeline loop: for each prompt, run store → score → persist score → safety scan → model recommendation → rewrite suggestion → template suggestion.
- [x] 3.4 Implement per-prompt error handling: catch per-step errors, record content-free error + failed_step in PromptResult, preserve partial results from completed steps, continue to next prompt.
- [x] 3.5 Implement prompt_text boundary: pass prompt_text to safety scanner and rewrite engine for local processing; include in PromptResult only when `include_prompt_text === true`; never include in batch summary.
- [x] 3.6 Implement `do_not_send_external` flag: set true when model recommendation safety_posture is `'do_not_route_until_redacted'` or recommended_class is `'do_not_send_external'`.
- [x] 3.7 Wire deterministic options: pass `now` to scoring/safety/model-rec/rewrite/template engines; pass `idFactory` where accepted; use `database_path` for storage; pass `user_model_constraints` to model recommendation.
- [x] 3.8 Compute PipelineMetadata: orchestrator version, engine versions, start/complete timestamps, duration, input source.
- [x] 3.9 Call `computeBatchSummary()` after all prompts processed.
- [x] 3.10 Replace placeholder in `index.ts` with real `runIntegrationDemo` export from `demo-orchestrator.ts`.

Acceptance: orchestrator runs full pipeline on demo dataset without error; per-prompt partial results work; top-level error on storage failure; deterministic with injected options; no prompt_text leakage; no banned fields; structured output only.

## Wave 4 — Tests and Privacy Verification

Likely files: `tests/integration-demo/demo-orchestrator.test.ts`, `tests/integration-demo/batch-summary.test.ts`, `tests/integration-demo/integration-demo-privacy.test.ts`.

- [x] 4.1 Demo dataset mode test: runs pipeline, produces valid UnifiedDemoOutput with ~20 prompt results.
- [x] 4.2 Entries mode test: accepts pre-normalized entries, produces correct output shape.
- [x] 4.3 Prompt-level result shape test: each result has expected fields (score, safety, model-rec, rewrite, template).
- [x] 4.4 Batch summary correctness test: averages, label counts, safety counts, model distribution are mathematically correct.
- [x] 4.5 Partial results test: inject a prompt that triggers an error in one step; verify partial result + error field + remaining prompts succeed.
- [x] 4.6 Top-level error test: invalid database path → top-level error, empty prompt_results.
- [x] 4.7 Deterministic output test: same input + injected now/idFactory/database → deep-equal output on repeated runs.
- [x] 4.8 include_prompt_text false test: prompt_text absent from all PromptResult and BatchSummary fields.
- [x] 4.9 include_prompt_text true test: prompt_text present in PromptResult.prompt_text only.
- [x] 4.10 No banned fields test: recursive key scan + JSON.stringify scan of full UnifiedDemoOutput.
- [x] 4.11 No matched secret substrings test: safety warning sentinel not in output.
- [x] 4.12 No-network test: globalThis.fetch spy confirms zero calls during full pipeline.
- [x] 4.13 Existing baseline regression: all previous tests still pass.

Acceptance: synthetic test data only; all new tests pass; privacy verified; no network; deterministic; existing 535 tests still green.

## Wave 5 — Documentation and Closeout

Likely file: `docs/integration-demo-flow.md`.

- [x] 5.1 Write feature documentation.
- [x] 5.2 Update HANDOFF/CHANGELOG.
- [x] 5.3 Mark spec complete.
- [x] 5.4 Create backup branch `backup/after-09-integration-demo-flow-complete`.

Acceptance: docs concise and privacy-safe; spec marked complete only after all waves pass; backup branch created; no dashboard/CLI/export/storage accidentally marked done beyond what this spec implements.

## Deferred / Out of Scope

- Web UI / HTTP server
- Cloud/Supabase deployment
- Auth/billing/team workspace
- Browser/VS Code/Kiro extension
- CLI report rendering (caller handles with existing renderDashboardReport)
- Markdown export (future spec)
- New packages
- LLM rewrite generation
- Live provider/pricing calls
- Background workers/queues/job system
- File writing from orchestrator
