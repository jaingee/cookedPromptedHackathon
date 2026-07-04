# 03-scoring-engine Requirements

## Overview

The scoring engine is the first deterministic, rule-based system for evaluating imported prompt logs in cookedPrompts V1. It reads normalized `PromptLogEntry` records and produces per-prompt quality scores, issue labels, short explanations, and a capability-fit signal — all locally, without network calls or an LLM judge.

Scoring is the core product value. The dashboard, recommendations, and exports all depend on meaningful, explainable scores.

---

## User Stories

1. As a user, I want each imported prompt scored so I can see where my prompting is weak.
2. As a user, I want separate dimension scores so I know what to improve (clarity, context, constraints, format, model fit, efficiency, safety).
3. As a user, I want short explanations so I understand why a prompt scored poorly.
4. As a user, I want issue labels so repeated prompt habits can be grouped and tracked.
5. As a user, I want model/capability fit feedback so I can avoid overusing expensive or unsuitable models.
6. As a privacy-conscious user, I want scoring to run entirely locally without uploading prompt data.
7. As a future dashboard, I need stable score outputs that can be queried, sorted, and displayed.
8. As a user, I want confidence levels so I can tell when a score is unreliable due to missing metadata.

---

## Functional Requirements

### FR-1: Score a single prompt log

Given a normalized `PromptLogEntry`, produce a complete score result including dimension scores, overall score, issue labels, explanations, and confidence.

### FR-2: Score a batch/list of prompt logs

Given a list of `PromptLogEntry` records, produce a score result for each. Handle empty lists gracefully (return `[]`).

### FR-3: Produce dimension scores

Each scored prompt must receive a separate 0–5 integer score for each scoring dimension.

### FR-4: Produce an overall score

Each scored prompt must receive a single overall 0–5 score derived from dimension scores. The exact formula is a design decision.

### FR-5: Produce issue labels

Each scored prompt must receive zero or more stable, documented issue labels describing detected weaknesses or risks.

### FR-6: Produce short explanations

Each scored prompt must receive one or more short human-readable explanations for its scores and labels.

### FR-7: Produce a confidence level

Each scored prompt must receive a confidence indicator reflecting how much metadata was available for scoring. If key fields (tokens, model, cost, latency) are missing, confidence should be lower.

### FR-8: Stay deterministic

Scoring the same `PromptLogEntry` must produce the same result every time. No randomness, no external calls, no time-dependent behavior.

### FR-9: Avoid vendor-specific model assumptions

Scoring logic must use vendor-neutral capability classes (see below). Do not hardcode specific provider or model names into scoring rules.

### FR-10: Support future dashboard consumption

Score outputs must have a stable shape suitable for storage, querying, sorting, and display. Scores should reference the source `prompt_log_id`.

### FR-11: Operate independently of the importer

The scoring engine accepts already-normalized `PromptLogEntry` records. It does not parse, validate, or import files.

---

## Scoring Dimensions

Each dimension is scored 0–5:

| Score | Meaning |
|-------|---------|
| 0 | Unusable / missing / critical risk |
| 1 | Very weak |
| 2 | Weak |
| 3 | Acceptable |
| 4 | Strong |
| 5 | Excellent |

### Dimensions

1. **clarity_score** — Is the prompt clear and unambiguous? Does it specify what the user wants?
2. **context_score** — Does the prompt provide sufficient background, constraints, and relevant information?
3. **constraints_score** — Does the prompt specify boundaries (length, format, tone, audience, scope)?
4. **output_format_score** — Does the prompt define the expected output format (code, list, table, prose, etc.)?
5. **capability_fit_score** — Is the model/capability class appropriate for the task? (Based on available metadata.)
6. **efficiency_score** — Does the prompt avoid unnecessary verbosity, redundancy, or token waste?
7. **safety_privacy_score** — Does the prompt avoid leaking secrets, sensitive data, or risky content?
8. **overall_score** — Aggregate score derived from the dimensions above. Formula is a design decision.

---

## Score Output Requirements

### SO-1: Output shape

Each score result must include:

- `prompt_log_id` — references the scored prompt.
- `overall_score` — 0–5 integer.
- `clarity_score` — 0–5 integer.
- `context_score` — 0–5 integer.
- `constraints_score` — 0–5 integer.
- `output_format_score` — 0–5 integer.
- `capability_fit_score` — 0–5 integer.
- `efficiency_score` — 0–5 integer.
- `safety_privacy_score` — 0–5 integer.
- `issue_labels` — string array of zero or more stable labels.
- `explanations` — string array of one or more short human-readable explanations.
- `confidence` — indicator of scoring reliability.
- `scored_at` — ISO 8601 timestamp of when scoring ran.
- `scoring_version` — version identifier for the scoring rules used.

### SO-2: Stability

The output shape must remain backwards-compatible within V1. New fields may be added but existing fields must not be removed or renamed without a version bump.

### SO-3: No banned fields

Score outputs must not contain full model answer content, raw parsed rows, or banned full-answer field values.

---

## Rule and Issue Label Requirements

### RL-1: Deterministic rules

All scoring rules must be deterministic. Given the same input, they must produce the same labels and scores.

### RL-2: Issue labels are stable and documented

Issue labels must be string constants documented in the scoring module. They represent specific detected weaknesses.

### RL-3: Minimum issue labels

The scoring engine must support at least these labels:

- `missing_context` — prompt lacks background or domain information.
- `unclear_task` — prompt does not clearly state what it wants.
- `missing_constraints` — prompt lacks boundaries (length, scope, audience).
- `missing_output_format` — prompt does not specify expected output shape.
- `overbroad_prompt` — prompt tries to do too many things at once.
- `privacy_risk` — prompt may contain sensitive patterns.
- `possible_secret` — prompt may contain API keys, tokens, or credentials.
- `wrong_model_class` — model metadata suggests a mismatch with the task.
- `overpowered_model` — simple task used an expensive/powerful model.
- `needs_search` — prompt requires current/external information.
- `needs_tool_use` — prompt implies tool or API interaction.
- `too_long_for_task` — prompt is excessively verbose for its apparent goal.

### RL-4: Labels may grow

Additional labels may be added in future versions. Consumers should not assume a fixed set.

---

## Model Recommendation / Capability Fit Requirements

### MR-1: Vendor-neutral capability classes

The scoring engine must evaluate model fit using capability classes only:

- `cheap_fast`
- `general_purpose`
- `coding`
- `deep_reasoning`
- `long_context`
- `tool_using`
- `search_required`
- `multimodal`
- `privacy_sensitive_local`

### MR-2: Capability-fit signal

The `capability_fit_score` dimension evaluates whether the model metadata (if available) matches the inferred task requirements. A mismatch lowers the score and may produce labels like `wrong_model_class` or `overpowered_model`.

### MR-3: No concrete model names in scoring rules

Scoring rules must not reference specific provider or model names (e.g., "GPT-4", "Claude"). They may reference capability classes only.

### MR-4: Graceful degradation

If `model_used`, token counts, or cost metadata are missing from the prompt log, capability-fit scoring should produce a lower confidence rather than failing.

---

## Privacy and Safety Requirements

### PSR-1: Local-first

All scoring runs locally. No network calls, no cloud upload, no telemetry.

### PSR-2: No banned full-answer fields

The scoring engine must never require, read, or store banned full-answer fields (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).

### PSR-3: No prompt content in errors/logs

Scoring errors and log output must not contain the user's prompt text or any sensitive data.

### PSR-4: No external AI calls

V1 scoring must be deterministic and rule-based. It must not call external AI services, LLM APIs, or cloud endpoints.

### PSR-5: Prompt text is read-only input

The scoring engine reads `prompt_text` to analyze quality but must not persist, copy, or transmit it outside the scoring process. Score outputs reference `prompt_log_id`, not prompt content.

### PSR-6: Safety dimension detects risks

The `safety_privacy_score` dimension should detect patterns suggesting secrets, credentials, sensitive data, or privacy risks. Detection is local, pattern-based, and does not require AI.

---

## Data and Storage Requirements

### DSR-1: Score output entity

Scoring results should be storable as a `prompt_scores` entity referencing `prompt_logs.id`.

### DSR-2: Potential storage fields

Future storage may include:

- `id`
- `prompt_log_id` (FK to `prompt_logs`)
- `overall_score`
- `clarity_score`
- `context_score`
- `constraints_score`
- `output_format_score`
- `capability_fit_score`
- `efficiency_score`
- `safety_privacy_score`
- `issue_labels`
- `explanations`
- `confidence`
- `scoring_version`
- `created_at`
- `user_id` (nullable in V1)
- `workspace_id` (nullable in V1)

### DSR-3: No banned field storage

Score records must not include full model answer content.

### DSR-4: Supabase-friendly schema direction

Storage fields should use explicit columns, UUID-style IDs, ISO 8601 timestamps, and nullable future-auth fields — matching the patterns established in 02-sqlite-data-layer.

### DSR-5: Score persistence strategy

Whether scoring persists immediately on computation or returns computed results for a later storage pass is a design decision. Both approaches should be supported by the requirements.

---

## Testing Requirements

### TR-1: Obviously good prompt scores higher than obviously weak prompt

A well-structured, specific prompt should receive a higher overall score than a vague, context-free prompt.

### TR-2: Missing context lowers context_score

A prompt without background information should receive a low `context_score`.

### TR-3: Missing output format lowers output_format_score

A prompt that does not specify expected output format should receive a low `output_format_score`.

### TR-4: Privacy/secret patterns lower safety_privacy_score and add issue label

A prompt containing patterns like API keys or credentials should score low on `safety_privacy_score` and receive `privacy_risk` or `possible_secret` labels.

### TR-5: Simple task with expensive model metadata flags overpowered_model

A simple formatting prompt with `model_used` metadata suggesting a deep reasoning model should produce the `overpowered_model` label.

### TR-6: Current-events prompt flags needs_search

A prompt asking about recent news or current information should produce the `needs_search` label.

### TR-7: Deterministic scoring

Scoring the same `PromptLogEntry` multiple times must return identical results.

### TR-8: Batch scoring handles empty lists

`scoreMany([])` or equivalent must return `[]` without errors.

### TR-9: No network calls during scoring

No `globalThis.fetch` or equivalent should be called during any scoring operation.

### TR-10: No banned full-answer fields required or persisted

Scoring must work without banned full-answer fields and must never persist them.

### TR-11: No prompt content in errors

Scoring failures must produce safe errors without prompt text.

### TR-12: All test data synthetic

Tests must use synthetic prompt text only. No real user prompts, secrets, or model answers.

### TR-13: Confidence reflects missing metadata

Scoring a prompt with no token/cost/latency metadata should produce a lower confidence than scoring one with full metadata.

### TR-14: Scoring version included in output

Each score result must include a `scoring_version` field.

---

## Non-Goals

- LLM-based judge as a V1 requirement (may be explored in V2).
- Full rewrite engine (separate spec).
- Full dashboard (separate spec, consumes scoring output).
- Paid features or premium scoring tiers.
- Team analytics or aggregate scoring.
- Supabase/cloud sync of scores.
- Auth/login-gated scoring.
- Browser extension / API wrapper / VS Code extension / Kiro extension capture.
- Model-provider hardcoding in scoring rules.
- Full model answer storage or analysis.

---

## Open Questions

1. **Overall score weighting formula** — How should dimension scores be combined? Equal weight? Weighted by importance? Minimum-of-all? To be decided in design.
2. **Issue labels storage format** — Should `issue_labels` be stored as a normalized join table (like tags) or as a JSON/text array in the `prompt_scores` row? To be decided in design.
3. **Confidence representation** — Should confidence be `low | medium | high` or a numeric 0–1 value? To be decided in design.
4. **Model metadata availability** — How much model metadata (provider, model name, tokens, cost, latency) is reliably available from imported prompt logs? Capability-fit scoring must gracefully degrade when metadata is missing.
5. **Score persistence timing** — Should scoring persist results immediately to SQLite, or return computed results for a separate storage step? To be decided in design.
6. **Safety pattern library** — What set of regex/patterns should detect secrets, credentials, and sensitive content for V1? Exact patterns are a design/implementation decision.
7. **Prompt length thresholds** — What token count or character count thresholds should trigger `too_long_for_task`? To be decided in design based on capability class expectations.
