/**
 * cookedPrompts — Model Recommendation Data Contracts
 *
 * Local-first, deterministic, vendor-neutral recommendation contracts.
 *
 * Privacy boundary:
 * - Recommendation input may reference prompt scores and value-free safety results.
 * - Recommendation output must not contain prompt text, model answers,
 *   matched safety values, live provider data, or scraped pricing.
 * - Model catalog and pricing metadata are local, optional, and dated.
 */

import type { PromptScore } from '../scoring/types.js';
import type { SafetyScanResult } from '../safety/types.js';

/**
 * Vendor-neutral, capability-first model classes.
 * No provider names, no model-family names, no national-origin classes.
 */
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

/** Recommended reasoning/effort level. */
export type RecommendedEffort = 'low' | 'medium' | 'high' | 'xhigh';

/** Cost/speed posture — a stance, not an exact price. */
export type CostSpeedPosture =
  | 'minimize_cost'
  | 'balanced'
  | 'prioritize_quality'
  | 'prioritize_speed';

/** Privacy posture for routing guidance. */
export type PrivacyPosture =
  | 'local_only_recommended'
  | 'external_ok_after_review'
  | 'external_not_recommended';

/** Safety routing posture derived from value-free safety signals. */
export type SafetyRoutingPosture =
  | 'safe_to_route'
  | 'review_before_routing'
  | 'do_not_route_until_redacted';

/**
 * Region/origin metadata for filtering, user choice, compliance, and
 * deployment planning. This is NOT a national-origin ranking signal.
 */
export type ModelProviderRegion =
  | 'global'
  | 'us'
  | 'eu'
  | 'china'
  | 'open_weight'
  | 'unknown';

/**
 * Optional, dated pricing metadata for a catalog entry.
 * Local metadata only — never implies live pricing calls or scraping.
 */
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

/**
 * A single local model-family catalog entry.
 * Represents a model family, not an individual model version.
 * Seed data only — not a guarantee of exhaustive current availability.
 */
export interface ModelCatalogEntry {
  id: string;
  provider: string;
  model_family: string;
  representative_model_ids: string[];
  region_or_origin: ModelProviderRegion;
  access_type: 'hosted_api' | 'chat_app' | 'open_weight' | 'restricted' | 'unknown';
  license_or_distribution: 'proprietary' | 'open_weight' | 'open_source' | 'restricted' | 'unknown';
  capability_tags: ModelCapabilityClass[];
  modality_tags: Array<
    | 'text'
    | 'vision'
    | 'audio'
    | 'video'
    | 'image_generation'
    | 'code'
    | 'search'
  >;
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

/**
 * Optional token estimate provided by the caller.
 * No tokenizer or token-counting implementation lives in this module.
 */
export interface TokenEstimateInput {
  input_tokens_estimate?: number;
  output_tokens_estimate?: number;
}

/** Optional user preferences that narrow recommendation and candidate filtering. */
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

/**
 * Input to the recommendation engine.
 *
 * PRIVACY: must not include prompt_text or any full model answer field.
 * Uses scored output (PromptScore) and value-free safety results
 * (SafetyScanResult) instead of raw prompt content.
 */
export interface ModelRecommendationInput {
  score?: PromptScore;
  safety_result?: SafetyScanResult;
  prompt_metadata?: {
    source?: string;
    provider?: string;
    model_used?: string;
    tags?: string[];
  };
  user_constraints?: UserModelConstraints;
  token_estimate?: TokenEstimateInput;
}

/**
 * An optional candidate model family drawn from the local catalog.
 * Candidate examples only — not a guarantee of access or availability,
 * and not a provider endorsement.
 */
export interface ModelCandidateFamily {
  catalog_id: string;
  provider: string;
  model_family: string;
  representative_model_ids: string[];
  reason: string;
  pricing_known_as_of?: string;
}

/**
 * Optional approximate cost estimate.
 * Approximate only, dated via pricing_known_as_of, never from live pricing.
 */
export interface EstimatedModelCost {
  input_tokens_estimate?: number;
  output_tokens_estimate?: number;
  estimated_min_cost?: number;
  estimated_max_cost?: number;
  currency: 'USD' | 'CNY' | 'unknown';
  pricing_known_as_of: string;
  note: string;
}

/**
 * The public recommendation output.
 *
 * Capability-first. Contains no prompt text, no model answers, no matched
 * safety values, no live provider data, and no banned full-answer fields.
 */
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
