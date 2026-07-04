# 03-scoring-engine Design

## Overview

This document translates the approved `03-scoring-engine` requirements into a practical, implementation-ready architecture. It defines a deterministic, rule-based, local-first scoring engine that reads normalized `PromptLogEntry` records and produces explainable `PromptScore` results.

The engine is pure: it performs no I/O, no network calls, and no LLM calls. Scoring logic is deterministic given the same input; the only non-deterministic element (`scored_at`) is isolated behind an injectable clock so scoring values, labels, and explanations remain fully reproducible.

Persistence is intentionally deferred. The scoring core returns computed `PromptScore` objects; a later storage wave (its own spec/task set) can persist them into SQLite. This keeps scoring testable, dashboard-ready, and free of database coupling.

---

## Goals and Non-Goals

### Goals

- Pure, deterministic, rule-based scoring across 8 dimensions on a 0–5 scale.
- Stable issue labels, short user-facing explanations, and a coarse confidence level.
- Vendor-neutral capability-fit signal using capability classes, not model names.
- Local-first privacy: no network, no telemetry, no full-answer fields, no prompt content in logs/errors.
- A stable `PromptScore` output shape suitable for later SQLite storage and dashboard consumption.

### Non-Goals

- LLM-based judging (may be explored in V2).
- Full rewrite engine, dashboard UI, model recommendation engine.
- Persistence implementation (defined here as a future shape only).
- Provider/model-specific mapping or hardcoding.
- Paid features, team analytics, cloud sync, auth, extensions.

---

## Architecture

The scoring engine is a self-contained module under `src/scoring/`, consistent with the project's feature-boundary rule (importer parses, storage persists, scoring evaluates).

Recommended future module layout (not created in this pass):

```
src/scoring/
  index.ts                      # public barrel (scorePrompt, scorePrompts, types, version)
  types.ts                      # PromptScore, ScoreValue, ScoreConfidence, etc.
  scoring-engine.ts             # optional createScoringEngine(config) wrapper
  score-prompt.ts               # orchestrates the scoring pipeline for one entry
  clock.ts                      # Clock type + default system clock (injectable)
  dimensions/
    clarity.ts
    context.ts
    constraints.ts
    output-format.ts
    capability-fit.ts
    efficiency.ts
    safety-privacy.ts
  rules/
    issue-labels.ts             # stable label string constants + dedupe helper
    capability-classes.ts       # capability class constants + intent mapping
    safety-patterns.ts          # local regex/pattern library (no real secrets)
  explanations/
    explanation-builder.ts      # maps signals/labels -> short safe explanations
  scoring-version.ts            # SCORING_VERSION constant
```

Design principles:

- Each dimension scorer is a small pure function: `(entry, signals) => DimensionResult`.
- A shared "signal extraction" step computes reusable derived facts once (length, lowercased text, format markers, capability intent, metadata presence) and passes them to dimension scorers. This avoids re-scanning `prompt_text` per dimension and keeps rules consistent.
- The orchestrator (`score-prompt.ts`) assembles dimension results, derives overall score, aggregates labels/explanations, computes confidence, and stamps `scoring_version` + `scored_at`.
- TypeScript ESM with `.js` import specifiers, matching existing project style.

### Scoring Pipeline (high level)

```
PromptLogEntry
  -> extractSignals(entry)                # pure, reusable derived facts
  -> run 7 dimension scorers (pure)        # each returns score + labels + explanations + confidenceImpact
  -> deriveOverallScore(dimensionScores)   # weighted average + safety gate
  -> aggregateLabels(dimensionResults)     # dedupe, stable order
  -> aggregateExplanations(...)            # dedupe, short, no prompt text
  -> deriveConfidence(entry, signals)      # low | medium | high
  -> stamp scoring_version + scored_at (clock)
  -> PromptScore
```

---

## Public API

Small, storage-free, network-free, LLM-free.

```typescript
// Primary functions
export function scorePrompt(entry: PromptLogEntry, options?: ScoringOptions): PromptScore;
export function scorePrompts(entries: PromptLogEntry[], options?: ScoringOptions): PromptScore[];

// Optional convenience wrapper (thin; not required for V1 use)
export function createScoringEngine(config?: ScoringConfig): ScoringEngine;

export interface ScoringEngine {
  score(entry: PromptLogEntry): PromptScore;
  scoreMany(entries: PromptLogEntry[]): PromptScore[];
}
```

- `scorePrompts([])` returns `[]`.
- `ScoringOptions` / `ScoringConfig` are optional and exist mainly to inject a `clock` (and, later, an `idFactory`) for deterministic tests. V1 needs no other config.
- No parameter requires storage, a DB handle, or a network client.

```typescript
export interface ScoringOptions {
  /** Injectable clock for deterministic scored_at in tests. Defaults to system clock. */
  clock?: Clock;
  /** Injectable id generator for the score record id. Defaults to a local uuid-style generator. */
  idFactory?: () => string;
}

export type ScoringConfig = ScoringOptions;

export interface Clock {
  now(): string; // ISO 8601 string
}
```

---

## Core Types

```typescript
export type ScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

export type ScoreConfidence = 'low' | 'medium' | 'high';

export type ScoringIssueLabel =
  | 'missing_context'
  | 'unclear_task'
  | 'missing_constraints'
  | 'missing_output_format'
  | 'overbroad_prompt'
  | 'privacy_risk'
  | 'possible_secret'
  | 'wrong_model_class'
  | 'overpowered_model'
  | 'needs_search'
  | 'needs_tool_use'
  | 'too_long_for_task';

export type CapabilityClass =
  | 'cheap_fast'
  | 'general_purpose'
  | 'coding'
  | 'deep_reasoning'
  | 'long_context'
  | 'tool_using'
  | 'search_required'
  | 'multimodal'
  | 'privacy_sensitive_local';

export interface PromptScore {
  id: string;
  prompt_log_id: string;
  overall_score: ScoreValue;
  clarity_score: ScoreValue;
  context_score: ScoreValue;
  constraints_score: ScoreValue;
  output_format_score: ScoreValue;
  capability_fit_score: ScoreValue;
  efficiency_score: ScoreValue;
  safety_privacy_score: ScoreValue;
  issue_labels: ScoringIssueLabel[];
  explanations: string[];
  confidence: ScoreConfidence;
  scoring_version: string;
  scored_at: string; // ISO 8601, from injectable clock
}
```

Internal (not exported publicly, used by the pipeline):

```typescript
interface DimensionResult {
  score: ScoreValue;
  labels: ScoringIssueLabel[];
  explanations: string[];
}

interface PromptSignals {
  length: number;                 // prompt_text.length (rough proxy)
  lowered: string;                // lowercased prompt_text (kept in-memory only)
  hasFormatMarker: boolean;       // table/json/bullets/code/markdown/email etc.
  hasConstraintMarker: boolean;   // length/tone/audience/scope hints
  hasContextMarker: boolean;      // background/domain indicators
  vagueTaskOnly: boolean;         // "help", "fix this", "make it better" with no object
  requiredCapabilities: CapabilityClass[];  // inferred task intent
  hasModelMetadata: boolean;      // model_used present
  hasUsageMetadata: boolean;      // tokens/cost/latency present
}
```

### The `scored_at` determinism tension (resolved)

Requirements say scoring must be deterministic and not time-dependent, yet output requires `scored_at`. Resolution:

- **Deterministic core**: all `*_score` values, `issue_labels`, `explanations`, and `confidence` are computed purely from the `PromptLogEntry` and never depend on the clock.
- **Isolated timestamp**: `scored_at` is produced by an injectable `Clock`. The default clock returns the current runtime time; tests inject a fixed clock.
- **Determinism tests** compare everything except `scored_at`, or run with a fixed clock so the entire object (including `scored_at`) is reproducible. `id` is likewise injectable so records are reproducible in tests.

---

## Scoring Pipeline

1. **extractSignals(entry)** — compute `PromptSignals` once. Reads `prompt_text`, `tags`, `model_used`, token/cost/latency fields, `redaction_status`. Keeps derived strings in memory only; never logs them.
2. **Run dimension scorers** — 7 pure functions each return a `DimensionResult`.
3. **deriveOverallScore** — weighted average with a safety gate (below).
4. **aggregateLabels** — flatten dimension labels, dedupe, emit in a stable documented order.
5. **aggregateExplanations** — flatten dimension explanations, dedupe, short, no prompt text.
6. **deriveConfidence** — from metadata presence.
7. **stamp** — `scoring_version` (constant) and `scored_at` (clock).

The pipeline never throws on missing optional metadata; it degrades to lower scores/confidence.

---

## Dimension Scoring Strategy

All dimensions return a `ScoreValue` (0–5). Rules are deterministic and character/keyword based (no tokenizer dependency). The examples below are design-level heuristics; exact thresholds are finalized at implementation and captured in `scoring-version`.

### clarity_score
- **Signals**: presence of an explicit task/verb + object; absence of pure-vague phrasing.
- **Rules**: prompts that are only vague requests ("help", "fix this", "make it better", "do the thing") with no object score low (0–2). Clear, specific asks score higher (3–5).
- **Labels**: `unclear_task`.
- **Explanation**: "The prompt does not clearly state what it wants."
- **Confidence impact**: none (depends only on `prompt_text`).

### context_score
- **Signals**: background/domain indicators, references to inputs/data, sufficient detail relative to length.
- **Rules**: no background and very short → low; includes domain, inputs, and relevant detail → higher.
- **Labels**: `missing_context`.
- **Explanation**: "The prompt provides little background or context for the model."
- **Confidence impact**: none.

### constraints_score
- **Signals**: markers for length, tone, audience, scope, format boundaries, must/avoid lists.
- **Rules**: no constraints → low; explicit boundaries → higher.
- **Labels**: `missing_constraints`, and `overbroad_prompt` when the prompt asks for many unrelated things at once.
- **Explanation**: "The prompt does not set boundaries such as length, tone, or scope."
- **Confidence impact**: none.

### output_format_score
- **Signals**: requested format markers (table, JSON, bullets, list, code, markdown, email, steps, schema).
- **Rules**: no format specified → low; explicit format → higher.
- **Labels**: `missing_output_format`.
- **Explanation**: "The prompt does not specify the expected output format."
- **Confidence impact**: none.

### capability_fit_score
- **Signals**: inferred `requiredCapabilities` vs available `model_used` metadata interpreted through capability classes.
- **Rules**: see Capability-Fit Strategy. Mismatch lowers the score.
- **Labels**: `wrong_model_class`, `overpowered_model`, `needs_search`, `needs_tool_use`.
- **Explanation**: e.g. "A simpler, cheaper model class likely fit this task."
- **Confidence impact**: missing `model_used`/usage metadata lowers overall confidence and pushes this dimension toward a neutral score rather than a penalty.

### efficiency_score
- **Signals**: `prompt_text.length` as a rough proxy; repetition; optional token metadata when present.
- **Rules**: very long/repetitive prompts for apparently simple tasks score lower; concise, well-targeted prompts score higher. Token metadata (when available) refines the judgment.
- **Labels**: `too_long_for_task`.
- **Explanation**: "The prompt is long or repetitive for what it asks."
- **Confidence impact**: token metadata increases confidence; length-only estimation is acceptable but weaker.

### safety_privacy_score
- **Signals**: local safety pattern library matches; `redaction_status`.
- **Rules**: any high-severity match (secret/key/token/private key) → low score (0–1) and gates overall; personal/company-sensitive hints → moderate reduction; prompt-injection phrasing → reduction + label.
- **Labels**: `possible_secret`, `privacy_risk`.
- **Explanation**: "Potential secret-like text was detected. Redact before reusing or exporting."
- **Confidence impact**: none (pattern-based, deterministic).

---

## Overall Score Strategy

V1 uses an explainable **weighted average with a safety gate**:

1. Compute a weighted average of the seven dimension scores. Suggested starting weights (finalized at implementation, recorded in `scoring_version`):
   - clarity 0.20, context 0.20, constraints 0.15, output_format 0.15, capability_fit 0.10, efficiency 0.10, safety_privacy 0.10.
2. Round to the nearest integer to produce a `ScoreValue`.
3. **Safety gate**: if `safety_privacy_score <= 1` (a critical secret/privacy risk was detected), cap `overall_score` at `1` regardless of the weighted average. A prompt leaking a secret is not a "good prompt" no matter how clear it is.

This keeps the formula simple, explainable in one sentence per prompt, and testable. Weights and the gate threshold are the two tunable knobs, both documented and versioned.

---

## Issue Labels and Explanations

### Labels

- All labels are stable string constants defined in `rules/issue-labels.ts` and typed via the `ScoringIssueLabel` union.
- Dimension scorers emit labels; the orchestrator flattens, **dedupes** (Set-based), and returns them in a **stable documented order** (the order of the `ScoringIssueLabel` union above) so output is deterministic and dashboard-friendly.
- The set may grow in future versions; consumers must not assume a fixed set (documented in requirements RL-4).

### Explanations

- Built by `explanations/explanation-builder.ts` from dimension results and labels.
- **Short and user-facing**, aligned with brand tone (roast the prompt, not the user). One sentence each.
- **Never quote or include the user's `prompt_text`** or any matched sensitive substring. Explanations describe the issue category only (e.g. "Potential secret-like text was detected."), never the matched value.
- Deduped and capped (guidance: max ~6 explanations, each ≤ ~120 chars) to keep output tidy.

---

## Confidence Strategy

`confidence: 'low' | 'medium' | 'high'` — coarse and dashboard-friendly.

Design rule (deterministic, metadata-driven):

- **high**: `model_used` present AND usage metadata (tokens and/or cost/latency) present.
- **medium**: some metadata present (e.g. `model_used` but no usage, or usage but no model).
- **low**: no model metadata and no usage metadata (scoring relied on `prompt_text` alone).

Confidence reflects how much signal was available for capability-fit and efficiency; it does not change dimension scores, only communicates reliability. Numeric confidence can be introduced later without breaking the string form (a version bump if the field type changes).

---

## Capability-Fit Strategy

Vendor-neutral only. Capability classes are constants in `rules/capability-classes.ts`:

`cheap_fast, general_purpose, coding, deep_reasoning, long_context, tool_using, search_required, multimodal, privacy_sensitive_local`.

### Inferring required capabilities (prompt intent)

Deterministic keyword/pattern mapping from `prompt_text` (and `tags` when useful) to a set of `requiredCapabilities`, e.g.:

- Current-events / "latest" / "today" / "recent news" → `search_required` → label `needs_search`.
- "call an API", "use a tool", "run", "browse", "fetch from" → `tool_using` → label `needs_tool_use`.
- Complex architecture/proof/multi-step reasoning → `deep_reasoning`.
- Code-related intent → `coding`.
- Very large input/long document → `long_context`.
- Sensitive/private content detected → `privacy_sensitive_local`.
- Simple formatting/rephrasing → `cheap_fast`.

### Interpreting model metadata without vendor lock-in

- The engine does **not** hardcode provider/model names. Instead, a **configurable, replaceable capability map** (design-level: a lookup that classifies a `model_used` string into capability classes) lives outside core scoring rules. In V1 this map may be minimal/heuristic; it can be swapped later by the future model-recommendation spec.
- If `model_used` maps to a much more powerful class than the task requires (e.g. simple `cheap_fast` task run on a `deep_reasoning`-class model) → label `overpowered_model`, lower `capability_fit_score`.
- If `model_used` maps to a class that cannot meet a required capability (e.g. task needs `search_required`/`tool_using` but model class lacks it) → label `wrong_model_class`.
- If `model_used` is missing or unmappable → do **not** penalize; move `capability_fit_score` toward neutral (3) and lower overall confidence.

This spec deliberately stops at a capability-fit *signal*. Full model recommendation is a later spec.

---

## Safety and Privacy Strategy

A small **local** pattern library in `rules/safety-patterns.ts` (deterministic regex/heuristics; no real secrets embedded, no network):

- **High severity** (→ `possible_secret`, gate overall): API-key-like strings, access tokens, private key markers (e.g. `BEGIN PRIVATE KEY` style markers), password-like assignments (`password = ...`).
- **Medium severity** (→ `privacy_risk`): email/personal-data hints, company-sensitive markers (internal/confidential indicators).
- **Prompt-injection phrasing** (→ `privacy_risk`): "ignore previous instructions", "disregard the system prompt", etc.

Rules:

- Patterns match **categories**; the engine records the label and a category-level explanation, never the matched substring or its value.
- `redaction_status` from the entry is considered: if already `full`, safety penalties are relaxed; if `none` with matches, penalties apply.
- All detection is local and deterministic. No AI, no network.

---

## Storage Readiness

Scoring core returns `PromptScore`. Persistence is a **future** wave and is not implemented here.

**Recommended future shape**: a single `prompt_scores` table with normalized child tables for labels, consistent with how 02-sqlite-data-layer normalized `prompt_log_tags`:

- `prompt_scores` — one row per score, with all `*_score` columns, `confidence`, `scoring_version`, `scored_at`, `created_at`, nullable `user_id`/`workspace_id` for future auth, and `prompt_log_id` referencing `prompt_logs(id)`.
- `prompt_score_labels` — normalized `(prompt_score_id, label)` join rows (mirrors the tags pattern; enables querying "all prompts with `possible_secret`").
- `explanations` — stored as a JSON/text array column on `prompt_scores` (explanations are display-only and not queried/filtered, so normalization adds little value).

**Tradeoff & decision**: normalize *labels* (they will be filtered/aggregated by the dashboard, and this matches the established tags precedent), but keep *explanations* as a text/JSON array (display-only, variable-length prose). This balances query power against schema simplicity.

Pseudo-schema (illustrative only — real SQL belongs to the storage wave):

```
prompt_scores(
  id, prompt_log_id -> prompt_logs(id),
  overall_score, clarity_score, context_score, constraints_score,
  output_format_score, capability_fit_score, efficiency_score, safety_privacy_score,
  confidence, explanations (JSON/text), scoring_version,
  scored_at, created_at, user_id?, workspace_id?
)
prompt_score_labels(prompt_score_id -> prompt_scores(id), label)
```

Constraints for the future storage wave:

- Score records reference `prompt_logs.id`.
- Score records must **never** include full model answer content or banned full-answer fields.
- Follow the Supabase-portable conventions from 02-sqlite-data-layer (explicit columns, UUID-style IDs, ISO 8601 timestamps, forward-only migrations).

---

## Testing Strategy

Test groups (to become task requirements in the tasks pass; all synthetic data only):

1. **Good vs weak** — a well-structured prompt scores higher overall than a vague one.
2. **Missing context** — lowers `context_score`, emits `missing_context`.
3. **Missing output format** — lowers `output_format_score`, emits `missing_output_format`.
4. **Privacy/secret pattern** — lowers `safety_privacy_score`, emits `possible_secret`/`privacy_risk`, and the safety gate caps `overall_score`.
5. **needs_search** — current-events prompt emits `needs_search`.
6. **needs_tool_use** — tool/API prompt emits `needs_tool_use`.
7. **overpowered_model** — simple task + powerful model metadata emits `overpowered_model`.
8. **wrong_model_class** — task needs a capability the model class lacks → `wrong_model_class`.
9. **Confidence** — no metadata → `low`; full metadata → `high`.
10. **Determinism** — same input + fixed clock → identical `PromptScore`; scores/labels/explanations identical regardless of clock.
11. **Empty batch** — `scorePrompts([])` returns `[]`.
12. **No network** — no `globalThis.fetch` (or equivalent) called during scoring.
13. **No banned fields** — scoring works without banned full-answer fields and never persists/echoes them.
14. **No prompt content in errors/explanations** — safe outputs only.
15. **Synthetic data only** — no real prompts, secrets, or model answers.

---

## Privacy and Failure Modes

Privacy guardrails (enforced by design):

- No network calls, no external AI calls, no telemetry.
- No full model answer fields read, required, or stored.
- No raw parsed row storage.
- No prompt content in logs or errors.
- Explanations never include matched sensitive substrings or the prompt text.
- Synthetic data only in tests.

Failure modes:

- **Missing/malformed optional metadata** (tokens, cost, latency, model) → lower confidence and neutral capability-fit; never throw.
- **Missing required fields** — input is a normalized `PromptLogEntry`, so importer/validation has already enforced required fields. The engine assumes required fields exist; if `prompt_text` is unexpectedly empty, it produces a defensive low-signal score (low scores + `low` confidence) rather than throwing, and never emits prompt content.
- **Rule/internal errors** — surfaced as safe, content-free errors; they never include `prompt_text` or matched values.
- **Deterministic behavior** — guaranteed for all values except `scored_at`, which is clock-injected.

---

## Open Design Notes

- **Exact weights and thresholds** (dimension weights, safety-gate threshold, length thresholds for `too_long_for_task`, keyword lists) will be finalized during implementation and pinned by `SCORING_VERSION`. Changing them later is a version bump.
- **Capability map source**: V1 ships a minimal heuristic model→capability map; the future model-recommendation spec can replace it with a richer, configurable catalogue without touching core scoring rules.
- **id generation**: default local UUID-style generator; injectable for tests. No external id service.
- **scoring_version format**: suggested simple semantic string (e.g. `"1.0.0"`); bumped when rules, weights, labels, or output shape change.
- **Explanations localization/tone modes**: brand tone modes (friendly/sarcastic/etc.) are out of scope for V1 scoring; explanations stay neutral and factual, leaving tone styling to a later UI/copy layer.
