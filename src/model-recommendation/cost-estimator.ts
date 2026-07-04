/**
 * cookedPrompts — Local Token Cost Estimator
 *
 * Deterministic, optional cost estimate helpers for model recommendation.
 *
 * Privacy and freshness boundary:
 * - Uses only local catalog metadata and caller-provided token estimates.
 * - No tokenizer.
 * - No prompt text.
 * - No provider API calls.
 * - No live pricing calls.
 * - No benchmark scraping.
 * - Estimates are approximate and dated.
 */

import type {
  EstimatedModelCost,
  ModelCandidateFamily,
  ModelCatalogEntry,
  ModelPricing,
  TokenEstimateInput,
} from './types.js';
import { MODEL_CATALOG_KNOWN_AS_OF } from './model-catalog.js';

/** Options for the cost estimator (injectable for deterministic tests). */
export interface CostEstimatorOptions {
  catalogKnownAsOf?: string;
}

/** Precision for cost rounding (6 decimal places). */
const COST_PRECISION = 6;

// ---------------------------------------------------------------------------
// Token estimate sanitation
// ---------------------------------------------------------------------------

function sanitizeTokenEstimate(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return value;
}

interface SanitizedTokenEstimate {
  input?: number;
  output?: number;
}

function sanitizeTokenInput(
  tokenEstimate: TokenEstimateInput | undefined,
): SanitizedTokenEstimate | undefined {
  if (!tokenEstimate) return undefined;
  const input = sanitizeTokenEstimate(tokenEstimate.input_tokens_estimate);
  const output = sanitizeTokenEstimate(tokenEstimate.output_tokens_estimate);
  if (input === undefined && output === undefined) return undefined;
  return { input, output };
}

// ---------------------------------------------------------------------------
// Per-entry cost calculation
// ---------------------------------------------------------------------------

function tokenDivisor(pricing: ModelPricing): number | undefined {
  switch (pricing.unit) {
    case 'per_1m_tokens':
      return 1_000_000;
    case 'per_1k_tokens':
      return 1_000;
    default:
      return undefined;
  }
}

function estimateEntryCost(
  entry: ModelCatalogEntry,
  tokens: SanitizedTokenEstimate,
): number | undefined {
  const pricing = entry.pricing;
  if (!pricing) return undefined;

  const divisor = tokenDivisor(pricing);
  if (divisor === undefined) return undefined;

  let total = 0;
  let hasSomeSide = false;

  if (tokens.input !== undefined && pricing.input_token_cost !== undefined) {
    total += (tokens.input / divisor) * pricing.input_token_cost;
    hasSomeSide = true;
  }

  if (tokens.output !== undefined && pricing.output_token_cost !== undefined) {
    total += (tokens.output / divisor) * pricing.output_token_cost;
    hasSomeSide = true;
  }

  if (!hasSomeSide) return undefined;
  return Number(total.toFixed(COST_PRECISION));
}

// ---------------------------------------------------------------------------
// Public estimator
// ---------------------------------------------------------------------------

/**
 * Estimate approximate token cost across candidate families using local catalog
 * pricing only. Returns `undefined` if token estimates are not provided.
 * Returns a note-only result if no usable pricing exists in the catalog.
 *
 * Deterministic: same inputs → same output. No network, no live pricing.
 */
export function estimateModelCost(
  candidateFamilies: readonly ModelCandidateFamily[],
  catalog: readonly ModelCatalogEntry[],
  tokenEstimate?: TokenEstimateInput,
  options?: CostEstimatorOptions,
): EstimatedModelCost | undefined {
  const tokens = sanitizeTokenInput(tokenEstimate);
  if (!tokens) return undefined;

  const knownAsOf = options?.catalogKnownAsOf ?? MODEL_CATALOG_KNOWN_AS_OF;

  // No candidates available at all.
  if (candidateFamilies.length === 0) {
    return {
      input_tokens_estimate: tokens.input,
      output_tokens_estimate: tokens.output,
      currency: 'unknown',
      pricing_known_as_of: knownAsOf,
      note:
        'No candidate families were available, so no exact token-cost estimate can be computed.',
    };
  }

  // Match candidates to catalog entries and compute costs.
  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  interface PricedResult {
    cost: number;
    currency: string;
    pricingDate: string;
  }

  const pricedResults: PricedResult[] = [];

  for (const candidate of candidateFamilies) {
    const entry = catalogById.get(candidate.catalog_id);
    if (!entry?.pricing) continue;

    const cost = estimateEntryCost(entry, tokens);
    if (cost === undefined) continue;

    pricedResults.push({
      cost,
      currency: entry.pricing.currency,
      pricingDate: entry.pricing.pricing_known_as_of,
    });
  }

  // No usable pricing found across all candidates.
  if (pricedResults.length === 0) {
    return {
      input_tokens_estimate: tokens.input,
      output_tokens_estimate: tokens.output,
      currency: 'unknown',
      pricing_known_as_of: knownAsOf,
      note:
        'Exact token pricing is unavailable in the local catalog for the selected candidate families. Use broad cost_class only until pricing is source-checked.',
    };
  }

  // Determine currency consistency.
  const currencies = new Set(pricedResults.map((r) => r.currency));
  const mixedCurrency = currencies.size > 1;
  const currency: EstimatedModelCost['currency'] = mixedCurrency
    ? 'unknown'
    : (pricedResults[0].currency as 'USD' | 'CNY' | 'unknown');

  // Min/max range.
  const costs = pricedResults.map((r) => r.cost);
  const minCost = Number(Math.min(...costs).toFixed(COST_PRECISION));
  const maxCost = Number(Math.max(...costs).toFixed(COST_PRECISION));

  // Earliest pricing date (conservative freshness).
  const pricingDates = pricedResults.map((r) => r.pricingDate);
  pricingDates.sort();
  const pricingKnownAsOf = pricingDates[0];

  // Build note.
  let note =
    'Approximate estimate from local dated pricing metadata. Verify provider pricing before spending decisions.';
  if (mixedCurrency) {
    note =
      'Approximate estimate uses local dated pricing metadata, but candidate currencies differ; no currency conversion was performed.';
  }

  return {
    input_tokens_estimate: tokens.input,
    output_tokens_estimate: tokens.output,
    estimated_min_cost: minCost,
    estimated_max_cost: maxCost,
    currency,
    pricing_known_as_of: pricingKnownAsOf,
    note,
  };
}
