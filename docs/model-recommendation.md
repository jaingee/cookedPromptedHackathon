# Model Recommendation

## Purpose
Model recommendation helps choose a capability class and effort level for a prompt. It is local-first, deterministic, vendor-neutral, and capability-first. It uses prompt scores, value-free safety results, metadata, user constraints, local catalog entries, and optional token estimates. It does not call providers or external services.

## What Is Included
Source files:
- `src/model-recommendation/types.ts` — Data contracts
- `src/model-recommendation/model-catalog.ts` — Local seed catalog (29 entries)
- `src/model-recommendation/model-recommender.ts` — Deterministic recommendation engine
- `src/model-recommendation/cost-estimator.ts` — Optional token cost estimator
- `src/model-recommendation/index.ts` — Module boundary

Tests:
- `tests/model-recommendation/model-recommender.test.ts` — Behavior and safety routing tests
- `tests/model-recommendation/model-catalog.test.ts` — Catalog coverage tests
- `tests/model-recommendation/cost-estimator.test.ts` — Cost estimator edge case tests
- `tests/model-recommendation/model-recommendation-privacy.test.ts` — Privacy and no-network tests

## Public API
Types: ModelCapabilityClass, RecommendedEffort, CostSpeedPosture, PrivacyPosture, SafetyRoutingPosture, ModelProviderRegion, ModelPricing, ModelCatalogEntry, TokenEstimateInput, UserModelConstraints, ModelRecommendationInput, ModelCandidateFamily, EstimatedModelCost, ModelRecommendation, ModelRecommenderOptions, CostEstimatorOptions.

Values/functions: MODEL_CATALOG_KNOWN_AS_OF, LOCAL_MODEL_CATALOG, getLocalModelCatalog, findModelCatalogEntryById, MODEL_RECOMMENDER_VERSION, recommendModel, estimateModelCost.

## Data Contracts
- Recommendation input uses `PromptScore` and `SafetyScanResult` (not `unknown`).
- No `prompt_text` field. No full model answer fields.
- Safety result is value-free (categories/severity/counts only).
- Output is capability-first. `estimated_cost` is optional.

## Local Model Catalog
- Static local seed catalog with 29 entries.
- Coverage: frontier/global (OpenAI, Anthropic, Google, xAI, Meta, Mistral, Cohere), China (Alibaba, DeepSeek, Moonshot, Zhipu, MiniMax, Baidu, Tencent, ByteDance, StepFun, SenseTime), open-weight (Meta Llama, Qwen, Yi, Baichuan).
- Every entry has `known_as_of` and `source_notes`.
- No exact pricing blocks in current seed. Entries rely on broad `cost_class`.
- Entries represent model families, not guaranteed live availability.
- Representative model IDs are examples only.
- Region/origin is metadata for filtering/user choice, not a ranking signal.

## Deterministic Recommender
- `recommendModel(input, options?)` with optional injectable `now` and `catalog`.
- Priority-ordered class selection: do_not_send_external → local_or_open_weight → safety_sensitive → search_grounded → coding_specialist → long_context → multimodal → frontier_reasoning → high_quality → basic_fast → balanced_general.
- Effort, cost/speed posture, privacy posture, safety posture each follow deterministic rules.
- Safety/privacy postures override cost.
- Candidate families selected from catalog by capability match, user constraints, and stable sort (max 5).
- Never reads prompt text.

## Token Cost Estimator
- `estimateModelCost(candidateFamilies, catalog, tokenEstimate?, options?)`.
- Uses caller-provided token estimates only. No tokenizer. No live pricing. No provider calls. No exchange-rate calls.
- Returns `undefined` when token estimate missing.
- Returns note-only estimate when pricing missing in catalog.
- Returns approximate min/max only when local catalog pricing exists.
- Uses `pricing_known_as_of`. Never produces fake prices.

## Privacy and Safety Boundaries
- No prompt text in recommendation output.
- No model answers. No matched safety values. No banned full-answer fields.
- No network. No provider calls. No live pricing calls. No benchmark scraping. No telemetry. No cloud sync.
- Safety/privacy postures override cost. No national-origin ranking.
- Banned fields: assistant_message, response, completion, model_answer, output_text, generated_text.

## Vendor-Neutral and Capability-First Behavior
- Recommendation starts with capability class, not provider.
- Candidate families are optional examples, not provider endorsements.
- No national-origin ranking. China/global/open-weight metadata is for filtering and user constraints only.

## Candidate Family Semantics
- Selected from local catalog. Max 5, stable/deterministic ordering.
- Candidate reasons are value-free. Not guaranteed available. Verify before production routing.

## Token Cost Semantics
- Cost is approximate and optional. Current seed catalog relies on `cost_class`.
- Exact estimates require local pricing metadata. No live pricing. No currency conversion.
- Mixed currencies return `currency: 'unknown'`.
- Pricing must be source-checked before adding to catalog.

## Integration Decision
- Dashboard/CLI integration deferred (Wave 6 decision).
- Future integration should use `recommendModel()`.
- Display must remain capability-first and vendor-neutral.
- Show candidate families as examples. Show estimated cost as approximate and dated.
- Never display prompt text, model answers, matched safety values, or banned fields.
- No provider/live-pricing/scraping/telemetry/cloud sync.

## Testing and Verification
- 31 test files, 483 tests (baseline after Wave 5/6).
- Behavior tests, catalog coverage, China/global/open-weight coverage, cost estimator, missing-pricing fallback, safety-driven routing, no prompt text leakage, banned field tests, no-network tests, deterministic tests.

## Non-Goals
- No provider API calls. No automatic model invocation. No live pricing refresh. No benchmark scraping. No vendor leaderboard. No national-origin ranking. No dashboard/CLI integration in this spec. No exports. No rewrite/template integration. No importer integration. No storage persistence. No migrations. No packages. No compliance certification.

## Maintenance Notes
- Update `MODEL_CATALOG_KNOWN_AS_OF` when refreshing catalog.
- Only add pricing when source-checked. Every pricing block must include `pricing_known_as_of`.
- Representative IDs should be verified before production routing.
- Keep catalog family-based, not exhaustive model-version tracking.
- Update tests if catalog coverage changes intentionally.
- Maintain no-network/no-leak tests.

## Future Work
- Dashboard recommendation display.
- CLI recommendation summary.
- Catalog refresh with source-checked pricing.
- Export metadata integration.
- Rewrite/template routing advice.
- Importer preview safety/recommendation warning.
- Optional storage/persistence only if a future spec approves.
