# 07-model-recommendation Requirements

## Status

- Requirements: Drafted.
- Design: Drafted.
- Tasks: Drafted.
- Implementation: Not started.
- Tests: Not started.

## Purpose

07-model-recommendation defines a local-only, deterministic recommendation engine for cookedPrompts. It uses existing prompt score data, optional safety scan signals, task shape, token-cost posture, and optional user constraints to produce vendor-neutral guidance about which kind of model a prompt should be routed to.

The recommendation is capability-first, not vendor-first. The default output recommends a capability class, a reasoning/effort level, a cost/speed posture, a privacy posture, and a safety posture, with a plain-language explanation. It may optionally list matching model families from a local catalog and may optionally estimate approximate token cost only when local catalog pricing metadata exists.

The engine runs entirely locally. It never calls model providers, never fetches live pricing, never scrapes benchmarks, and never sends prompt text anywhere. It supports both frontier/global and China model families as catalog metadata for user choice, compliance, availability, and deployment planning, without ranking by national origin and without endorsing any provider.

## User Stories

- As a user, I want to know whether my prompt needs a frontier model or a cheaper fast model, so I do not overpay or underpower.
- As a user, I want a recommendation that explains the reasoning in plain language, so I understand why a class was chosen.
- As a privacy-conscious user, I want recommendations to run locally without sending my prompt anywhere, so my prompt stays private.
- As a user comparing global and China models, I want the local catalog to include frontier and China model families, so I can consider options across regions.
- As a user, I want the default recommendation to be capability class first, not vendor first, so I am not pushed toward a specific provider.
- As a user, I want token cost considered before choosing an expensive model, so I balance quality and cost.
- As a user, I want a warning if my prompt should be fixed before using an expensive model, so I improve the prompt instead of spending more.
- As a user, I want safety warnings to affect recommendations, so risky prompts are not routed externally by default.
- As a developer, I want the model catalog to be maintainable as model names and pricing change, so the feature does not go stale silently.
- As a developer, I want pricing fields to be optional, so the recommender still works when exact pricing is unknown.

## Functional Requirements

### FR-1: Recommendation input

The recommender SHALL accept an input object that may include:

- prompt score (optional)
- safety scan result (optional)
- prompt metadata (optional): source, provider, model_used, tags
- user constraints (optional)
- catalog selection (optional; defaults to the local seed catalog)
- token estimate (optional): input/output token estimates

The recommender SHALL NOT accept full model answer fields. The recommender SHALL produce a usable result even when only minimal input is provided.

### FR-2: Recommendation output

The recommender SHALL return an output object that includes:

- recommended capability class
- recommended reasoning/effort level
- cost/speed posture
- privacy posture
- safety posture
- plain-language explanation
- optional candidate model family list
- optional estimated cost range
- confidence
- created timestamp
- recommender version

### FR-3: Capability classes

The recommender SHALL select from these capability classes:

- basic_fast
- balanced_general
- high_quality
- frontier_reasoning
- coding_specialist
- long_context
- multimodal
- local_or_open_weight
- search_grounded
- safety_sensitive
- do_not_send_external

### FR-4: Reasoning/effort levels

The recommender SHALL select from these effort levels:

- low
- medium
- high
- xhigh

### FR-5: Cost/speed posture

The recommender SHALL select from these cost/speed postures:

- minimize_cost
- balanced
- prioritize_quality
- prioritize_speed

### FR-6: Privacy posture

The recommender SHALL select from these privacy postures:

- local_only_recommended
- external_ok_after_review
- external_not_recommended

### FR-7: Safety posture

The recommender SHALL select from these safety postures:

- safe_to_route
- review_before_routing
- do_not_route_until_redacted

### FR-8: Candidate model families

Candidate model families are OPTIONAL output. When produced, they:

- SHALL be sourced from the local catalog only
- SHALL be marked as candidate examples, not guaranteed availability
- SHALL include a known-as-of date
- SHALL NOT imply provider endorsement

### FR-9: Token cost output

Token cost is OPTIONAL output. When produced, it:

- SHALL be based on local catalog pricing only
- SHALL NOT trigger live pricing calls
- SHALL NOT scrape pricing or benchmarks
- SHALL be presented as approximate only
- SHALL include pricing-known-as-of when exact pricing is used

### FR-10: Local-only behavior

The recommender SHALL operate with:

- no network
- no cloud
- no live pricing calls
- no provider API calls
- no benchmark scraping
- no telemetry
- no LLM judge

### FR-11: Future integration points (architecture-ready only)

The design SHALL keep the following as future/architecture-ready integration points, not implemented in this spec unless explicitly scoped into an implementation wave:

- dashboard detail display
- CLI report section
- rewrite/template routing advice
- export metadata
- importer preview warning
- model catalog refresh workflow

## Model Catalog Requirements

### MC-1: Local catalog

The feature SHALL define a local model catalog. Catalog entries SHALL support:

- provider
- model_family
- representative_model_ids
- region_or_origin
- access_type
- license_or_distribution
- capability_tags
- modality_tags
- context_window_class
- cost_class
- speed_class
- quality_class
- reasoning_class
- privacy_notes
- safety_notes
- availability_notes
- known_as_of
- source_notes
- optional pricing metadata

### MC-2: Catalog boundaries

The catalog:

- SHALL NOT require live pricing
- SHALL NOT claim exact prices unless source-checked during a later refresh
- SHALL NOT require exhaustive permanent coverage
- SHALL use known_as_of and source_notes to date its contents

### MC-3: Catalog entry rules

- Entries represent model families, not every individual model version.
- Representative model IDs are examples only.
- Deprecated or restricted families SHALL be marked with availability notes.
- Regional/provider origin is metadata, not a ranking signal.
- China/global/open-weight coverage SHALL be broad enough to support user choice.
- The recommendation engine SHALL still work if catalog entries are missing, stale, or unknown.

## Token Cost Requirements

The model catalog SHALL support optional token-cost metadata, but V1 SHALL NOT depend on live pricing calls.

### TC-1: Optional pricing shape

Catalog entries MAY optionally support:

```ts
pricing?: {
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
};
```

### TC-2: Token-cost design rules

- SHALL NOT make live pricing calls.
- SHALL NOT scrape pricing pages.
- SHALL NOT call provider APIs.
- SHALL NOT claim pricing is current unless source-checked during a catalog refresh.
- SHALL use pricing_known_as_of for all token price data.
- IF exact token pricing is missing or stale, THEN the recommender SHALL fall back to cost_class.
- Pricing SHALL remain optional so the recommendation engine still works without exact prices.
- Input-token and output-token pricing SHALL be supported separately because output tokens often cost more.
- Cached-input pricing SHALL be supported only when documented.
- Reasoning-token pricing SHALL be supported only when documented.
- Non-text costs (image/audio) SHALL be supported only as optional future-compatible fields.
- The recommender SHALL NOT compare models only by price.
- The recommender SHALL combine cost with task complexity, safety posture, quality need, context need, modality need, and user constraints.

## Recommendation Requirements

The recommender SHALL apply deterministic rules such as:

- IF prompt score is low AND ambiguity is high, THEN recommend prompt improvement before a stronger model.
- IF a safety warning is critical, THEN set do_not_send_external / do_not_route_until_redacted.
- IF a safety warning is high, THEN set review_before_routing.
- IF context need is high, THEN prefer long_context.
- IF the task is coding/debugging, THEN prefer coding_specialist or frontier_reasoning.
- IF the prompt makes factual/current claims, THEN prefer search_grounded or require citations.
- IF the task is a simple rewrite/formatting, THEN prefer basic_fast or balanced_general.
- IF the task is high-stakes legal/medical/financial, THEN set safety_sensitive and require sources/citations.
- IF the prompt needs multimodal input, THEN prefer multimodal.
- IF the prompt is privacy-sensitive, THEN prefer local_or_open_weight or do_not_send_external.
- Simple, low-risk prompts SHOULD prefer lower-cost or faster model classes.
- Complex/high-stakes prompts MAY justify higher-cost frontier reasoning.
- Low prompt quality SHOULD recommend improving the prompt before spending on a stronger model.
- Safety-sensitive prompts SHALL NOT be routed externally just because a cheaper model is available.
- IF token cost data is stale or missing, THEN say so and fall back to cost class.
- The system SHALL explain the recommendation in plain language.

### Token Cost Recommendation Requirements

The recommender SHALL consider cost in two layers:

1. Cost class fallback: low | medium | high | unknown.
2. Optional token-cost estimate:
   - only when local catalog pricing exists
   - using input/output token costs separately
   - shown as approximate
   - including pricing_known_as_of
   - never calling provider APIs for live pricing

The recommendation output MAY include:

```ts
estimated_cost?: {
  input_tokens_estimate?: number;
  output_tokens_estimate?: number;
  estimated_min_cost?: number;
  estimated_max_cost?: number;
  currency: 'USD' | 'CNY' | 'unknown';
  pricing_known_as_of: string;
  note: string;
};
```

Token estimate behavior:

- IF the input/output token estimate is missing, THEN return no exact estimate.
- IF exact model pricing is missing, THEN return no exact estimate.
- IF pricing is stale, THEN include a caution note.
- IF multiple candidate families match, THEN estimated cost MAY be a range.
- The recommender SHALL NOT output exact cost as guaranteed.
- The recommender SHALL NOT choose a model solely because it is cheapest.

## Privacy Requirements

The recommender SHALL enforce:

- no prompt text in recommendation output by default
- no model answer fields
- no provider calls
- no live pricing calls
- no benchmark scraping
- no cloud sync
- no telemetry
- no matched secrets
- no raw safety warning values
- recommendation MAY use categories/severity/counts from a safety scan
- tests SHALL use synthetic data only

## Non-Goals

- no live model API calls
- no automatic model invocation
- no benchmark scraping
- no live pricing refresh
- no provider ranking leaderboard
- no affiliate/provider preference
- no national-origin ranking
- no dashboard UI in this planning pass
- no exports
- no rewrite generation
- no importer integration
- no compliance/legal certification
- no package additions

## Acceptance Criteria

For the spec-planning pass:

- requirements/design/tasks created
- frontier/global and China model catalog coverage is planned
- token-cost metadata and approximate-cost design are planned
- recommendation output is capability-first
- privacy boundaries are clear
- implementation waves are small and reviewable
- HANDOFF/CHANGELOG updated
- typecheck/test baseline remains unchanged

## Open Questions

- OQ-1: Should candidate family filtering default to region-neutral (all regions) or respect an explicit user allow/deny list only? Working assumption: region-neutral by default; user constraints narrow the set.
- OQ-2: Which currency should estimated cost prefer when both USD and CNY pricing exist for matched families? Working assumption: honor user_constraints.preferred_currency, else USD, else 'unknown'.
- OQ-3: How stale is "stale" for pricing_known_as_of before the recommender attaches a caution note? Working assumption: define a configurable freshness threshold in design; do not hardcode a provider-specific value.
- OQ-4: Should the recommender surface more than one recommended class (primary + alternate) or a single class in V1? Working assumption: single primary class in V1, with candidate families as the breadth signal.
- OQ-5: Should confidence be derived from score confidence, catalog completeness, or both? Working assumption: both, combined conservatively (lowest wins).
