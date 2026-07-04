# cookedPrompts Scoring Engine

## Purpose

The scoring engine turns a normalized `PromptLogEntry` into a deterministic, local `PromptScore`. It evaluates prompt quality across seven dimensions, emits issue labels and short explanations, and signals capability-fit — all without network calls, LLM judges, or storage writes.

It helps cookedPrompts identify prompt weaknesses, habit issues, model-choice problems, and privacy risks.

## Public API

```typescript
import { scorePrompt, scorePrompts, createScoringEngine } from '../src/scoring/index.js';
```

- `scorePrompt(entry, options?)` — score one normalized prompt log entry.
- `scorePrompts(entries, options?)` — score a list, preserving order; returns `[]` for `[]`.
- `createScoringEngine(config?)` — convenience wrapper that closes over config (clock/idFactory).

Options allow injecting a fixed `clock` and `idFactory` for deterministic tests.

## Input Contract

- Input is `PromptLogEntry` from `src/importers/local/types.ts`.
- Scoring reads `prompt_text` in memory only — never logs, persists, or returns it.
- Input must never contain full model answer fields.

## Output Contract

Each `PromptScore` includes:

- `id` — from injectable idFactory (default: local UUID).
- `prompt_log_id` — equals `PromptLogEntry.id`.
- `overall_score` — 0–5, weighted average with safety gate.
- Seven dimension scores (`clarity_score`, `context_score`, `constraints_score`, `output_format_score`, `capability_fit_score`, `efficiency_score`, `safety_privacy_score`) — each 0–5.
- `issue_labels` — deduped, stable-order string array.
- `explanations` — short, safe, category-level (max 6, ~120 chars each).
- `confidence` — `'low' | 'medium' | 'high'`.
- `scoring_version` — bumped on rule/weight changes.
- `scored_at` — ISO 8601, from injectable clock.

`PromptScore` never copies `prompt_text` or stores full model answers.

## Scoring Dimensions

| Dimension | Evaluates |
|-----------|-----------|
| clarity | Whether the prompt clearly states a task with specificity. |
| context | Whether background, domain, and input detail are provided. |
| constraints | Whether boundaries (length, tone, audience, scope) are set. |
| output_format | Whether an expected output shape is specified. |
| capability_fit | Whether model metadata matches the inferred task intent (vendor-neutral). |
| efficiency | Whether the prompt is concise for its task (character-based proxy). |
| safety_privacy | Whether secret/sensitive/injection patterns are detected locally. |

## Issue Labels

Stable, documented labels in canonical order:

`missing_context`, `unclear_task`, `missing_constraints`, `missing_output_format`, `overbroad_prompt`, `privacy_risk`, `possible_secret`, `wrong_model_class`, `overpowered_model`, `needs_search`, `needs_tool_use`, `too_long_for_task`.

Consumers must not assume this set is fixed; it may grow in future versions.

## Confidence

- **high** — model metadata and usage metadata (tokens/cost/latency) present.
- **medium** — either model metadata or usage metadata present.
- **low** — neither present.

Confidence does not change dimension scores — it signals reliability to the UI.

## Safety and Privacy Rules

- No network calls, no external AI/LLM judge, no telemetry.
- No storage writes in this spec.
- No prompt text in `PromptScore`, logs, or errors.
- No matched secret substrings returned — safety matcher reports category + severity only.
- No banned full-answer fields emitted or required.
- Local regex-based pattern detection only.

## Determinism

Scores, labels, explanations, and confidence are fully deterministic for the same input. Only `id` and `scored_at` depend on injectable non-deterministic helpers (clock/idFactory); tests inject fixed values for reproducibility.

## Non-goals / Deferred Work

- SQLite score persistence (`prompt_scores` table).
- Dashboard UI.
- Full model recommendation engine.
- LLM-based judge.
- Rewrite engine.
- Cloud sync, auth/login, browser/API/VS Code/Kiro extensions, billing.

## Current Verification

- `npm run typecheck` — passes.
- `npm test` — 20 test files, 203 tests, all passing.
- `git diff --check` — clean.
