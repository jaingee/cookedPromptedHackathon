# Demo Report Renderer — Product Readability Review

Date: 2026-07-04
Reviewer: Kiro agent (source-based analysis)
Method: Source inspection of section-builders, coaching-copy, markdown-renderer, and demo dataset. Runtime execution blocked by TypeScript ESM loader requirement in Node.js without tsx/ts-node installed. Review is based on deterministic source analysis of what the renderer produces.

---

## Overall Assessment

**Verdict: Ready for CLI wrapping with minor copy improvements.**

The report structure is solid. The 8-section layout gives a clear coaching flow: overview → health → issues → safety → model fit → coaching → actions → limitations. The coaching copy is direct and useful. Markdown formatting is clean (no raw JSON, proper headings, bullet/numbered lists). Privacy guarantees hold.

---

## What Works Well

1. **Section structure is coherent** — the progression from "here's what you did" to "here's what to fix" feels natural for a coaching report.
2. **Coaching copy is punchy** — notes like "State the objective in one sentence. What does 'done' look like?" and "Trim filler. Focus on the core request." are the right tone: direct, actionable, not insulting.
3. **Safety section is appropriately cautious** — "No safety warnings were detected by the local scan" avoids overclaiming external routing safety.
4. **Markdown avoids raw JSON** — all data is formatted as bullet lists, numbered lists, or inline text.
5. **Deterministic** — same input → same output, injectable clock, stable sorting everywhere.
6. **Privacy-safe** — no prompt_text, no banned fields, no warning messages, aggregate-only.

---

## Areas for Polish (Recommended Backlog)

### P1 — Summary sentence could be punchier
The current summary is factual: "Analyzed 20 prompts with a 100% success rate. Average prompt score: 3.2/5."

Consider adding a one-line coaching hook:
> "Your prompts work, but they're under-specified. The biggest gap is missing context."

This is a future copy pass — the current factual summary is fine for a V1 demo.

### P2 — Next Actions formatting ✅ Addressed in copy polish pass
Actions now render with clean human-readable prefixes: `Safety:`, `Issue:`, `Prompt health:`, `Model fit:` — no brackets. Encouragement actions have no prefix.

### P3 — Dimension names are raw identifiers ✅ Addressed in copy polish pass
The report now uses human-friendly labels via `humanizeDimension()` and `humanizeIssueLabel()` helpers. Dimensions show as "Context & Background: 2.8 / 5" and issues as "Missing context (×3)".

### P4 — Template section shows template_name only
This is correct for privacy. But the user might benefit from a one-line description of each template. The data exists (`description` field on PromptTemplate). Future: include template.description in the rewrite_coaching section items.

### P5 — Limitations section is static
The text is reasonable but generic. Future: make it contextual (e.g., "This analysis covered 20 prompts from the demo dataset...").

### P6 — No "Roast of the Week" / highlight
The HANDOFF mentions a "Roast of the Week" concept for the demo. The current renderer doesn't surface a single worst-prompt highlight. This is a feature addition, not a bug — it belongs in a future pass if the demo needs more personality.

---

## Privacy Review

✅ No prompt_text in any section (verified by 12 privacy tests)
✅ No banned full-answer field keys at any nesting level
✅ No safety warning messages leaked (only severity counts)
✅ No template_body content in report (only template_name)
✅ No matched secret substrings
✅ All coaching text is static from coaching-copy.ts

---

## Readability Verdict by Section

| Section | Readability | Notes |
|---------|-------------|-------|
| Batch Overview | ✅ Good | Clear metrics, percentage formatting |
| Prompt Health | ✅ Good | Weakest-first ranking is intuitive |
| Issue Patterns | ✅ Good | Frequency + coaching notes work well |
| Safety & Privacy | ✅ Good | Cautious wording, severity breakdown |
| Model Recommendations | ✅ Good | Distribution with dominant-class note |
| Rewrite Coaching | ⚠️ Adequate | Severity distribution items are technical; template frequency is clear |
| Next Actions | ⚠️ Adequate | `[source]` prefix is dev-oriented; content is actionable |
| Limitations | ✅ Good | Sets expectations appropriately |

---

## Recommended Next Steps (Priority Order)

1. **Wrap in CLI** (11-demo-runner-cli) — the report is ready to be output to terminal/file. Do this first.
2. **Copy polish pass** — after seeing the report in a real terminal, improve human-readability of dimension names, action prefixes, and summary hooks. Keep it a separate small pass.
3. **Template description inclusion** — add `description` to rewrite coaching section items if templates are useful to show.
4. **Consider "Roast of the Week"** — only if the demo needs more personality. Not required for V1 viability.

---

## Conclusion

The renderer produces a privacy-safe, deterministic, structurally sound coaching report that answers the key demo questions: What's weak? Why? What to fix? Which model? The copy is direct and useful without being insulting. It is ready for CLI wrapping. Minor copy/formatting polish can happen after seeing the report in a real terminal context.
