/**
 * cookedPrompts — Model Recommendation Module Boundary
 *
 * Public exports for local, vendor-neutral model recommendation contracts.
 * Catalog, recommender, and cost estimator implementations come in later waves.
 */

export type {
  ModelCapabilityClass,
  RecommendedEffort,
  CostSpeedPosture,
  PrivacyPosture,
  SafetyRoutingPosture,
  ModelProviderRegion,
  ModelPricing,
  ModelCatalogEntry,
  TokenEstimateInput,
  UserModelConstraints,
  ModelRecommendationInput,
  ModelCandidateFamily,
  EstimatedModelCost,
  ModelRecommendation,
} from './types.js';

export {
  MODEL_CATALOG_KNOWN_AS_OF,
  LOCAL_MODEL_CATALOG,
  getLocalModelCatalog,
  findModelCatalogEntryById,
} from './model-catalog.js';

export type { ModelRecommenderOptions } from './model-recommender.js';
export { MODEL_RECOMMENDER_VERSION, recommendModel } from './model-recommender.js';

export type { CostEstimatorOptions } from './cost-estimator.js';
export { estimateModelCost } from './cost-estimator.js';
