# 09-integration-demo-flow Design

## Overview and Goals

The integration demo flow is a local-first orchestration module that connects all completed V1 engines into a single pipeline call. It accepts prompt log input (file, pre-normalized entries, or built-in demo dataset), runs the full coaching loop, and returns a unified structured output. It produces data only — no console output, file writing, or rendering.

Goals:
- Single entry point for the complete V1 coaching loop
- Public API consumption only (no internal engine bypasses)
- Deterministic: same input + same options → same output
- Privacy-safe: prompt_text opt-in only, no secrets/banned-fields at any level
- Partial-result tolerant: one prompt failure does not block the batch
- Structured output suitable for CLI report, markdown export, or dashboard consumption later

## Non-Goals and Deferred Work

- No web UI, HTTP server, or browser interface
- No network/cloud/telemetry/LLM calls
- No auth/billing/team workspace
- No browser/VS Code/Kiro extension
- No new packages
- No file writing or console output from the orchestrator
- No rendering/formatting (caller handles that)
- No full model answer storage or banned full-answer fields
- No raw parsed row output
- Markdown/CLI rendering is a future pass on top of UnifiedDemoOutput

## Module Location and File Structure

```
src/integration-demo/
├── types.ts              # All DTOs: UnifiedDemoOutput, PromptResult, BatchSummary, PipelineMetadata, PipelineOptions, DemoInput
├── demo-orchestrator.ts  # Main pipeline: runIntegrationDemo()
├── batch-summary.ts      # Aggregate computation from prompt results
├── index.ts              # Module boundary (public exports)
```

## Public API Shape

```ts
export const ORCHESTRATOR_VERSION: string;

export interface DemoInput {
  mode: 'demo' | 'file' | 'entries';
  file_path?: string;
  source_type?: 'jsonl' | 'csv';
  entries?: PromptLogEntry[];
}

export interface PipelineOptions {
  include_prompt_text?: boolean;     // default false
  now?: () => string;
  idFactory?: () => string;
  database_path?: string;            // default :memory: for demo
  user_model_constraints?: UserModelConstraints;
}

export async function runIntegrationDemo(
  input: DemoInput,
  options?: PipelineOptions,
): Promise<UnifiedDemoOutput>;
```

The function is async because SQLite operations (store, persist scores) are synchronous but the importer file-read may be async, and future-proofing the API is low-cost.

## Input Modes

| Mode | Behavior |
|------|----------|
| `'demo'` | Load built-in demo dataset via `loadDemoDataset()` |
| `'file'` | Import + normalize from `file_path` using `source_type` via local importer public API |
| `'entries'` | Accept pre-normalized `PromptLogEntry[]` directly |

## Pipeline Stages

For each prompt in the input batch, the orchestrator runs these stages in order:

1. **Store** — persist prompt log via `SqliteStorageAdapter` or `PromptLogRepository`
2. **Score** — run `scorePrompt(entry)` from scoring module
3. **Persist Score** — save score via `PromptScoreRepository.save(score)`
4. **Safety Scan** — run `scanPromptSafety({ prompt_log_id, prompt_text, ... })` from safety module
5. **Model Recommendation** — run `recommendModel({ score, safety_result, ... })` from model-recommendation module
6. **Rewrite Guidance** — run `generateRewriteSuggestion({ prompt_score, prompt_text, safety_result, model_recommendation })` from rewrite-template module
7. **Template Suggestion** — run `generateTemplateSuggestion({ prompt_score, prompt_text, ... })` from rewrite-template module

After all prompts are processed, the orchestrator computes the `BatchSummary` from the collected `PromptResult` objects.

## Unified Output Data Contracts

```ts
export interface UnifiedDemoOutput {
  prompt_results: PromptResult[];
  batch_summary: BatchSummary;
  metadata: PipelineMetadata;
  error?: string;  // top-level content-free error (e.g., storage init failure)
}
```

## Prompt-Level Result DTO

```ts
export interface PromptResult {
  prompt_log_id: string;
  prompt_text?: string;                    // only when include_prompt_text === true
  do_not_send_external: boolean;           // true when safety_posture === 'do_not_route_until_redacted'
  score?: PromptScore;
  safety_result?: SafetyScanResult;
  model_recommendation?: ModelRecommendation;
  rewrite_suggestion?: RewriteSuggestion;
  template_suggestion?: TemplateSuggestion;
  error?: string;                          // content-free per-prompt error, null on success
  failed_step?: string;                    // which pipeline step failed, if any
}
```

Privacy rules:
- `prompt_text` is included ONLY when `options.include_prompt_text === true`
- No matched secrets at any level
- No banned full-answer field keys at any nesting level
- Engine outputs (SafetyScanResult, ModelRecommendation, RewriteSuggestion, TemplateSuggestion) are already privacy-safe by their own module contracts

## Batch-Level Summary DTO

```ts
export interface BatchSummary {
  total_prompts: number;
  succeeded: number;
  failed: number;
  average_overall_score: number | null;
  dimension_averages: Record<string, number | null>;  // clarity, context, constraints, etc.
  issue_label_counts: Record<string, number>;         // ScoringIssueLabel → frequency
  most_common_labels: string[];                       // sorted desc by frequency
  safety_summary: {
    prompts_with_warnings: number;
    severity_counts: Record<string, number>;          // low/medium/high/critical → count
    do_not_send_external_count: number;
  };
  model_class_distribution: Record<string, number>;   // ModelCapabilityClass → count
}
```

Privacy rules:
- NEVER contains prompt_text
- NEVER contains matched secrets
- NEVER contains banned full-answer fields
- Uses only aggregate counts and averages

## Metadata DTO

```ts
export interface PipelineMetadata {
  orchestrator_version: string;
  engines_used: Record<string, string>;  // engine name → version
  pipeline_started_at: string;           // ISO 8601
  pipeline_completed_at: string;         // ISO 8601
  total_duration_ms: number;
  input_source: string;                  // 'demo' | file path | 'entries'
}
```

`engines_used` will reference:
- `scoring: SCORING_VERSION`
- `safety: SAFETY_SCANNER_VERSION`
- `model_recommendation: MODEL_RECOMMENDER_VERSION`
- `rewrite: REWRITE_ENGINE_VERSION`
- `template: TEMPLATE_GENERATOR_VERSION`

## Storage Lifecycle

- Default `database_path` is `:memory:` (in-memory SQLite for demo isolation)
- The orchestrator opens a connection, runs migrations, and creates repositories at pipeline start
- Prompt logs are stored before scoring (scoring reads from stored entry metadata)
- Scores are persisted after scoring (so dashboard/CLI can read them later)
- Connection is closed after pipeline completes
- If storage initialization fails → return top-level `error` in `UnifiedDemoOutput`

## Public API Integration Boundaries

| Engine | Public Import | Functions/Types Used |
|--------|-------------|---------------------|
| Importer | `src/importers/local/index.ts` | `loadDemoDataset`, `buildImportPreview`, `commitImportPreview`, `PromptLogEntry` |
| Storage | `src/storage/sqlite/index.ts` | `createSqliteStorage`, `openSqliteConnection`, `runSqliteMigrations`, `PromptLogRepository`, `SqliteStorageAdapter` |
| Score Persistence | `src/storage/sqlite/repositories/prompt-score-repository.ts` | `PromptScoreRepository` |
| Scoring | `src/scoring/index.ts` | `scorePrompt`, `SCORING_VERSION` |
| Dashboard | `src/dashboard/index.ts` | (optional: `DashboardDataService` for future integration) |
| Safety | `src/safety/index.ts` | `scanPromptSafety`, `SAFETY_SCANNER_VERSION` |
| Model Rec | `src/model-recommendation/index.ts` | `recommendModel`, `MODEL_RECOMMENDER_VERSION` |
| Rewrite/Template | `src/rewrite-template/index.ts` | `generateRewriteSuggestion`, `generateTemplateSuggestion`, `REWRITE_ENGINE_VERSION`, `TEMPLATE_GENERATOR_VERSION` |

No deep/internal imports allowed.

## Safety/Privacy Handling

1. `prompt_text` is passed to `scanPromptSafety` and `generateRewriteSuggestion` for local in-memory processing.
2. `prompt_text` is NOT included in PromptResult unless `include_prompt_text === true`.
3. `prompt_text` is NEVER included in BatchSummary.
4. Safety warnings are value-free (categories/severities only — no matched content).
5. `do_not_send_external` flag is derived from `model_recommendation.safety_posture === 'do_not_route_until_redacted'` or `recommended_class === 'do_not_send_external'`.
6. Banned full-answer fields are never present at any nesting level.
7. If a prompt has critical/high safety severity, the PromptResult orders safety_result before score in the conceptual display priority (reflected by `do_not_send_external: true`).

## Determinism and Injectable Options

| Option | Purpose | Default |
|--------|---------|---------|
| `now` | Injectable clock for timestamps | `() => new Date().toISOString()` |
| `idFactory` | Injectable ID generator | UUID-style local factory |
| `database_path` | SQLite path | `:memory:` |
| `include_prompt_text` | Include prompt text in output | `false` |
| `user_model_constraints` | Passed to model recommendation | `undefined` |

Same input + same options → byte-identical `UnifiedDemoOutput` (when serialized to JSON with stable key order).

## Error Handling and Partial Results

### Per-prompt errors
- Caught silently (no re-throw)
- PromptResult receives `error: 'Pipeline failed at [step_name].'` (content-free)
- PromptResult receives `failed_step: 'score' | 'safety' | 'model_recommendation' | 'rewrite' | 'template'`
- Steps completed before failure produce partial results (e.g., score succeeded but safety failed → score is present, safety/model-rec/rewrite/template are undefined)

### Top-level errors
- Storage initialization failure → `UnifiedDemoOutput.error` is set; `prompt_results` is empty; `batch_summary` reflects zero
- Import/normalize failure → same pattern

### BatchSummary always valid
- Even with zero successes, batch_summary is a valid object with zeros/nulls

## Demo Dataset Handling

- `loadDemoDataset()` from `src/importers/local/demo/demo-dataset-loader.ts` returns ~20 synthetic PromptLogEntry records
- These are pre-normalized and ready for the pipeline
- No file I/O needed for demo mode
- Demo dataset contains no real secrets, no real user data, no real model answers

## CLI/Report/Dashboard Boundary

The orchestrator returns `UnifiedDemoOutput` — a structured, JSON-serializable object. Rendering is NOT the orchestrator's job.

Future rendering options (all separate from this spec):
- Pass to existing `renderDashboardReport` for CLI output
- Build a dedicated `renderDemoReport` for markdown/terminal output
- Consume from a future web dashboard
- Export as JSON/Markdown files

## Testing Strategy

Planned tests:
- Pipeline runs on demo dataset without error
- Pipeline runs on user-imported JSONL/CSV
- Pipeline produces correct PromptResult shape per prompt
- Pipeline produces correct BatchSummary shape
- Partial results when one prompt fails
- Top-level error on storage init failure
- `include_prompt_text: false` → no prompt_text in output
- `include_prompt_text: true` → prompt_text present in PromptResult only
- No banned fields in serialized output
- No matched secrets in output
- Deterministic output with injectable now/idFactory
- No-network verification (fetch spy)
- BatchSummary correctness (averages, label counts, safety counts, model distribution)

## Implementation Waves

- **Wave 1** — Data contracts (`types.ts`, `index.ts` with exported types and version constant)
- **Wave 2** — Demo orchestrator core (`demo-orchestrator.ts`: input handling, pipeline loop, per-prompt error handling, prompt_text boundary)
- **Wave 3** — Batch summary computation (`batch-summary.ts`: aggregate from prompt results)
- **Wave 4** — Tests and privacy verification
- **Wave 5** — Docs and closeout
