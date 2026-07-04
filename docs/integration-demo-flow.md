# Integration Demo Flow

## Purpose

The integration demo flow provides a local-first structured demo orchestrator that wires all completed V1 engines into a single pipeline call. It accepts prompt log input (built-in demo dataset, local file, or pre-normalized entries), runs the full coaching loop, and returns a unified structured output suitable for display, export, or analysis.

Engines orchestrated: local importer, SQLite storage, scoring engine, score persistence, safety/redaction scanner, model recommendation, rewrite/template system, batch summary.

## Public API

### Main Function

```ts
runIntegrationDemo(input: DemoInput, options?: PipelineOptions): Promise<UnifiedDemoOutput>
```

### Helpers

- `computeBatchSummary(results: PromptResult[]): BatchSummary` — aggregate computation
- `shouldIncludePromptText(options?: PipelineOptions): boolean` — default false
- `makeContentFreeError(step: PipelineStep): string` — content-free error message
- `BANNED_OUTPUT_FIELDS` — list of banned field names
- `isBannedOutputKey(key: string): boolean` — check for banned keys
- `ORCHESTRATOR_VERSION` — version identifier

## Input Modes

| Mode | Description |
|------|-------------|
| `{ mode: 'demo' }` | Loads built-in synthetic demo dataset (~20 prompts) |
| `{ mode: 'file', file_path, source_type }` | Reads a local JSONL or CSV file |
| `{ mode: 'entries', entries }` | Accepts pre-normalized PromptLogEntry[] |

All modes store entries in SQLite before scoring to maintain FK integrity.

## Pipeline Stages

1. Import/normalize or accept entries
2. Store prompt logs in SQLite
3. Score each prompt (deterministic, 7 dimensions)
4. Persist scores
5. Safety scan (value-free warnings)
6. Model recommendation (capability-first)
7. Rewrite suggestion (coaching guidance)
8. Template suggestion (reusable patterns)
9. Compute batch summary (aggregates)
10. Build pipeline metadata (versions, timing)

## Output Shape

```
UnifiedDemoOutput
├── prompt_results: PromptResult[]
├── batch_summary: BatchSummary
├── metadata: PipelineMetadata
└── error?: string (content-free, top-level only)
```

## Privacy and Safety Guarantees

- Local-first only — no network, cloud, telemetry, provider, or LLM calls
- No full model answer storage or banned full-answer fields at any level
- No matched secret substrings in output
- `prompt_text` excluded by default; included only in `PromptResult.prompt_text` when `include_prompt_text === true`
- `BatchSummary` and `PipelineMetadata` never contain `prompt_text`
- Errors are content-free (step name only, no prompt text, stack traces, or secrets)
- Safety/privacy findings outrank demo polish

## Determinism

Injectable options for reproducible output:
- `now?: () => string` — clock for all timestamps
- `idFactory?: () => string` — ID generator for scores and guidance items
- `database_path?: string` — SQLite path (default `:memory:`)

Same input + same options → same output.

## Error Behavior

- **Top-level failure** (storage init, import error): returns empty `prompt_results`, content-free `error`, valid `batch_summary` with zeros
- **Per-prompt failure**: preserves partial results from completed steps, records `failed_step` and content-free `error`, continues to next prompt
- Tests verify `persist_score` partial-result behavior

## Out of Scope

This module does NOT implement:
- CLI renderer or markdown export
- Dashboard UI or web server
- Authentication or billing
- Cloud/Supabase sync
- Browser, VS Code, or Kiro extension
- Live provider calls or LLM rewrite generation
- Background jobs or queues
- File writing from the orchestrator

Rendering/export is a separate future pass that consumes `UnifiedDemoOutput`.
