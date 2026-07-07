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
- `DEMO_REPORT_RENDERER_VERSION` - renderer version identifier
- `DEFAULT_DEMO_REPORT_TITLE` - "20 Prompts Later: Your AI Habits Exposed"

### Options
- `include_markdown` - include markdown string (default true)
- `include_prompt_text` - accepted for compatibility; CLI now requests prompt text locally so redacted examples can render
- `now` - injectable clock for deterministic timestamps
- `max_issue_patterns` - cap displayed issues (default 10)
- `max_templates` - cap displayed templates (default 5)
- `max_actions` - cap next actions (default 5, min 3)
- `max_prompt_examples` - cap prompt examples (default 3)

## Report Sections

Fixed order:
1. **Batch Verdict** - total prompts, success rate, duration, overall score, score band, short coaching verdict
2. **Prompt Habit Score** - overall 0-100 score and band
3. **Category Scorecard** - fixed category scores for Clarity, Context, Constraints, Output Format, Model Fit, Efficiency, and Safety & Privacy
4. **What Kept Hurting Results** - most common issues with human-readable labels and coaching notes
5. **Prompt Examples** - up to 3 redacted local examples with score, coaching, masked excerpts, and stronger rewrite guidance
6. **Roast of the Batch** - one memorable roast line with a short coaching reason for the weakest prompt habit
7. **One Good Prompt Worth Copying** - a strong local example with a reusable pattern to copy
8. **Model Waste / Overkill** - overkill/underfit signals plus vendor-neutral model-fit coaching
9. **Safety & Privacy** - warning counts, severity breakdown, do_not_send_external
10. **Safety & Privacy Lessons** - aggregate redaction and sharing guidance with masked placeholders
11. **Model Recommendations** - class distribution, dominant-pattern coaching
12. **Rewrite & Template Coaching** - severity distribution, top templates
13. **Top Fixes Checklist** - 3-5 prioritized coaching actions with clean source prefixes
14. **Limitations** - contextual local-analysis coaching disclaimer

Prompt examples and the two coaching highlights only appear when eligible prompt text is available after redaction. The safety lessons section appears when the batch contains safety warnings or redaction-worthy prompt content.

## Score Foundation

- 0-5 scores are converted to 0-100 with `Math.round(score * 20)`
- Score bands are deterministic:
  - `0-49` - `Poor`
  - `50-69` - `Okay`
  - `70-84` - `Good`
  - `85-100` - `Excellent`
- Missing score inputs remain `null`
- Category score order is fixed for stable report comparison across runs

## Markdown Output

When enabled (default), the report includes a markdown string with:
- H1 title, H2 section headings
- Bullet lists for metrics and items
- Numbered list for the top fixes checklist
- Score and score-band bullet rows
- Category scorecard bullet rows with optional coaching sub-bullets
- Italic coaching notes
- No raw JSON

## Privacy Guarantees

- No full model answers or assistant completions
- No banned full-answer fields at any level
- No matched secret substrings
- No safety warning messages or matched content
- Prompt examples are redacted locally before display and may appear when prompt text is available
- Prompt example cards include deterministic stronger versions built from safe local templates only
- Uses aggregate data plus deterministic scorecard output only
- Content-free errors only
- Safety/privacy outranks demo polish

## Determinism

Same input plus same `now` option produces the same output. No randomness, no system clock dependency when `now` is provided.

## Error Handling

- For valid `UnifiedDemoOutput`, the renderer handles empty prompt results and top-level error states without exposing raw error content.
- The renderer includes top-level fallback defaults for missing `batch_summary`, `metadata`, and `prompt_results`.
- Empty input produces a valid report with "no prompts" sections.
- Top-level error is reflected in the summary and sections still render.
- It is not a runtime schema validator. Callers should pass a `UnifiedDemoOutput`-shaped object.

## Out of Scope

- Copy polish / tone tuning beyond the current coaching sections
- New CLI flags
- Web UI / interactive rendering
- File writing (caller's responsibility)
- PDF/DOCX generation
- Cloud/auth/billing
- LLM narrative generation
- New packages

## Testing

Demo-report tests cover the score foundation, prompt example selection, redaction, markdown rendering, prompt coaching highlights, model-waste coaching, safety lessons, and privacy regression cases across the demo-report test files.

Total project verification: 45 test files, 873 tests passing.

## Product Quality Notes

- 12B makes the report feel more like a Lighthouse-style coach.
- 12C2 adds concrete prompt examples without weakening the privacy boundary.
- 12C3 adds stronger prompt rewrites, a roast, and a copy-worthy prompt so the report teaches through examples.
- 12C4 adds model waste / overkill and deeper safety/privacy teaching sections.
- 12D completes the report polish, docs cleanup, and final demo review.
- The detailed coaching report spec is now complete.
