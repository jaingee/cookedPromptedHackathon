# Rewrite/Template System

## Purpose

The rewrite/template system is a deterministic, local-first, rule-based coaching layer. It consumes prompt scores (dimensions + issue labels), optional value-free safety results, and optional model recommendations to produce structured rewrite guidance and reusable prompt templates.

It does **not** generate polished AI rewrites or invoke any LLM. It coaches the user by explaining what to add, remove, or change — deterministically, locally, and privately.

---

## Included Components

### Source Files

| File | Role |
|------|------|
| `src/rewrite-template/types.ts` | Data contracts (RewriteInput, RewriteSuggestion, GuidanceItem, PromptTemplate, etc.) |
| `src/rewrite-template/guidance-rules.ts` | Issue-label-to-guidance mapping + dimension-score rules |
| `src/rewrite-template/rewrite-engine.ts` | Main rewrite suggestion engine |
| `src/rewrite-template/template-catalog.ts` | Static predefined template catalog (16 entries) |
| `src/rewrite-template/template-generator.ts` | Template selection logic |
| `src/rewrite-template/index.ts` | Module boundary (public exports) |

### Test Files

| File | Coverage |
|------|----------|
| `tests/rewrite-template/rewrite-engine.test.ts` | Issue-label mapping, dimension-score, safety priority, model-rec guidance, no-guidance case, determinism |
| `tests/rewrite-template/template-generator.test.ts` | Template selection, multi-label preference, max 3, stable ordering |
| `tests/rewrite-template/rewrite-template-privacy.test.ts` | No prompt_text leakage, no secrets, no banned fields, no network |

---

## Public API

### Functions

```ts
function generateRewriteSuggestion(input: RewriteInput, options?: RewriteEngineOptions): RewriteSuggestion;
function generateTemplateSuggestion(input: RewriteInput, options?: RewriteEngineOptions): TemplateSuggestion;
```

### Constants

```ts
const REWRITE_ENGINE_VERSION: string;       // e.g., 'rewrite-engine-v1'
const TEMPLATE_GENERATOR_VERSION: string;   // e.g., 'template-generator-v1'
const TEMPLATE_CATALOG: readonly PromptTemplate[];
function getTemplateCatalog(): readonly PromptTemplate[];
```

### Exported Types

- `GuidanceSeverity` — `'low' | 'medium' | 'high' | 'critical'`
- `GuidanceDimension` — `'clarity' | 'context' | 'constraints' | 'output_format' | 'capability_fit' | 'efficiency' | 'safety_privacy'`
- `TemplateCategoryTag` — `'coding' | 'writing' | 'analysis' | 'research' | 'creative' | 'data' | 'communication' | 'general'`
- `RewriteInput` — input interface (includes `prompt_text` for local-only use)
- `GuidanceItem` — a single coaching guidance item
- `RewriteSuggestion` — full rewrite suggestion output
- `PromptTemplate` — a reusable prompt template
- `TemplateSuggestion` — template suggestion output
- `RewriteEngineOptions` — injectable `now` and `idFactory` for deterministic testing

---

## Data Contracts

`RewriteInput` accepts `prompt_text` for local in-memory processing only. The field is used to inform contextual guidance selection but is **never** serialized into any output object.

Output types (`RewriteSuggestion`, `GuidanceItem`, `PromptTemplate`, `TemplateSuggestion`) never contain:
- `prompt_text`
- Matched secret substrings
- Banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`)

---

## Rewrite Guidance Behavior

The engine uses a two-layer rule system:

### Layer 1: Issue-Label Rules

Each `ScoringIssueLabel` present in the input maps to a predefined `GuidanceItem`.

### Layer 2: Dimension-Score Rules

When a dimension score is 0 or 1 AND no issue-label item already covers that dimension, a supplementary guidance item is produced.

Priority assignment:
1. Safety/privacy items (critical/high severity) → priority 1–N (first)
2. Issue-label items ordered by severity (critical > high > medium > low)
3. Dimension-score items ordered by score (lower = higher priority)
4. Model-recommendation items → appended last

---

## Issue-Label Mapping

All 12 scoring issue labels are mapped:

| Issue Label | Dimension | Action | Severity | Core Guidance |
|---|---|---|---|---|
| `missing_context` | context | add | medium | Add domain context, background, or relevant data |
| `unclear_task` | clarity | change | high | Clarify the task objective and expected output |
| `missing_constraints` | constraints | add | medium | Specify constraints: length, tone, format, boundaries |
| `missing_output_format` | output_format | add | medium | Define expected output structure |
| `overbroad_prompt` | efficiency | change | medium | Decompose into smaller focused sub-prompts |
| `privacy_risk` | safety_privacy | review | high | Remove or redact sensitive data before external routing |
| `possible_secret` | safety_privacy | remove | critical | Remove secrets; use placeholder references |
| `wrong_model_class` | capability_fit | change | medium | Consider a different model capability class |
| `overpowered_model` | efficiency | change | low | A cheaper/faster model suffices for this complexity |
| `needs_search` | capability_fit | add | medium | Request search grounding or provide source references |
| `needs_tool_use` | capability_fit | change | medium | Invoke a tool or structured workflow instead |
| `too_long_for_task` | efficiency | remove | medium | Trim unnecessary content; focus on core task |

---

## Dimension-Score Rules

When a dimension score is 0 or 1 and the dimension is not already covered by an issue-label item:

| Dimension | Action | Guidance |
|---|---|---|
| clarity | change | Restate the task in a single clear sentence |
| context | add | Provide relevant background, domain, or data context |
| constraints | add | Add specific constraints (length, tone, boundaries) |
| output_format | add | Define the expected output structure |
| capability_fit | change | Reconsider the model class for this task |
| efficiency | change | Trim unnecessary content or decompose the prompt |
| safety_privacy | review | Review and redact sensitive content |

---

## Safety/Privacy Priority

Safety guidance always takes priority:

1. If `safety_result` contains warnings with severity critical or high → those items are priority 1.
2. If `model_recommendation.safety_posture === 'do_not_route_until_redacted'` → the first guidance item is always a redaction-first instruction.
3. The engine never produces guidance encouraging the user to keep sensitive data for better scores.
4. Citation-needed → guidance requires source citations.
5. Prompt-injection → guidance warns about injection risk and suggests defensive structure.

---

## Model Recommendation Boundary

The engine reads `ModelRecommendation` fields to produce additional lower-priority guidance items:

| Signal | Guidance |
|---|---|
| `cost_speed_posture === 'minimize_cost'` | Suggest simplifying for a cheaper model class |
| `recommended_class === 'frontier_reasoning'` | Note prompt warrants deep reasoning; ensure thorough context |
| `recommended_class === 'local_or_open_weight'` | Note prompt suits a local model; keep concise |
| Issue label `overpowered_model` present | Explain a simpler model suffices |

The engine does NOT call `recommendModel()`, access the model catalog, produce candidate family lists, or reference pricing.

---

## Template Catalog

16 static templates: 12 label-specific + 4 cross-cutting.

### Label-Specific Templates (12)

| Template ID | Name | Applicable Labels |
|---|---|---|
| `tpl-missing-context` | Context-Rich Prompt | missing_context |
| `tpl-unclear-task` | Clear Task Prompt | unclear_task |
| `tpl-missing-constraints` | Constrained Prompt | missing_constraints |
| `tpl-missing-output-format` | Structured Output Prompt | missing_output_format |
| `tpl-overbroad-prompt` | Focused Sub-Task Prompt | overbroad_prompt |
| `tpl-privacy-risk` | Privacy-Safe Prompt | privacy_risk |
| `tpl-possible-secret` | Secret-Free Prompt | possible_secret |
| `tpl-wrong-model-class` | Model-Appropriate Prompt | wrong_model_class |
| `tpl-overpowered-model` | Lightweight Prompt | overpowered_model |
| `tpl-needs-search` | Search-Grounded Prompt | needs_search |
| `tpl-needs-tool-use` | Tool-Enabled Prompt | needs_tool_use |
| `tpl-too-long-for-task` | Concise Prompt | too_long_for_task |

### Cross-Cutting Templates (4)

| Template ID | Name | Applicable Labels |
|---|---|---|
| `tpl-cross-context-format` | Context + Output Structure | missing_context, missing_output_format |
| `tpl-cross-constraints-scope` | Scoped and Constrained | missing_constraints, overbroad_prompt |
| `tpl-cross-safety-first` | Safety-First Prompt | privacy_risk, possible_secret |
| `tpl-cross-model-fit` | Right-Sized Model Prompt | wrong_model_class, overpowered_model |

All template bodies use bracket placeholders only (e.g., `[TASK]`, `[CONTEXT]`, `[CONSTRAINTS]`, `[OUTPUT_FORMAT]`). No prompt text, no secrets, no real user data.

---

## Template Selection

`generateTemplateSuggestion()` selects templates by:

1. Matching input `issue_labels` to each template's `applicable_issue_labels`.
2. Templates covering more input labels are preferred.
3. Templates matching higher-severity labels rank higher as tiebreaker.
4. Stable catalog-order as final tiebreaker.
5. Max 3 templates returned.

If no issue labels are present, no templates are returned.

---

## Privacy and Safety Boundaries

Enforced at every boundary:

- `prompt_text` accepted in `RewriteInput` for local in-memory use only — never in output.
- No matched secret substrings in any output field.
- No banned full-answer fields in any output.
- `example_before`/`example_after` use generic placeholder text only.
- Safety guidance never quotes or references the sensitive content — it only warns about the category.
- Template bodies contain only generic placeholders.
- No network calls, no cloud, no telemetry, no provider calls.

---

## Determinism

Same input → same output. Guaranteed by:

- Pure rule-based logic with no randomness or external state.
- Injectable `now()` for timestamp control.
- Injectable `idFactory()` for ID generation control.
- Stable ordering rules (severity → catalog order).

---

## Testing

52 tests across 3 test files covering:

- Issue-label mapping (all 12 labels produce correct guidance)
- Dimension-score rules (scores 0–1 produce guidance, scores ≥ 2 do not)
- Safety priority (critical/high always first; redaction-first; citation; injection)
- Model recommendation guidance (cost/effort signals at lower priority)
- No-guidance case (perfect scores → empty items)
- Template selection (matching, multi-label preference, max 3, stable order)
- Deterministic output (same input → deep-equal output)
- No-network (globalThis.fetch spy confirms zero calls)
- No prompt_text leakage (sentinel not in JSON.stringify of output)
- No matched secret substrings (sentinel not in output)
- No banned full-answer fields (recursive key + JSON scan)

All test data is synthetic. No real prompts, secrets, or model answers.

---

## Non-Goals

- No LLM-generated rewrites
- No polished rewrite text
- No provider/network/cloud calls
- No persistence/storage in this module
- No dashboard UI, CLI display, or file export
- No packages beyond the existing project
- No dynamic template growth (V2)
- No composable template chaining (V2)

---

## Future Integration

Dashboard, CLI report, and export modules can consume the public API later:

- Import `generateRewriteSuggestion` and `generateTemplateSuggestion` from `src/rewrite-template/index.ts`.
- Pass a `RewriteInput` built from stored `PromptScore` + `SafetyScanResult` + `ModelRecommendation`.
- Display `GuidanceItem` list and `PromptTemplate` suggestions in the UI.
- Export guidance as Markdown or structured data.

Integration is deferred to a future dedicated pass.
