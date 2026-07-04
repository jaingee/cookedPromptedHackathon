# Demo Report Renderer

## Purpose

The demo report renderer converts `UnifiedDemoOutput` from the integration demo flow into a structured coaching report with optional markdown output. It renders the "20 Prompts Later: Your AI Habits Exposed" demo experience as a readable local report.

This is a pure renderer: no I/O, no network, no mutation, no LLM calls. It formats existing structured pipeline data into coaching-oriented sections.

## Public API

```ts
renderDemoReport(input: UnifiedDemoOutput, options?: RenderOptions): DemoReport
renderReportMarkdown(report: Omit<DemoReport, 'markdown'>): string
```

### Constants
- `DEMO_REPORT_RENDERER_VERSION` — renderer version identifier
- `DEFAULT_DEMO_REPORT_TITLE` — "20 Prompts Later: Your AI Habits Exposed"

### Options
- `include_markdown` — include markdown string (default true)
- `include_prompt_text` — accepted but ignored in V1 for privacy
- `now` — injectable clock for deterministic timestamps
- `max_issue_patterns` — cap displayed issues (default 10)
- `max_templates` — cap displayed templates (default 5)
- `max_actions` — cap next actions (default 5, min 3)

## Report Sections

Fixed order:
1. **Batch Overview** — total prompts, success rate, average score, duration
2. **Prompt Health** — dimension averages ranked weakest→strongest
3. **Issue Patterns** — most common issues with coaching notes
4. **Safety & Privacy** — warning counts, severity breakdown, do_not_send_external
5. **Model Recommendations** — class distribution, dominant-pattern coaching
6. **Rewrite & Template Coaching** — severity distribution, top templates
7. **Next Actions** — 3–5 prioritized coaching actions
8. **Limitations** — local-only analysis disclaimer

## Markdown Output

When enabled (default), the report includes a markdown string with:
- H1 title, H2 section headings
- Bullet lists for metrics and items
- Numbered list for next actions
- Italic coaching notes
- No raw JSON

## Privacy Guarantees

- No `prompt_text` in V1 report (include_prompt_text accepted but ignored)
- No banned full-answer fields at any level
- No matched secret substrings
- No safety warning messages or matched content
- Uses aggregate data only (counts, labels, averages, template names)
- Content-free errors only
- Safety/privacy outranks demo polish

## Determinism

Same input + same `now` option → same output. No randomness, no system clock dependency when `now` is provided.

## Error Handling

- For valid `UnifiedDemoOutput`, the renderer handles empty prompt results and top-level error states without exposing raw error content.
- The renderer includes top-level fallback defaults for missing `batch_summary`, `metadata`, and `prompt_results`.
- Empty input → valid report with "no prompts" sections.
- Top-level error → reflected in summary, sections still rendered.
- It is not a runtime schema validator. Callers should pass a `UnifiedDemoOutput`-shaped object.

## Out of Scope

- Web UI / interactive rendering
- CLI script (future spec)
- File writing (caller's responsibility)
- PDF/DOCX generation
- Cloud/auth/billing
- LLM narrative generation
- New packages

## Testing

51 demo-report tests across 3 files:
- `tests/demo-report/report-renderer.test.ts` — section behavior, sorting, caps, empty/error states, determinism, safety wording, severity ordering
- `tests/demo-report/markdown-renderer.test.ts` — formatting, headings, determinism
- `tests/demo-report/demo-report-privacy.test.ts` — no prompt_text, no banned fields, no secrets, no fetch, no mutation

Total project verification: 40 test files, 626 tests passing.

## Product Quality Notes

- Current report output is deterministic and privacy-safe.
- The report is useful for demos, but CLI/export/user-facing packaging is intentionally deferred.
- The next polish step before public use is to test the report with realistic local demo data and inspect the human-readability of the markdown.
- Avoid expanding scope until the report copy feels clear and valuable.
