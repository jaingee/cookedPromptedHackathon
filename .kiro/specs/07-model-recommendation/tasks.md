# 07-model-recommendation Tasks

## Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.

## Global Guardrails

Apply to every wave:

- local-first
- no network/provider calls
- no live pricing calls
- no benchmark scraping
- no telemetry
- no LLM judge
- no prompt text in output by default
- no matched safety values
- no full model answer fields
- vendor-neutral default
- capability-first recommendations
- no national-origin ranking
- no packages
- exact pricing optional and dated (pricing_known_as_of)
- cost is one signal, not the only signal

## Wave 1 — Recommendation Data Contracts

Likely files: `src/model-recommendation/types.ts`, `src/model-recommendation/index.ts`.

- [x] 1.1 Define capability classes (`ModelCapabilityClass`).
- [x] 1.2 Define effort/cost/privacy/safety postures (`RecommendedEffort`, `CostSpeedPosture`, `PrivacyPosture`, `SafetyRoutingPosture`).
- [x] 1.3 Define `ModelProviderRegion` and pricing type (`ModelPricing`).
- [x] 1.4 Define catalog entry type (`ModelCatalogEntry`).
- [x] 1.5 Define token estimate input type (`TokenEstimateInput`) and `UserModelConstraints`.
- [x] 1.6 Define recommendation input/output types (`ModelRecommendationInput`, `ModelCandidateFamily`, `EstimatedModelCost`, `ModelRecommendation`). Uses `PromptScore` and `SafetyScanResult` (not `unknown`).
- [x] 1.7 Establish module boundary (`index.ts` barrel), type-only exports with `.js` ESM specifiers.

Acceptance: types compile; no prompt text or model answer fields in any output contract; typecheck + existing test baseline unchanged.

## Wave 2 — Local Model Catalog Seed

Likely files: `src/model-recommendation/model-catalog.ts`.

- [x] 2.1 Create the local catalog structure.
- [x] 2.2 Include frontier/global families (per design seed table).
- [x] 2.3 Include China model families (per design seed table).
- [x] 2.4 Include open-weight families.
- [x] 2.5 Include `known_as_of` on every entry.
- [x] 2.6 Include capability/modality/cost/speed/reasoning tags.
- [x] 2.7 Include optional pricing metadata fields (with `pricing_known_as_of` when present). Type supports pricing; seed entries rely on `cost_class` and omit unverified exact pricing.
- [x] 2.8 Do not require exact prices for every entry.

Guardrails: catalog is seed data, not a guarantee of exhaustive current availability forever; source notes should be brief and value-free; pricing data must include `pricing_known_as_of` if present; no network; no live pricing.

Acceptance: catalog loads statically; entries cover frontier/global + China + open-weight; missing pricing is allowed; typecheck + existing test baseline unchanged.

## Wave 3 — Deterministic Recommendation Engine

Likely files: `src/model-recommendation/model-recommender.ts`, `src/model-recommendation/index.ts`.

- [x] 3.1 Implement deterministic rules per design.
- [x] 3.2 Use score and safety signals.
- [x] 3.3 Select capability class.
- [x] 3.4 Select effort level.
- [x] 3.5 Select cost/speed/privacy/safety posture.
- [x] 3.6 Select candidate families from the local catalog (filtered by user constraints).
- [x] 3.7 Produce a plain-language explanation.

Guardrails: no prompt text leakage; no exact cost calculation yet (Wave 4 owns cost); deterministic output.

Acceptance: same input → same output; safety/privacy postures override cost; typecheck + existing test baseline unchanged.

## Wave 4 — Token Cost Estimator

Likely files: `src/model-recommendation/cost-estimator.ts`, `src/model-recommendation/model-recommender.ts`, `src/model-recommendation/index.ts`.

- [x] 4.1 Implement an optional cost estimator using local catalog pricing.
- [x] 4.2 Support input/output token estimates separately.
- [x] 4.3 Support estimated cost range across candidate families.
- [x] 4.4 Fall back to `cost_class` when pricing is missing.
- [x] 4.5 Include `pricing_known_as_of` in estimates.
- [x] 4.6 Include stale/missing pricing notes.

Guardrails: no live pricing calls; no provider API calls; approximate only; never choose a model solely because it is cheapest.

Acceptance: estimate produced only when pricing + token estimates exist; otherwise cost-class fallback with note; typecheck + existing test baseline unchanged.

## Wave 5 — Tests and Privacy Verification

Likely files: `tests/model-recommendation/model-recommender.test.ts`, `tests/model-recommendation/model-catalog.test.ts`, `tests/model-recommendation/cost-estimator.test.ts`, `tests/model-recommendation/model-recommendation-privacy.test.ts`.

- [x] 5.1 Behavior tests (class selection per rule table).
- [x] 5.2 Catalog coverage tests.
- [x] 5.3 China model coverage tests.
- [x] 5.4 Frontier/global model coverage tests.
- [x] 5.5 Token-cost estimator tests.
- [x] 5.6 Stale/missing pricing fallback tests.
- [x] 5.7 Safety-driven routing tests.
- [x] 5.8 No prompt text leakage tests.
- [x] 5.9 No banned field tests.
- [x] 5.10 No-network tests.
- [x] 5.11 Deterministic output tests.

Guardrails: synthetic data only; no real prompts/secrets/model answers.

Acceptance: all new tests pass; privacy/no-network guarantees verified; existing baseline still green.

## Wave 6 — Integration Decision

Decision-first wave.

- [x] 6.1 Decide whether dashboard or CLI integration belongs inside this spec or later. Decision: defer to a future dedicated pass.
- [x] 6.2 Record the decision in design.md and HANDOFF/CHANGELOG.

Default recommendation: defer UI/CLI integration unless very small and clearly bounded; complete the core recommendation engine first.

## Wave 7 — Docs and Closeout

Likely files: `docs/model-recommendation.md`.

- [x] 7.1 Write feature docs.
- [x] 7.2 Update HANDOFF/CHANGELOG.
- [x] 7.3 Mark spec complete.
- [x] 7.4 Create backup branch `backup/after-07-model-recommendation-complete`.

## Deferred / Out of Scope

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
