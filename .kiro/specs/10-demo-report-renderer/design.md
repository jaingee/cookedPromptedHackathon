# 10-demo-report-renderer Design

## Overview

The demo report renderer is a pure, deterministic, local-first module that transforms `UnifiedDemoOutput` into a structured `DemoReport` with optional markdown output. It is a formatter/presenter — it does not re-score, re-scan, call AI, or perform I/O.

The renderer reads batch_summary, prompt_results, and metadata from the pipeline output and produces coaching-oriented sections: batch overview, prompt health, issue patterns, safety posture, model recommendations, rewrite coaching, and prioritized next actions.

## Design Goals

- Pure function: no side effects, no I/O, no mutation, no network
- Deterministic: same input → same output, injectable `now`
- Privacy-safe: no prompt_text by default, no secrets, no banned fields
- Coaching-tone: direct, useful, slightly playful — never insulting
- Structured + markdown: programmatic access and human-readable export
- No packages: uses only standard TypeScript/string operations

## Module Structure

```
src/demo-report/
├── types.ts              # DemoReport, ReportSection, RenderOptions, CoachingAction, etc.
├── report-renderer.ts    # Main renderDemoReport() entry point
├── section-builders.ts   # Per-section builder functions
├── coaching-copy.ts      # Static label-to-coaching-note mappings
├── markdown-renderer.ts  # renderReportMarkdown() pure serializer
├── index.ts              # Module boundary (public exports)
```

## Public API

```ts
export const DEMO_REPORT_RENDERER_VERSION: string;
export const DEFAULT_DEMO_REPORT_TITLE: string;

export function renderDemoReport(
  input: UnifiedDemoOutput,
  options?: RenderOptions,
): DemoReport;
```

## Data Contracts

### RenderOptions

```ts
export interface RenderOptions {
  include_markdown?: boolean;      // default true
  include_prompt_text?: boolean;   // default false (V1: accepted but ignored for safety)
  now?: () => string;              // injectable timestamp
  max_issue_patterns?: number;     // default 10
  max_templates?: number;          // default 5
  max_actions?: number;            // default 5, min 3
  theme?: 'twenty_prompts_later';  // future: more themes
}
```

V1 decision: `include_prompt_text` is accepted in the type but **ignored** — V1 never includes raw prompt_text in report output. This is documented as a privacy-first choice; future versions may implement opt-in with strict safety guards.

### DemoReport

```ts
export interface DemoReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  generated_at: string;
  renderer_version: string;
  markdown?: string;
}
```

### ReportSection

```ts
export type ReportSectionKind =
  | 'batch_overview'
  | 'prompt_health'
  | 'issue_patterns'
  | 'safety_privacy'
  | 'model_recommendations'
  | 'rewrite_coaching'
  | 'next_actions'
  | 'limitations';

export interface ReportMetric {
  label: string;
  value: string | number | null;
  unit?: string;
}

export interface ReportSection {
  kind: ReportSectionKind;
  heading: string;
  summary?: string;
  metrics?: ReportMetric[];
  items?: string[];
  coaching_notes?: string[];
}
```

### CoachingAction

```ts
export interface CoachingAction {
  priority: number;       // 1 = highest
  action: string;         // short actionable description
  source: string;         // what triggered it (safety, issue, dimension, model)
}
```

## Section Builder Design

Each section has a dedicated builder function:

### 1. Batch Overview
- **Input**: BatchSummary, PipelineMetadata
- **Output**: total, succeeded, failed, success %, average score, duration
- **Empty state**: "No prompts analyzed."
- **Sorting**: none (fixed layout)

### 2. Prompt Health / Score Dimensions
- **Input**: BatchSummary.dimension_averages
- **Output**: dimensions ranked weakest→strongest, coaching sentence for weakest 1–2
- **Empty state**: "Not enough data to assess prompt health."
- **Sorting**: ascending by average score; null values sort last

### 3. Issue Patterns
- **Input**: BatchSummary.issue_label_counts, BatchSummary.most_common_labels
- **Output**: top N issues (default 10) with frequency + coaching note per label
- **Empty state**: "No recurring issues detected. Your prompts are clean."
- **Sorting**: frequency desc → alphabetical tiebreaker (already sorted in BatchSummary)

### 4. Safety / Privacy
- **Input**: BatchSummary.safety_summary
- **Output**: prompts_with_warnings, severity breakdown, do_not_send_external count
- **Empty state**: "No safety concerns detected. Your prompts look safe for external routing."
- **Sorting**: severity desc (critical → high → medium → low)

### 5. Model Recommendations
- **Input**: BatchSummary.model_class_distribution
- **Output**: class distribution sorted by frequency, dominant-pattern coaching note
- **Empty state**: "No model recommendations available."
- **Sorting**: frequency desc → alphabetical
- **Special rule**: if one class > 70% → coaching note about the pattern

### 6. Rewrite / Template Coaching
- **Input**: prompt_results[].rewrite_suggestion, prompt_results[].template_suggestion
- **Output**: severity distribution across rewrites, top N templates by frequency
- **Empty state**: "Your prompts need minimal coaching. Nice work."
- **Sorting**: templates by suggestion frequency desc → template_name alphabetical

### 7. Next Actions
- **Input**: safety_summary, most_common_labels, dimension_averages, model_class_distribution
- **Output**: 3–5 prioritized CoachingAction items
- **Priority order**: safety first → issue frequency → dimension weakness → model fit
- **Pad rule**: if <3 sources, add general encouragement actions to reach min 3
- **Sorting**: priority asc (1 = first)

### 8. Limitations / Local-Only Note
- **Input**: none (static)
- **Output**: fixed note about local-only analysis, no AI rewriting, verify recommendations
- **Always included** as the final section

## Deterministic Coaching Copy

Static `Record<ScoringIssueLabel, string>` mapping each label to a coaching note:

| Label | Coaching Note |
|-------|---------------|
| missing_context | Add background, goal, and audience so the model has enough to work with. |
| unclear_task | State the objective in one sentence. What does "done" look like? |
| missing_constraints | Specify length, tone, format, or boundaries. |
| missing_output_format | Tell the model what shape the output should be (JSON, list, prose, etc.). |
| overbroad_prompt | Break this into smaller focused sub-tasks. |
| privacy_risk | Remove or redact sensitive data before sending externally. |
| possible_secret | Never paste secrets. Use placeholder references instead. |
| wrong_model_class | Match the task to the right model capability class. |
| overpowered_model | A cheaper/faster model handles this fine. Save the frontier for hard tasks. |
| needs_search | Ground factual claims with source references. |
| needs_tool_use | Use a tool or structured workflow instead of asking the model directly. |
| too_long_for_task | Trim filler. Focus on the core request. |

Dimension coaching follows a similar static mapping for scores below threshold.

## Markdown Renderer Design

```ts
function renderReportMarkdown(report: Omit<DemoReport, 'markdown'>): string
```

- Starts with `# {title}`
- Summary paragraph
- Each section gets `## {heading}`, then metrics as table/bullets, items as bullets, coaching_notes as blockquotes or italic notes
- Next actions as numbered priority list
- Limitations as final italic note
- Deterministic: same input → same string
- No circular reference (markdown field computed after report object)

## Privacy Design

1. `prompt_text` is NEVER included in V1 report (include_prompt_text accepted but ignored)
2. No banned field names in any DemoReport key at any nesting level
3. No matched secret substrings — renderer only uses aggregate data (counts, labels, averages)
4. Safety section uses severity counts only, never warning messages or matched content
5. Report uses prompt_log_id only where necessary; prefers aggregate counts
6. Content-free errors only: "Report rendering encountered an issue." (no details)

## Error Handling

- Empty prompt_results → valid report with "No prompts analyzed" sections
- Top-level error in input → shown in summary, sections still rendered from available data
- Missing/null fields → skip gracefully, use "not enough data" indicators
- Never throws: all paths produce a valid DemoReport
- Malformed section data → skip section content, include empty section with error note

## Testing Strategy

Planned test files:
- `tests/demo-report/report-renderer.test.ts` — full render, section order, options
- `tests/demo-report/markdown-renderer.test.ts` — markdown formatting, determinism
- `tests/demo-report/demo-report-privacy.test.ts` — no prompt_text, no banned fields, no secrets

Test coverage:
- Basic render from synthetic UnifiedDemoOutput
- Markdown included by default, can be omitted
- Section order is fixed/deterministic
- Batch overview correctness
- Dimension ranking (weakest first)
- Issue sorting + max cap
- Safety section (clean + risky states)
- Model recommendation distribution + dominant-class note
- Template aggregation (top 5)
- Next actions priority ordering + padding
- Empty input → valid report
- Top-level error → reflected in summary
- Deterministic with fixed `now`
- No prompt_text in output
- No banned keys (recursive scan)
- No secret sentinels
- No fetch calls
- No input mutation

## Implementation Waves

- **Wave 1** — Data contracts (`types.ts`, `index.ts`, version constants, placeholder)
- **Wave 2** — Section builders + coaching copy (`section-builders.ts`, `coaching-copy.ts`)
- **Wave 3** — Report renderer (`report-renderer.ts`) + markdown renderer (`markdown-renderer.ts`)
- **Wave 4** — Tests and privacy verification
- **Wave 5** — Docs and closeout

## Integration Boundaries

- Consumes `UnifiedDemoOutput` from `src/integration-demo/types.js`
- Does NOT import or call `runIntegrationDemo`
- Does NOT import scoring/safety/model-rec/rewrite engines
- Does NOT write files (caller's responsibility)
- Future CLI/export can call both `runIntegrationDemo` and `renderDemoReport`

## Non-Goals and Deferred Items

- Web UI / interactive rendering
- PDF/DOCX generation
- File writing from renderer
- Cloud/auth/billing
- LLM narrative generation
- Browser/VS Code/Kiro extension
- New packages
- Prompt_text inclusion (V1: ignored for privacy)
- Live provider calls or telemetry
