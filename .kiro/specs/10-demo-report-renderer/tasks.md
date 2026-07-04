# 10-demo-report-renderer Tasks

## Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.
- Documentation: Completed.

## Global Guardrails

Apply to every wave:

- pure renderer only — no side effects, no I/O, no mutation
- no network/cloud/telemetry/provider calls
- no external AI / LLM calls
- no login/auth/billing
- no browser/VS Code/Kiro extension
- no new packages
- no file writing from renderer
- no CLI in this spec
- no dashboard UI in this spec
- no prompt_text in V1 report (include_prompt_text accepted but ignored)
- no matched secret substrings in report
- no banned full-answer fields (assistant_message, response, completion, model_answer, output_text, generated_text)
- no raw errors or stack traces
- deterministic: same input → same output
- coaching tone: direct, useful, slightly playful — never insulting
- consumes UnifiedDemoOutput only — does not import/call other engines
- safety/privacy outranks demo polish

## Wave 0 — Planning and Scope Confirmation

- [x] 0.1 Create task plan (this file).
- [x] 0.2 Confirm pure renderer boundaries: no I/O, no orchestrator calls, no engine imports, no packages.
- [x] 0.3 Confirm V1 privacy decision: include_prompt_text accepted but ignored; report never contains raw prompt_text.

Acceptance: boundaries documented; no implementation started.

## Wave 1 — Data Contracts and Module Boundary

Likely files: `src/demo-report/types.ts`, `src/demo-report/index.ts`.

- [x] 1.1 Define `RenderOptions` interface (include_markdown, include_prompt_text, now, max_issue_patterns, max_templates, max_actions, theme).
- [x] 1.2 Define `ReportSectionKind` union type (batch_overview, prompt_health, issue_patterns, safety_privacy, model_recommendations, rewrite_coaching, next_actions, limitations).
- [x] 1.3 Define `ReportMetric` interface (label, value, unit).
- [x] 1.4 Define `ReportSection` interface (kind, heading, summary, metrics, items, coaching_notes).
- [x] 1.5 Define `CoachingAction` interface (priority, action, source).
- [x] 1.6 Define `DemoReport` interface (title, summary, sections, generated_at, renderer_version, markdown).
- [x] 1.7 Export `DEMO_REPORT_RENDERER_VERSION` and `DEFAULT_DEMO_REPORT_TITLE` constants.
- [x] 1.8 Establish module boundary (`index.ts` barrel) with type exports and placeholder `renderDemoReport` that throws content-free error.

Acceptance: types compile; no prompt_text in output types; no banned fields; public API shape matches design; typecheck + existing tests pass.

## Wave 2 — Coaching Copy and Section Builders

Likely files: `src/demo-report/coaching-copy.ts`, `src/demo-report/section-builders.ts`.

- [x] 2.1 Implement static issue-label-to-coaching-note mapping (all 12 ScoringIssueLabel values → coaching strings from design table).
- [x] 2.2 Implement static dimension-to-coaching-note mapping for weak dimensions.
- [x] 2.3 Implement batch overview section builder (total, succeeded, failed, success %, avg score, duration).
- [x] 2.4 Implement prompt health section builder (dimension averages ranked weakest→strongest, coaching summary for weakest 1–2).
- [x] 2.5 Implement issue patterns section builder (top N issues by frequency, coaching note per label, cap at max_issue_patterns).
- [x] 2.6 Implement safety/privacy section builder (prompts_with_warnings, severity breakdown, do_not_send_external_count, positive message when clean).
- [x] 2.7 Implement model recommendations section builder (class distribution sorted by frequency, dominant-class coaching note when >70%).
- [x] 2.8 Implement rewrite/template coaching section builder (severity distribution, top N templates by frequency).
- [x] 2.9 Implement next actions section builder (3–5 prioritized actions: safety first → issues → dimensions → model fit; pad to min 3).
- [x] 2.10 Implement limitations/local-only section builder (static coaching note).

Acceptance: all builders produce deterministic ReportSection output; empty-state behavior correct; stable sorting; no prompt_text; no banned fields; typecheck passes.

## Wave 3 — Report Renderer and Markdown Renderer

Likely files: `src/demo-report/report-renderer.ts`, `src/demo-report/markdown-renderer.ts`, `src/demo-report/index.ts`.

- [x] 3.1 Implement `renderDemoReport(input, options?)`: apply option defaults, call section builders in fixed order, compute summary, populate generated_at from injectable now.
- [x] 3.2 Implement `renderReportMarkdown(report)`: serialize sections to markdown with headings, tables, bullets, coaching notes; starts with `# {title}`.
- [x] 3.3 Wire markdown: when include_markdown !== false, compute markdown and attach to DemoReport.
- [x] 3.4 Handle error state: when input.error exists, include in summary, still render available sections.
- [x] 3.5 Handle empty state: when prompt_results is empty, produce valid report with "no prompts" sections.
- [x] 3.6 Verify include_prompt_text is accepted but ignored in V1 (no prompt_text in any report field).
- [x] 3.7 Replace placeholder in index.ts with real renderDemoReport export.

Acceptance: deterministic output; markdown well-formatted; error/empty states handled; no prompt_text; no banned fields; no file I/O; typecheck passes.

## Wave 4 — Tests and Privacy Verification

Likely files: `tests/demo-report/report-renderer.test.ts`, `tests/demo-report/markdown-renderer.test.ts`, `tests/demo-report/demo-report-privacy.test.ts`.

- [x] 4.1 Basic render test from synthetic UnifiedDemoOutput.
- [x] 4.2 Markdown included by default, can be omitted with include_markdown: false.
- [x] 4.3 Section order is fixed/deterministic.
- [x] 4.4 Batch overview correctness (total, success %, avg score, duration).
- [x] 4.5 Dimension ranking (weakest first, null last).
- [x] 4.6 Issue sorting and max cap.
- [x] 4.7 Safety section (clean state + risky state).
- [x] 4.8 Model recommendation distribution + dominant-class note.
- [x] 4.9 Template aggregation (top 5).
- [x] 4.10 Next actions priority ordering + padding to min 3.
- [x] 4.11 Empty input → valid report with "no prompts" sections.
- [x] 4.12 Top-level error → reflected in summary.
- [x] 4.13 Deterministic output with fixed now.
- [x] 4.14 No prompt_text in report (even when input contains prompt_text).
- [x] 4.15 No banned fields (recursive key scan).
- [x] 4.16 No secret sentinels in output.
- [x] 4.17 No network/fetch calls.
- [x] 4.18 No input mutation.
- [x] 4.19 Existing baseline regression.

Acceptance: synthetic test data only; all new tests pass; privacy verified; deterministic; no network; existing 575 tests still green.

## Wave 5 — Documentation and Closeout

Likely file: `docs/demo-report-renderer.md`.

- [x] 5.1 Write feature documentation.
- [x] 5.2 Update HANDOFF/CHANGELOG.
- [x] 5.3 Mark spec complete.
- [x] 5.4 Create backup branch `backup/after-10-demo-report-renderer-complete`.

Acceptance: docs concise and privacy-safe; spec marked complete; backup branch created; no CLI/export/dashboard accidentally scoped in.

## Deferred / Out of Scope

- Web UI / interactive rendering
- CLI script (future spec)
- File writing (caller's responsibility)
- PDF/DOCX generation
- Cloud/auth/billing
- LLM narrative generation
- Browser/VS Code/Kiro extension
- New packages
- prompt_text in report (V1: ignored for privacy)
- Live provider calls or telemetry
- Export workflow (future spec)
