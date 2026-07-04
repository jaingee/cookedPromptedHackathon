# 07-model-recommendation Design

## Overview

The recommendation engine is deterministic and local. It maps prompt score, optional safety signals, and task/shape indicators to capability-class guidance and optional candidate model families from a local catalog. It can use local token-cost metadata when available, but it never calls providers or pricing pages.

Given a `ModelRecommendationInput`, the engine produces a `ModelRecommendation` containing a capability class, effort level, cost/speed posture, privacy posture, safety posture, a plain-language explanation, optional candidate families, and an optional approximate cost estimate. The same input always produces the same output. No prompt text or model answers appear in the output.

The engine is capability-first and vendor-neutral by default. Candidate families and region metadata exist to support user choice, not to rank providers or national origin.

## Design Goals

- local-first
- deterministic
- vendor-neutral default
- capability-first recommendations
- frontier/global and China model catalog coverage
- token-cost-aware without live pricing
- no network/provider calls
- maintainable model catalog
- no prompt text leakage
- no national-origin ranking
- extensible for future dashboard/export/rewrite features

## Data Contracts

These TypeScript contracts are the planned public shapes. They are documented here for planning only and are implemented in Wave 1. Where a better project type already exists (for example `PromptScore` from `src/scoring/types.ts` and `SafetyScanResult` from `src/safety/types.ts`), the implementation SHOULD import and use those types instead of `unknown`.

```ts
export type ModelCapabilityClass =
  | 'basic_fast'
  | 'balanced_general'
  | 'high_quality'
  | 'frontier_reasoning'
  | 'coding_specialist'
  | 'long_context'
  | 'multimodal'
  | 'local_or_open_weight'
  | 'search_grounded'
  | 'safety_sensitive'
  | 'do_not_send_external';

export type RecommendedEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type CostSpeedPosture =
  | 'minimize_cost'
  | 'balanced'
  | 'prioritize_quality'
  | 'prioritize_speed';

export type PrivacyPosture =
  | 'local_only_recommended'
  | 'external_ok_after_review'
  | 'external_not_recommended';

export type SafetyRoutingPosture =
  | 'safe_to_route'
  | 'review_before_routing'
  | 'do_not_route_until_redacted';

export type ModelProviderRegion =
  | 'global'
  | 'us'
  | 'eu'
  | 'china'
  | 'open_weight'
  | 'unknown';

export interface ModelPricing {
  currency: 'USD' | 'CNY' | 'unknown';
  unit: 'per_1m_tokens' | 'per_1k_tokens' | 'unknown';
  input_token_cost?: number;
  output_token_cost?: number;
  cached_input_token_cost?: number;
  reasoning_token_cost?: number;
  image_input_cost?: number;
  audio_input_cost?: number;
  pricing_notes?: string;
  pricing_known_as_of: string;
  pricing_source_notes?: string;
  pricing_confidence: 'low' | 'medium' | 'high';
}

export interface ModelCatalogEntry {
  id: string;
  provider: string;
  model_family: string;
  representative_model_ids: string[];
  region_or_origin: ModelProviderRegion;
  access_type: 'hosted_api' | 'chat_app' | 'open_weight' | 'restricted' | 'unknown';
  license_or_distribution: 'proprietary' | 'open_weight' | 'open_source' | 'restricted' | 'unknown';
  capability_tags: ModelCapabilityClass[];
  modality_tags: Array<'text' | 'vision' | 'audio' | 'video' | 'image_generation' | 'code' | 'search'>;
  context_window_class: 'short' | 'medium' | 'long' | 'very_long' | 'unknown';
  cost_class: 'low' | 'medium' | 'high' | 'unknown';
  speed_class: 'fast' | 'balanced' | 'slow' | 'unknown';
  quality_class: 'basic' | 'strong' | 'frontier' | 'unknown';
  reasoning_class: 'none' | 'standard' | 'strong' | 'frontier' | 'unknown';
  pricing?: ModelPricing;
  privacy_notes?: string;
  safety_notes?: string;
  availability_notes?: string;
  known_as_of: string;
  source_notes?: string;
}

export interface TokenEstimateInput {
  input_tokens_estimate?: number;
  output_tokens_estimate?: number;
}

export interface UserModelConstraints {
  prefer_low_cost?: boolean;
  prefer_speed?: boolean;
  prefer_quality?: boolean;
  prefer_local_or_open_weight?: boolean;
  allow_china_models?: boolean;
  allow_global_frontier_models?: boolean;
  require_search_grounding?: boolean;
  require_multimodal?: boolean;
  max_estimated_cost?: number;
  preferred_currency?: 'USD' | 'CNY';
}

export interface ModelRecommendationInput {
  score?: unknown; // implementation should map to PromptScore where available
  safety_result?: unknown; // implementation should map to SafetyScanResult where available
  prompt_metadata?: {
    source?: string;
    provider?: string;
    model_used?: string;
    tags?: string[];
  };
  user_constraints?: UserModelConstraints;
  token_estimate?: TokenEstimateInput;
}

export interface ModelCandidateFamily {
  catalog_id: string;
  provider: string;
  model_family: string;
  representative_model_ids: string[];
  reason: string;
  pricing_known_as_of?: string;
}

export interface EstimatedModelCost {
  input_tokens_estimate?: number;
  output_tokens_estimate?: number;
  estimated_min_cost?: number;
  estimated_max_cost?: number;
  currency: 'USD' | 'CNY' | 'unknown';
  pricing_known_as_of: string;
  note: string;
}

export interface ModelRecommendation {
  recommended_class: ModelCapabilityClass;
  recommended_effort: RecommendedEffort;
  cost_speed_posture: CostSpeedPosture;
  privacy_posture: PrivacyPosture;
  safety_posture: SafetyRoutingPosture;
  explanation: string;
  candidate_families: ModelCandidateFamily[];
  estimated_cost?: EstimatedModelCost;
  confidence: 'low' | 'medium' | 'high';
  recommender_version: string;
  created_at: string;
}
```

Contract rules:

- Do not use `unknown` loosely in the final implementation if better project types exist. Import `PromptScore` and `SafetyScanResult` where appropriate.
- `ModelRecommendation` MUST NOT include prompt text.
- No contract MUST include model answers.

## Capability Classes

- **basic_fast** — simple, low-risk tasks (short rewrites, formatting, trivial lookups). Cheapest/fastest classes are fine.
- **balanced_general** — normal everyday tasks that need decent quality but not frontier reasoning.
- **high_quality** — quality-sensitive tasks that benefit from a stronger general model without full frontier reasoning.
- **frontier_reasoning** — complex, high-stakes, multi-step reasoning; ambiguity that a well-formed prompt still cannot remove.
- **coding_specialist** — coding, debugging, refactoring, or code-heavy tasks.
- **long_context** — long prompts, many files, or large reference material.
- **multimodal** — image/audio/video input needs.
- **local_or_open_weight** — privacy-sensitive tasks that favor local/open-weight deployment.
- **search_grounded** — tasks needing current facts or citations.
- **safety_sensitive** — high-stakes legal/medical/financial or otherwise sensitive tasks requiring caution and sources.
- **do_not_send_external** — prompts that should not leave the machine until safety/redaction issues are resolved.

## Model Catalog Design

Use a static local catalog first. Likely future file: `src/model-recommendation/model-catalog.ts`.

- No DB persistence required.
- No live refresh required.
- No provider API calls.

The catalog SHALL include frontier/global model families, China model families, open-weight families, and restricted-access families. Token-cost metadata is included only when source-checked. Every entry carries `known_as_of`; pricing (when present) carries `pricing_known_as_of`, `pricing_source_notes`, and `pricing_confidence`.

The catalog is seed data, not a permanent guarantee of exhaustive current availability. The recommendation engine must not break when a family is renamed or removed.

## Token Cost Design

Local, optional token-cost support.

Rules:

- Token prices are optional catalog metadata.
- If token prices are unavailable, use `cost_class`.
- If token prices are stale, include a warning note in the recommendation.
- If input/output token estimates are unavailable, do not compute an exact cost.
- If multiple candidate families match, estimated cost may be a range.
- Input and output token costs must be separate.
- Cached input costs are optional.
- Reasoning token costs are optional.
- Media costs are optional.
- Do not make live pricing calls.
- Do not scrape.
- Do not claim current pricing unless source-checked.

Possible helper functions for later implementation:

- `estimateModelCost(entry, tokenEstimate)`
- `hasUsablePricing(entry)`
- `getPricingFreshness(entry)`
- `selectCostSpeedPosture(input, scoreSignals, safetySignals)`

## Seed Model Family Coverage

This table is seed coverage only. Names should be source-checked/updated during any future catalog refresh. "Seed catalog coverage" does not mean every model version forever. Candidate families are examples, not a guarantee of access or availability.

### Frontier / global seed families

| Provider | Family | Notes |
|----------|--------|-------|
| OpenAI | GPT frontier family | flagship general/reasoning |
| OpenAI | GPT fast/mini/nano family | cheap/fast tier |
| OpenAI | Codex/coding family | if distinct in source docs |
| Anthropic | Claude Fable family | frontier tier |
| Anthropic | Claude Opus family | high quality/reasoning |
| Anthropic | Claude Sonnet family | balanced |
| Anthropic | Claude Haiku family | fast/cheap |
| Anthropic | Claude Mythos cybersecurity family | restricted/invitation-only if applicable |
| Google | Gemini Pro family | high quality |
| Google | Gemini Flash family | fast |
| Google | Gemini Flash-Lite family | cheapest/fastest |
| Google | Gemini Deep Think / reasoning family | if documented |
| xAI | Grok general family | general |
| xAI | Grok coding/build family | coding |
| xAI | Grok media/voice families | if documented |
| Meta | Llama open-weight family | open weight |
| Mistral | Mistral / Mixtral family | frontier/open |
| Cohere | Command family | general/enterprise |
| Perplexity | search-grounded family | only if included later, source-checked |

### China seed families

| Provider | Family | Notes |
|----------|--------|-------|
| Alibaba | Qwen / Tongyi family | broad |
| Alibaba | Qwen Max / Plus / Flash hosted family | hosted tiers |
| Alibaba | Qwen open-weight family | open weight |
| DeepSeek | DeepSeek V family | general |
| DeepSeek | DeepSeek R / reasoner family | reasoning |
| DeepSeek | DeepSeek Pro / Flash hosted family | hosted tiers |
| Moonshot | Kimi family | long-context reputation |
| Moonshot | Kimi K / code family | if documented |
| Zhipu | GLM family | general |
| MiniMax | MiniMax family | general/multimodal |
| Baidu | ERNIE / Wenxin family | general |
| Tencent | Hunyuan family | general |
| ByteDance | Doubao / Seed family | general |
| StepFun | Step family | general |
| 01.AI | Yi family | open weight/general |
| SenseTime | SenseNova family | general |
| Baichuan | Baichuan family | general |
| (various) | Mimo family | if documented |

Region/provider origin is metadata for user choice, compliance, availability, and deployment planning only. The recommendation output is capability-first, never nationality-first.

## Recommendation Engine Architecture

Simple deterministic layers:

1. Normalize input.
2. Extract score signals.
3. Extract safety signals.
4. Extract token estimate if provided.
5. Infer task/capability needs.
6. Choose capability class.
7. Choose effort level.
8. Choose cost/speed/privacy/safety posture.
9. Filter local catalog by user constraints.
10. Select optional candidate families from local catalog.
11. Estimate approximate token cost if local pricing exists.
12. Produce explanation.

Likely files: `src/model-recommendation/model-recommender.ts`, `src/model-recommendation/cost-estimator.ts`, `src/model-recommendation/model-catalog.ts`, `src/model-recommendation/types.ts`, `src/model-recommendation/index.ts`.

## Recommendation Rules

Use scoring dimensions where available (`clarity`, `context`, `constraints`, `output_format`, `capability_fit`, `efficiency`, `safety_privacy`):

- low clarity/context/constraints → recommend prompt improvement or a balanced model, not necessarily a stronger model
- low output format → recommend rewriting the prompt before a stronger model
- low capability fit → recommend a different capability class
- low safety/privacy score or safety warnings → external_not_recommended / do_not_route_until_redacted
- high complexity + good prompt → frontier_reasoning + high/xhigh
- coding tags/issues → coding_specialist
- current/factual prompts → search_grounded
- long prompt / many files → long_context
- image/audio/video needs → multimodal
- low-risk simple task → basic_fast
- normal task → balanced_general
- low-cost preference + simple task → basic_fast / minimize_cost
- low-cost preference + complex task → balanced_general or high_quality, but warn quality may suffer
- max estimated cost exceeded → recommend a cheaper class or prompt reduction
- stale/missing pricing → explain fallback to cost_class

Safety and privacy postures take precedence over cost: a safety-sensitive prompt is not routed externally just because a cheaper model exists.

## Privacy Model

- Recommendation input can reference scores and safety categories.
- No prompt text required by default.
- No model answers.
- No network.
- No cloud.
- No telemetry.
- No provider API calls.
- No live pricing.
- No benchmark scraping.
- Candidate family list is local metadata only.
- Safety warnings influence routing only through category/severity/confidence.
- No matched secret values.
- No raw prompt text in output.

## Integration Strategy

Future integration points (no integration in the first implementation wave unless a task explicitly says so):

- dashboard score detail can display the recommendation
- CLI report can show a recommendation summary
- rewrite/template system can use the recommendation to decide rewrite intensity
- exports can include recommendation metadata
- importer preview can eventually show a safety-driven "do not send external" warning
- model catalog can later gain manual refresh docs

### Wave 6 Integration Decision

Decision date: 2026-07-04.

Decision: Defer dashboard and CLI integration to a future dedicated pass.

Rationale:

- The core model recommendation feature is complete and verified independently.
- Presentation-layer integration can change user-facing behavior and should be scoped separately.
- Deferring avoids mixing core recommendation logic with dashboard/CLI display work.
- Future integration should reuse the public `recommendModel()` API and should not bypass privacy, safety, or cost-estimator boundaries.

Future integration boundary:

- Dashboard or CLI may display recommendation summaries later.
- Any future display must remain capability-first and vendor-neutral.
- Candidate families must be shown as examples, not provider endorsements.
- `estimated_cost` must be shown as approximate and dated.
- No prompt text, model answers, matched safety values, or banned full-answer fields may be displayed.
- No live provider calls, live pricing calls, benchmark scraping, telemetry, or cloud sync may be added.

## Error Handling

- Content-free errors only (no prompt text in messages).
- Missing score → conservative recommendation.
- Missing catalog → capability-only recommendation (no candidate families).
- Missing pricing → cost-class-only recommendation.
- Missing token estimate → no exact cost estimate.
- Unknown provider/model family → never crashes.
- Stale catalog → surfaced as `known_as_of` metadata, not a runtime failure.

## Testing Strategy

Planned tests (synthetic data only):

- simple prompt score → basic_fast
- balanced prompt → balanced_general
- complex high-quality prompt → frontier_reasoning
- coding prompt → coding_specialist
- long-context need → long_context
- safety critical warning → do_not_send_external / do_not_route_until_redacted
- safety high warning → review_before_routing
- low clarity/context → improve prompt before stronger model
- low-cost preference affects cost posture
- exact token pricing available → approximate estimated cost
- no pricing available → fallback to cost_class
- stale pricing → warning note
- max estimated cost exceeded → cheaper recommendation or cost warning
- catalog filtering for frontier/global
- catalog filtering for China models
- local/open-weight preference
- no prompt text in output
- no banned fields
- no network/fetch
- deterministic output

## Implementation Waves Preview

- Wave 1 — model recommendation data contracts
- Wave 2 — local model catalog seed with frontier/global, China, and token-cost metadata fields
- Wave 3 — deterministic recommendation engine
- Wave 4 — token-cost estimator and cost-aware recommendation rules
- Wave 5 — tests and privacy verification
- Wave 6 — integration decision
- Wave 7 — docs and closeout + backup branch

## Deferred Items

- live provider API calls
- live benchmark scraping
- live pricing refresh
- automatic model invocation
- vendor leaderboard
- national-origin ranking
- affiliate/provider preference
- dashboard UI unless later approved
- exports
- rewrite generation
- cloud sync
- packages
- compliance certification
