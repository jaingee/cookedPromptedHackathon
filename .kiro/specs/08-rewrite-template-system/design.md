# 08-rewrite-template-system Design

## Overview

The rewrite/template system is a deterministic, local-first, rule-based coaching layer. It consumes prompt scores (dimensions + issue labels), optional value-free safety results, and optional model recommendations to produce structured rewrite guidance and reusable prompt templates. It does not generate polished AI rewrites. It coaches the user by explaining what to add, remove, or change.

Prompt text is used in-memory only to inform contextual guidance selection (e.g., detecting that a prompt already contains some context). It is never stored in, serialized to, or leaked through any output object.

## Design Goals

- Deterministic: same input → same output
- Local-first: no network, cloud, provider calls, telemetry, or LLM
- Rule-based: issue labels and dimension scores map to predefined guidance
- Privacy-safe: no prompt_text, matched secrets, banned fields, or model answers in output
- Coaching-oriented: help the user understand WHAT to improve, not rewrite for them
- Composable output: structured objects suitable for future dashboard/CLI/export
- Safety-first: safety/privacy guidance always takes priority

## Module Boundaries

Planned source structure:

```
src/rewrite-template/
├── types.ts              # Data contracts (RewriteInput, RewriteSuggestion, GuidanceItem, PromptTemplate, etc.)
├── guidance-rules.ts     # Issue-label-to-guidance mapping + dimension-score rules
├── rewrite-engine.ts     # Main rewrite suggestion engine
├── template-catalog.ts   # Static predefined template catalog
├── template-generator.ts # Template selection logic
└── index.ts              # Module boundary (public exports)
```

The module imports from `../scoring/types.js`, `../safety/types.js`, and `../model-recommendation/types.js` but does NOT import their implementations. It depends only on their public type contracts.

## Public API

### Exported Types

```ts
// Severity for guidance items
export type GuidanceSeverity = 'low' | 'medium' | 'high' | 'critical';

// Scoring dimension that a guidance item relates to
export type GuidanceDimension =
  | 'clarity'
  | 'context'
  | 'constraints'
  | 'output_format'
  | 'capability_fit'
  | 'efficiency'
  | 'safety_privacy';

// Template category tags
export type TemplateCategoryTag =
  | 'coding'
  | 'writing'
  | 'analysis'
  | 'research'
  | 'creative'
  | 'data'
  | 'communication'
  | 'general';

// Input to the rewrite engine
export interface RewriteInput {
  prompt_score: PromptScore;       // required
  prompt_text: string;             // required (local-only, never in output)
  safety_result?: SafetyScanResult;
  model_recommendation?: ModelRecommendation;
}

// A single coaching guidance item
export interface GuidanceItem {
  id: string;
  issue_label?: ScoringIssueLabel;
  dimension: GuidanceDimension;
  severity: GuidanceSeverity;
  priority: number;                // 1 = highest priority
  action: 'add' | 'remove' | 'change' | 'review';
  explanation: string;             // plain-language coaching tip
  example_before?: string;         // generic placeholder example (no prompt text)
  example_after?: string;          // generic placeholder example (no prompt text)
}

// The full rewrite suggestion output
export interface RewriteSuggestion {
  prompt_log_id: string;
  guidance_items: GuidanceItem[];
  overall_severity: GuidanceSeverity;
  overall_priority: number;
  summary: string;                 // plain-language summary
  engine_version: string;
  created_at: string;
}

// A reusable prompt template
export interface PromptTemplate {
  template_id: string;
  template_name: string;
  template_body: string;           // generic placeholder text
  category_tags: TemplateCategoryTag[];
  applicable_issue_labels: ScoringIssueLabel[];
  description: string;
  generator_version: string;
  created_at: string;
}

// Template suggestion output
export interface TemplateSuggestion {
  prompt_log_id: string;
  suggested_templates: PromptTemplate[];
  generator_version: string;
  created_at: string;
}

// Options for deterministic testing
export interface RewriteEngineOptions {
  now?: () => string;
  idFactory?: () => string;
}
```

### Exported Values/Functions

```ts
export const REWRITE_ENGINE_VERSION: string;
export const TEMPLATE_GENERATOR_VERSION: string;

export function generateRewriteSuggestion(
  input: RewriteInput,
  options?: RewriteEngineOptions,
): RewriteSuggestion;

export function generateTemplateSuggestion(
  input: RewriteInput,
  options?: RewriteEngineOptions,
): TemplateSuggestion;
```

## Rewrite Suggestion Data Model

`RewriteSuggestion` is the primary output. It contains:

- `prompt_log_id` — references the source prompt (never copies text)
- `guidance_items` — ordered list of coaching tips
- `overall_severity` — worst severity across items (for quick filtering)
- `overall_priority` — priority 1 = most urgent
- `summary` — one plain-language sentence summarizing the coaching
- `engine_version` — for reproducibility
- `created_at` — ISO 8601 timestamp (injectable for tests)

Each `GuidanceItem` contains:
- `id` — stable deterministic ID (e.g., `guidance-{label}-{dimension}`)
- `issue_label` — which issue this addresses (optional: dimension-only items may not have one)
- `dimension` — which scoring dimension it relates to
- `severity` — how important this fix is
- `priority` — numeric rank (1 = first thing to fix)
- `action` — what kind of change: add, remove, change, or review
- `explanation` — plain-language coaching text
- `example_before` / `example_after` — optional generic placeholder examples

## Template Suggestion Data Model

`TemplateSuggestion` wraps one or more `PromptTemplate` objects selected from the static catalog based on the input's issue labels.

Each `PromptTemplate` contains:
- `template_id` — stable catalog ID
- `template_name` — human-readable short name
- `template_body` — generic placeholder text (e.g., `[TASK]: ...\n[CONTEXT]: ...\n[CONSTRAINTS]: ...`)
- `category_tags` — what domain the template suits
- `applicable_issue_labels` — which weaknesses it addresses
- `description` — why this template helps
- `generator_version` / `created_at` — for reproducibility

## Deterministic Rule Mapping Approach

The engine uses a two-layer rule system:

### Layer 1: Issue-Label Rules

Each `ScoringIssueLabel` maps to a predefined `GuidanceItem` factory:

| Issue Label | Dimension | Action | Severity | Core Guidance |
|---|---|---|---|---|
| missing_context | context | add | medium | Add domain context, background, or relevant data |
| unclear_task | clarity | change | high | Clarify the task objective and expected output |
| missing_constraints | constraints | add | medium | Specify constraints: length, tone, format, boundaries |
| missing_output_format | output_format | add | medium | Define expected output structure |
| overbroad_prompt | efficiency | change | medium | Decompose into smaller focused sub-prompts |
| privacy_risk | safety_privacy | review | high | Remove or redact sensitive data before external routing |
| possible_secret | safety_privacy | remove | critical | Remove secrets; use placeholder references |
| wrong_model_class | capability_fit | change | medium | Consider a different model capability class |
| overpowered_model | efficiency | change | low | A cheaper/faster model suffices for this complexity |
| needs_search | capability_fit | add | medium | Request search grounding or provide source references |
| needs_tool_use | capability_fit | change | medium | Invoke a tool or structured workflow instead |
| too_long_for_task | efficiency | remove | medium | Trim unnecessary content; focus on core task |

### Layer 2: Dimension-Score Rules

When a dimension score is 0 or 1 AND no issue label already covers it, a supplementary guidance item is produced:

| Dimension | Score ≤ 1 | Action | Guidance |
|---|---|---|---|
| clarity | 0–1 | change | Restate the task in a single clear sentence |
| context | 0–1 | add | Provide relevant background, domain, or data context |
| constraints | 0–1 | add | Add specific constraints (length, tone, boundaries) |
| output_format | 0–1 | add | Define the expected output structure |
| capability_fit | 0–1 | change | Reconsider the model class for this task |
| efficiency | 0–1 | change | Trim unnecessary content or decompose the prompt |
| safety_privacy | 0–1 | review | Review and redact sensitive content |

### Priority Assignment

1. Safety/privacy items with severity critical or high → priority 1–N (first)
2. Issue-label items ordered by severity (critical > high > medium > low)
3. Dimension-score items ordered by score (lower score = higher priority)
4. Model-recommendation items → appended after issue/dimension items

### No-Guidance Case

When all dimension scores are ≥ 4 AND issue_labels is empty AND no safety warnings exist:
- Return an empty `guidance_items` array
- Summary: "Prompt quality is strong. No coaching guidance needed."

## Safety/Privacy Priority Behavior

Safety guidance ALWAYS takes priority:

1. If `safety_result` contains warnings with severity `critical` or `high`, safety items are priority 1.
2. If `model_recommendation.safety_posture === 'do_not_route_until_redacted'`, the first guidance item is always a redaction-first instruction.
3. The engine NEVER produces guidance encouraging the user to keep sensitive data for better clarity/context scores.
4. Citation-needed → guidance requires source citations.
5. Prompt-injection → guidance warns about injection risk and suggests defensive structure.

## Model Recommendation Integration Boundary

The rewrite engine reads `ModelRecommendation` fields to produce additional guidance items:

| Recommendation Signal | Guidance Produced |
|---|---|
| `cost_speed_posture === 'minimize_cost'` | Suggest simplifying the prompt for a cheaper model class |
| `recommended_class === 'frontier_reasoning'` | Note prompt warrants deep reasoning; ensure constraints/context are thorough |
| `recommended_class === 'local_or_open_weight'` | Note prompt suits a local model; keep concise for smaller context windows |
| Issue label `overpowered_model` present | Explain a simpler model suffices; prompt can be shortened |

These are appended as lower-priority guidance items (they don't override safety).

The rewrite engine does NOT:
- Call `recommendModel()` itself
- Access the model catalog
- Produce candidate family lists
- Reference pricing or cost estimates

## Template Catalog Structure

The template catalog is a static `readonly PromptTemplate[]` defined in `template-catalog.ts`.

### Catalog Size

V1 target: 12 label-specific templates + 4 cross-cutting templates = ~16 templates.

### Template Selection

`generateTemplateSuggestion()` selects templates by matching the input's `issue_labels` to each template's `applicable_issue_labels`. If multiple issue labels are present, templates covering multiple labels are preferred.

Max templates returned: 3 (to avoid overwhelming the user).

Selection priority:
1. Templates matching the most input issue labels
2. Templates matching higher-severity labels first
3. Stable catalog order as tiebreaker

### Template Body Format

Templates use bracket placeholders:

```
[TASK]: Describe what you need done in one clear sentence.
[CONTEXT]: Provide relevant background, domain knowledge, or data.
[CONSTRAINTS]: Specify limits — length, tone, format, boundaries.
[OUTPUT_FORMAT]: Define the structure of the expected output.
```

No prompt text. No real examples from user data. No secrets.

## Privacy Guardrails

Enforced at every boundary:

1. `prompt_text` is accepted in `RewriteInput` for local in-memory processing only.
2. `prompt_text` MUST NOT appear in `RewriteSuggestion`, `GuidanceItem`, `PromptTemplate`, or `TemplateSuggestion`.
3. No matched secret substrings in any output field.
4. No banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`) in any output.
5. `example_before`/`example_after` use generic placeholder text only.
6. Safety guidance never quotes or references the sensitive content — it only warns about the category.
7. Template bodies contain only generic placeholders.
8. No network calls, no cloud, no telemetry, no provider calls.

## Error Handling

- Content-free errors only (no prompt text in error messages).
- Missing optional fields (`safety_result`, `model_recommendation`) → skip those guidance layers.
- Empty `issue_labels` + all scores ≥ 4 → empty guidance (not an error).
- Unknown/new issue labels → skip gracefully (forward-compatible).

## Testing Strategy

Planned tests:

- Issue-label mapping: each label produces correct guidance
- Dimension-score rules: scores 0–1 produce guidance, scores 4–5 do not
- Safety priority: critical/high safety items always first
- Model recommendation: cost/effort signals produce additional items
- No-guidance case: perfect score → empty items
- Privacy: no prompt_text in output, no banned fields, no secrets
- No-network: fetch spy confirms zero calls
- Deterministic: same input → deep-equal output
- Template selection: matching by issue labels, max 3, stable order

## Implementation Waves Preview

- Wave 1 — Data contracts (`types.ts`, `index.ts`)
- Wave 2 — Guidance rules (`guidance-rules.ts`) + rewrite engine (`rewrite-engine.ts`)
- Wave 3 — Template catalog (`template-catalog.ts`) + template generator (`template-generator.ts`)
- Wave 4 — Tests and privacy verification
- Wave 5 — Docs and closeout

## Non-Goals and Deferred Items

- No LLM-generated rewrites
- No polished rewrite text
- No provider/network/cloud calls
- No persistence/storage in this spec
- No dashboard UI or CLI display
- No file export
- No packages
- No dynamic template growth (V2)
- No composable template chaining (V2)
- No improvement-potential scoring (V2)
- No prompt_text or model answers in output
