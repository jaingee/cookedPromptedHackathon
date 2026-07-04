import { describe, it, expect } from 'vitest';
import { estimateModelCost } from '../../src/model-recommendation/index.js';
import type {
  ModelCatalogEntry,
  ModelCandidateFamily,
  ModelPricing,
} from '../../src/model-recommendation/index.js';

/**
 * Synthetic fake catalog entries with obvious fake pricing.
 * These are NOT real provider prices.
 */
function makeFakeEntry(overrides: Partial<ModelCatalogEntry> = {}): ModelCatalogEntry {
  return {
    id: 'fake-entry-1',
    provider: 'FakeProvider',
    model_family: 'Fake Model',
    representative_model_ids: ['fake-model-v1'],
    region_or_origin: 'global',
    access_type: 'hosted_api',
    license_or_distribution: 'proprietary',
    capability_tags: ['balanced_general'],
    modality_tags: ['text'],
    context_window_class: 'long',
    cost_class: 'medium',
    speed_class: 'balanced',
    quality_class: 'strong',
    reasoning_class: 'standard',
    known_as_of: '2026-01-01',
    ...overrides,
  };
}

function makeFakePricing(overrides: Partial<ModelPricing> = {}): ModelPricing {
  return {
    currency: 'USD',
    unit: 'per_1m_tokens',
    input_token_cost: 10.0,
    output_token_cost: 30.0,
    pricing_known_as_of: '2026-01-01',
    pricing_confidence: 'high',
    ...overrides,
  };
}

function makeCandidate(catalogId: string): ModelCandidateFamily {
  return {
    catalog_id: catalogId,
    provider: 'FakeProvider',
    model_family: 'Fake Model',
    representative_model_ids: ['fake-model-v1'],
    reason: 'Test candidate.',
  };
}

describe('Cost Estimator — missing/invalid token estimate', () => {
  it('returns undefined when no token estimate', () => {
    const result = estimateModelCost([makeCandidate('fake-entry-1')], [], undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined when both sides undefined', () => {
    const result = estimateModelCost(
      [makeCandidate('fake-entry-1')],
      [],
      { input_tokens_estimate: undefined, output_tokens_estimate: undefined },
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for negative token estimate', () => {
    const result = estimateModelCost(
      [makeCandidate('fake-entry-1')],
      [],
      { input_tokens_estimate: -100, output_tokens_estimate: undefined },
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for NaN token estimate', () => {
    const result = estimateModelCost(
      [makeCandidate('fake-entry-1')],
      [],
      { input_tokens_estimate: NaN, output_tokens_estimate: undefined },
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for Infinity token estimate', () => {
    const result = estimateModelCost(
      [makeCandidate('fake-entry-1')],
      [],
      { input_tokens_estimate: Infinity, output_tokens_estimate: undefined },
    );
    expect(result).toBeUndefined();
  });
});

describe('Cost Estimator — no candidates + valid tokens', () => {
  it('returns note-only estimate with no min/max', () => {
    const result = estimateModelCost(
      [],
      [],
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );
    expect(result).toBeDefined();
    expect(result!.estimated_min_cost).toBeUndefined();
    expect(result!.estimated_max_cost).toBeUndefined();
    expect(result!.currency).toBe('unknown');
    expect(result!.note.length).toBeGreaterThan(0);
  });
});

describe('Cost Estimator — candidates but no pricing (current catalog)', () => {
  it('returns note-only estimate mentioning cost_class', () => {
    const entry = makeFakeEntry({ id: 'no-price-entry' });
    const candidate = makeCandidate('no-price-entry');
    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );
    expect(result).toBeDefined();
    expect(result!.estimated_min_cost).toBeUndefined();
    expect(result!.estimated_max_cost).toBeUndefined();
    expect(result!.note.toLowerCase()).toMatch(/cost_class|pricing/);
  });
});

describe('Cost Estimator — priced per-1M entry', () => {
  it('calculates input and output cost correctly', () => {
    const pricing = makeFakePricing({
      unit: 'per_1m_tokens',
      input_token_cost: 10.0, // $10 per 1M input
      output_token_cost: 30.0, // $30 per 1M output
    });
    const entry = makeFakeEntry({ id: 'priced-1m', pricing });
    const candidate = makeCandidate('priced-1m');

    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    // input: (1000 / 1_000_000) * 10.0 = 0.01
    // output: (500 / 1_000_000) * 30.0 = 0.015
    // total: 0.025
    expect(result!.estimated_min_cost).toBeCloseTo(0.025, 5);
    expect(result!.estimated_max_cost).toBeCloseTo(0.025, 5);
    expect(result!.currency).toBe('USD');
  });

  it('min equals max when one candidate', () => {
    const pricing = makeFakePricing({ input_token_cost: 5.0, output_token_cost: 15.0 });
    const entry = makeFakeEntry({ id: 'single', pricing });
    const candidate = makeCandidate('single');

    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 2000, output_tokens_estimate: 1000 },
    );

    expect(result).toBeDefined();
    expect(result!.estimated_min_cost).toBe(result!.estimated_max_cost);
  });
});

describe('Cost Estimator — priced per-1K entry', () => {
  it('calculates correctly with per_1k_tokens', () => {
    const pricing = makeFakePricing({
      unit: 'per_1k_tokens',
      input_token_cost: 0.01, // $0.01 per 1K input
      output_token_cost: 0.03, // $0.03 per 1K output
    });
    const entry = makeFakeEntry({ id: 'priced-1k', pricing });
    const candidate = makeCandidate('priced-1k');

    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 5000, output_tokens_estimate: 2000 },
    );

    expect(result).toBeDefined();
    // input: (5000 / 1000) * 0.01 = 0.05
    // output: (2000 / 1000) * 0.03 = 0.06
    // total: 0.11
    expect(result!.estimated_min_cost).toBeCloseTo(0.11, 5);
    expect(result!.estimated_max_cost).toBeCloseTo(0.11, 5);
  });
});

describe('Cost Estimator — input-only pricing', () => {
  it('estimates input side only when output pricing missing', () => {
    const pricing = makeFakePricing({
      input_token_cost: 10.0,
      output_token_cost: undefined,
    });
    const entry = makeFakeEntry({ id: 'input-only', pricing });
    const candidate = makeCandidate('input-only');

    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    // Only input: (1000 / 1_000_000) * 10.0 = 0.01
    expect(result!.estimated_min_cost).toBeCloseTo(0.01, 5);
  });
});

describe('Cost Estimator — output-only pricing', () => {
  it('estimates output side only when input pricing missing', () => {
    const pricing = makeFakePricing({
      input_token_cost: undefined,
      output_token_cost: 30.0,
    });
    const entry = makeFakeEntry({ id: 'output-only', pricing });
    const candidate = makeCandidate('output-only');

    const result = estimateModelCost(
      [candidate],
      [entry],
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    // Only output: (500 / 1_000_000) * 30.0 = 0.015
    expect(result!.estimated_min_cost).toBeCloseTo(0.015, 5);
  });
});

describe('Cost Estimator — multiple priced candidates', () => {
  it('produces a min/max range', () => {
    const cheapPricing = makeFakePricing({ input_token_cost: 2.0, output_token_cost: 6.0 });
    const expensivePricing = makeFakePricing({ input_token_cost: 20.0, output_token_cost: 60.0 });

    const cheapEntry = makeFakeEntry({ id: 'cheap', pricing: cheapPricing });
    const expensiveEntry = makeFakeEntry({ id: 'expensive', pricing: expensivePricing });

    const candidates = [makeCandidate('cheap'), makeCandidate('expensive')];
    const catalog = [cheapEntry, expensiveEntry];

    const result = estimateModelCost(
      candidates,
      catalog,
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    expect(result!.estimated_min_cost).toBeLessThan(result!.estimated_max_cost!);
  });
});

describe('Cost Estimator — mixed currencies', () => {
  it('sets currency to unknown and note mentions no conversion', () => {
    const usdPricing = makeFakePricing({ currency: 'USD', input_token_cost: 10.0, output_token_cost: 30.0 });
    const cnyPricing = makeFakePricing({
      currency: 'CNY',
      input_token_cost: 50.0,
      output_token_cost: 150.0,
      pricing_known_as_of: '2026-01-01',
    });

    const usdEntry = makeFakeEntry({ id: 'usd-entry', pricing: usdPricing });
    const cnyEntry = makeFakeEntry({ id: 'cny-entry', pricing: cnyPricing });

    const candidates = [makeCandidate('usd-entry'), makeCandidate('cny-entry')];
    const catalog = [usdEntry, cnyEntry];

    const result = estimateModelCost(
      candidates,
      catalog,
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    expect(result!.currency).toBe('unknown');
    expect(result!.note.toLowerCase()).toMatch(/currenc/);
  });
});

describe('Cost Estimator — pricing_known_as_of', () => {
  it('selects earliest date', () => {
    const oldPricing = makeFakePricing({ pricing_known_as_of: '2025-01-01', input_token_cost: 5.0, output_token_cost: 15.0 });
    const newPricing = makeFakePricing({ pricing_known_as_of: '2026-06-01', input_token_cost: 10.0, output_token_cost: 30.0 });

    const oldEntry = makeFakeEntry({ id: 'old-entry', pricing: oldPricing });
    const newEntry = makeFakeEntry({ id: 'new-entry', pricing: newPricing });

    const candidates = [makeCandidate('old-entry'), makeCandidate('new-entry')];
    const catalog = [oldEntry, newEntry];

    const result = estimateModelCost(
      candidates,
      catalog,
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );

    expect(result).toBeDefined();
    expect(result!.pricing_known_as_of).toBe('2025-01-01');
  });
});

describe('Cost Estimator — deterministic output', () => {
  it('same inputs produce deep-equal result', () => {
    const pricing = makeFakePricing();
    const entry = makeFakeEntry({ id: 'det-entry', pricing });
    const candidate = makeCandidate('det-entry');
    const tokens = { input_tokens_estimate: 1000, output_tokens_estimate: 500 };

    const result1 = estimateModelCost([candidate], [entry], tokens);
    const result2 = estimateModelCost([candidate], [entry], tokens);
    expect(result1).toEqual(result2);
  });
});
