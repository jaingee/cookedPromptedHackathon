import { describe, it, expect, vi } from 'vitest';
import {
  recommendModel,
  estimateModelCost,
  getLocalModelCatalog,
  findModelCatalogEntryById,
  LOCAL_MODEL_CATALOG,
} from '../../src/model-recommendation/index.js';
import type { ModelRecommendationInput } from '../../src/model-recommendation/index.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult } from '../../src/safety/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';

const SENTINEL = 'FAKE_PROMPT_TEXT_SHOULD_NOT_LEAK';

function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-priv-1',
    prompt_log_id: 'log-priv-1',
    overall_score: 3,
    clarity_score: 3,
    context_score: 3,
    constraints_score: 3,
    output_format_score: 3,
    capability_fit_score: 3,
    efficiency_score: 3,
    safety_privacy_score: 3,
    issue_labels: [],
    explanations: [`Explanation contains ${SENTINEL} for testing.`],
    confidence: 'medium',
    scoring_version: '1.0.0',
    scored_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSafetyResult(overrides: Partial<SafetyScanResult> = {}): SafetyScanResult {
  return {
    warnings: [
      {
        id: 'warn-priv-1',
        category: 'personal_data',
        severity: 'medium',
        confidence: 'high',
        message: `Warning about ${SENTINEL} in prompt.`,
        scanner_version: '1.0.0',
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    highest_severity: 'medium',
    scanner_version: '1.0.0',
    scanned_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Privacy — no prompt text leakage', () => {
  it('sentinel in tags does not leak to recommendation output', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      safety_result: makeSafetyResult(),
      prompt_metadata: {
        tags: [SENTINEL, 'coding'],
        source: SENTINEL,
        provider: SENTINEL,
      },
    };
    const result = recommendModel(input, { now: fixedNow });
    const json = JSON.stringify(result);
    expect(json).not.toContain(SENTINEL);
  });

  it('sentinel in score explanations does not leak to recommendation output', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ explanations: [`${SENTINEL} is a sensitive pattern.`] }),
    };
    const result = recommendModel(input, { now: fixedNow });
    const json = JSON.stringify(result);
    expect(json).not.toContain(SENTINEL);
  });

  it('sentinel in safety warning messages does not leak to recommendation output', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [
          {
            id: 'warn-leak-1',
            category: 'secret_like',
            severity: 'critical',
            confidence: 'high',
            message: `Found ${SENTINEL} in user prompt.`,
            scanner_version: '1.0.0',
            created_at: '2026-07-01T00:00:00.000Z',
          },
        ],
        highest_severity: 'critical',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    const json = JSON.stringify(result);
    expect(json).not.toContain(SENTINEL);
  });
});

describe('Privacy — no banned fields in output', () => {
  const BANNED_FIELDS = [
    'assistant_message',
    'response',
    'completion',
    'model_answer',
    'output_text',
    'generated_text',
  ];

  it('JSON.stringify of recommendation does not contain banned fields', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      safety_result: makeSafetyResult(),
      prompt_metadata: { tags: ['general'] },
      token_estimate: { input_tokens_estimate: 500, output_tokens_estimate: 200 },
    };
    const result = recommendModel(input, { now: fixedNow });
    const json = JSON.stringify(result);

    for (const field of BANNED_FIELDS) {
      expect(json).not.toContain(field);
    }
  });

  it('recursive key collection does not include banned fields', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      safety_result: makeSafetyResult(),
      prompt_metadata: { tags: ['general'] },
      token_estimate: { input_tokens_estimate: 500, output_tokens_estimate: 200 },
    };
    const result = recommendModel(input, { now: fixedNow });

    function collectKeys(obj: unknown, keys: Set<string> = new Set()): Set<string> {
      if (obj === null || obj === undefined) return keys;
      if (typeof obj !== 'object') return keys;
      if (Array.isArray(obj)) {
        for (const item of obj) collectKeys(item, keys);
        return keys;
      }
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        keys.add(key);
        collectKeys(value, keys);
      }
      return keys;
    }

    const allKeys = collectKeys(result);
    for (const field of BANNED_FIELDS) {
      expect(allKeys.has(field)).toBe(false);
    }
  });
});

describe('Privacy — no-network verification', () => {
  it('recommendModel does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const input: ModelRecommendationInput = {
      score: makeScore(),
      safety_result: makeSafetyResult(),
      prompt_metadata: { tags: ['coding'] },
      user_constraints: { prefer_low_cost: true },
      token_estimate: { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    };
    recommendModel(input, { now: fixedNow });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('estimateModelCost does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    estimateModelCost(
      [],
      LOCAL_MODEL_CATALOG,
      { input_tokens_estimate: 1000, output_tokens_estimate: 500 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('getLocalModelCatalog does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    getLocalModelCatalog();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('findModelCatalogEntryById does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    findModelCatalogEntryById('openai-gpt-frontier');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
