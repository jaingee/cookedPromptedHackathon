import { describe, it, expect } from 'vitest';
import {
  LOCAL_MODEL_CATALOG,
  MODEL_CATALOG_KNOWN_AS_OF,
  getLocalModelCatalog,
  findModelCatalogEntryById,
} from '../../src/model-recommendation/index.js';
import type { ModelCatalogEntry } from '../../src/model-recommendation/index.js';

describe('Model Catalog — basic structure', () => {
  it('catalog is non-empty', () => {
    expect(LOCAL_MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it('MODEL_CATALOG_KNOWN_AS_OF matches YYYY-MM-DD format', () => {
    expect(MODEL_CATALOG_KNOWN_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every entry has all required fields', () => {
    for (const entry of LOCAL_MODEL_CATALOG) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);

      expect(typeof entry.provider).toBe('string');
      expect(entry.provider.length).toBeGreaterThan(0);

      expect(typeof entry.model_family).toBe('string');
      expect(entry.model_family.length).toBeGreaterThan(0);

      expect(Array.isArray(entry.representative_model_ids)).toBe(true);
      expect(entry.representative_model_ids.length).toBeGreaterThan(0);

      expect(typeof entry.region_or_origin).toBe('string');
      expect(typeof entry.access_type).toBe('string');
      expect(typeof entry.license_or_distribution).toBe('string');

      expect(Array.isArray(entry.capability_tags)).toBe(true);
      expect(entry.capability_tags.length).toBeGreaterThan(0);

      expect(Array.isArray(entry.modality_tags)).toBe(true);
      expect(entry.modality_tags.length).toBeGreaterThan(0);

      expect(typeof entry.context_window_class).toBe('string');
      expect(typeof entry.cost_class).toBe('string');
      expect(typeof entry.speed_class).toBe('string');
      expect(typeof entry.quality_class).toBe('string');
      expect(typeof entry.reasoning_class).toBe('string');

      expect(typeof entry.known_as_of).toBe('string');
      expect(entry.known_as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('all IDs are unique', () => {
    const ids = LOCAL_MODEL_CATALOG.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Model Catalog — accessor functions', () => {
  it('getLocalModelCatalog() returns the catalog', () => {
    const catalog = getLocalModelCatalog();
    expect(catalog).toBe(LOCAL_MODEL_CATALOG);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('findModelCatalogEntryById() finds a known ID', () => {
    const entry = findModelCatalogEntryById('openai-gpt-frontier');
    expect(entry).toBeDefined();
    expect(entry!.provider).toBe('OpenAI');
  });

  it('findModelCatalogEntryById() returns undefined for unknown ID', () => {
    const entry = findModelCatalogEntryById('nonexistent-model-xyz');
    expect(entry).toBeUndefined();
  });
});

describe('Model Catalog — China coverage', () => {
  const chinaEntries = LOCAL_MODEL_CATALOG.filter(
    (e) => e.region_or_origin === 'china',
  );

  it('entries with region china exist', () => {
    expect(chinaEntries.length).toBeGreaterThan(0);
  });

  const chinaProviders = new Set(chinaEntries.map((e) => e.provider));

  it.each([
    'Alibaba',
    'DeepSeek',
    'Moonshot AI',
    'Zhipu AI',
    'MiniMax',
    'Baidu',
    'Tencent',
    'ByteDance',
    'StepFun',
    'SenseTime',
  ])('includes China provider: %s', (provider) => {
    expect(chinaProviders.has(provider)).toBe(true);
  });
});

describe('Model Catalog — frontier/global coverage', () => {
  const globalEntries = LOCAL_MODEL_CATALOG.filter(
    (e) => e.region_or_origin === 'global' || e.region_or_origin === 'eu',
  );
  const globalProviders = new Set(globalEntries.map((e) => e.provider));

  it.each([
    'OpenAI',
    'Anthropic',
    'Google',
    'xAI',
    'Mistral AI',
    'Cohere',
  ])('includes frontier/global provider: %s', (provider) => {
    expect(globalProviders.has(provider)).toBe(true);
  });

  it('includes Meta via open-weight', () => {
    const metaEntry = LOCAL_MODEL_CATALOG.find((e) => e.provider === 'Meta');
    expect(metaEntry).toBeDefined();
  });
});

describe('Model Catalog — open-weight coverage', () => {
  const openWeightEntries = LOCAL_MODEL_CATALOG.filter(
    (e) => e.access_type === 'open_weight',
  );

  it('entries with access_type open_weight exist', () => {
    expect(openWeightEntries.length).toBeGreaterThan(0);
  });

  it('includes Meta Llama', () => {
    const llama = openWeightEntries.find((e) => e.model_family.toLowerCase().includes('llama'));
    expect(llama).toBeDefined();
  });

  it('includes Qwen (open weight)', () => {
    const qwen = openWeightEntries.find((e) => e.model_family.toLowerCase().includes('qwen'));
    expect(qwen).toBeDefined();
  });

  it('includes Yi', () => {
    const yi = openWeightEntries.find((e) => e.model_family.toLowerCase().includes('yi'));
    expect(yi).toBeDefined();
  });

  it('includes Baichuan', () => {
    const baichuan = openWeightEntries.find((e) => e.model_family.toLowerCase().includes('baichuan'));
    expect(baichuan).toBeDefined();
  });
});
