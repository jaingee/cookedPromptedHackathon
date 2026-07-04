import { describe, it, expect } from 'vitest';
import { recommendModel, MODEL_RECOMMENDER_VERSION } from '../../src/model-recommendation/index.js';
import type { ModelRecommendationInput } from '../../src/model-recommendation/index.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult, SafetyWarning } from '../../src/safety/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';

function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-1',
    prompt_log_id: 'log-1',
    overall_score: 4,
    clarity_score: 4,
    context_score: 4,
    constraints_score: 4,
    output_format_score: 4,
    capability_fit_score: 4,
    efficiency_score: 4,
    safety_privacy_score: 4,
    issue_labels: [],
    explanations: ['Solid prompt.'],
    confidence: 'high',
    scoring_version: '1.0.0',
    scored_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWarning(overrides: Partial<SafetyWarning> = {}): SafetyWarning {
  return {
    id: 'warn-1',
    category: 'secret_like',
    severity: 'critical',
    confidence: 'high',
    message: 'Detected a secret-like pattern.',
    scanner_version: '1.0.0',
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSafetyResult(overrides: Partial<SafetyScanResult> = {}): SafetyScanResult {
  return {
    warnings: [],
    highest_severity: null,
    scanner_version: '1.0.0',
    scanned_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Model Recommender — exports', () => {
  it('exports recommendModel function', () => {
    expect(typeof recommendModel).toBe('function');
  });

  it('exports MODEL_RECOMMENDER_VERSION string', () => {
    expect(typeof MODEL_RECOMMENDER_VERSION).toBe('string');
    expect(MODEL_RECOMMENDER_VERSION.length).toBeGreaterThan(0);
  });
});

describe('Model Recommender — default/no inputs', () => {
  it('returns balanced_general with low confidence when no inputs', () => {
    const result = recommendModel({}, { now: fixedNow });
    expect(result.recommended_class).toBe('balanced_general');
    expect(result.confidence).toBe('low');
    expect(result.created_at).toBe('2026-07-04T00:00:00.000Z');
    expect(result.recommender_version).toBe(MODEL_RECOMMENDER_VERSION);
  });

  it('does not include estimated_cost when no token estimate', () => {
    const result = recommendModel({}, { now: fixedNow });
    expect(result.estimated_cost).toBeUndefined();
  });

  it('produces a deterministic timestamp from injectable now', () => {
    const result = recommendModel({}, { now: fixedNow });
    expect(result.created_at).toBe('2026-07-04T00:00:00.000Z');
  });
});

describe('Model Recommender — balanced_general (good normal score)', () => {
  it('recommends balanced_general for a good normal score', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ overall_score: 4 }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('balanced_general');
  });
});

describe('Model Recommender — basic_fast', () => {
  it('recommends basic_fast when overpowered_model + prefer_low_cost', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ overall_score: 4, issue_labels: ['overpowered_model'] }),
      user_constraints: { prefer_low_cost: true },
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('basic_fast');
    expect(result.cost_speed_posture).toBe('minimize_cost');
  });
});

describe('Model Recommender — frontier_reasoning', () => {
  it('recommends frontier_reasoning when weak capability_fit_score with strong overall', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({
        overall_score: 4,
        capability_fit_score: 2,
        clarity_score: 4,
        context_score: 4,
        constraints_score: 4,
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('frontier_reasoning');
    expect(['high', 'xhigh']).toContain(result.recommended_effort);
  });
});

describe('Model Recommender — coding_specialist', () => {
  it('recommends coding_specialist when tags include coding', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      prompt_metadata: { tags: ['coding'] },
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('coding_specialist');
  });
});

describe('Model Recommender — long_context', () => {
  it('recommends long_context when issue_label too_long_for_task', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ issue_labels: ['too_long_for_task'] }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('long_context');
  });
});

describe('Model Recommender — multimodal', () => {
  it('recommends multimodal when require_multimodal constraint', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      user_constraints: { require_multimodal: true },
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('multimodal');
  });
});

describe('Model Recommender — search_grounded', () => {
  it('recommends search_grounded when issue_label needs_search', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ issue_labels: ['needs_search'] }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('search_grounded');
  });
});

describe('Model Recommender — safety_sensitive', () => {
  it('recommends safety_sensitive when tags include legal', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      prompt_metadata: { tags: ['legal'] },
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('safety_sensitive');
  });
});

describe('Model Recommender — do_not_send_external', () => {
  it('recommends do_not_send_external on critical safety warning', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'secret_like', severity: 'critical' })],
        highest_severity: 'critical',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('do_not_send_external');
    expect(result.safety_posture).toBe('do_not_route_until_redacted');
    expect(result.privacy_posture).toBe('external_not_recommended');
    // Candidates should be open-weight only or empty
    for (const c of result.candidate_families) {
      // Verify each candidate is from an open-weight entry
      expect(c.reason).toMatch(/open.weight|local/i);
    }
  });
});

describe('Model Recommender — weak prompt quality', () => {
  it('mentions improving prompt in explanation when overall_score <= 2', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ overall_score: 2, clarity_score: 2 }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.explanation.toLowerCase()).toMatch(/improv/);
    // Should not over-escalate effort
    expect(['low', 'medium']).toContain(result.recommended_effort);
  });
});

describe('Model Recommender — user constraints', () => {
  it('excludes china entries when allow_china_models is false', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      prompt_metadata: { tags: ['coding'] },
      user_constraints: { allow_china_models: false },
    };
    const result = recommendModel(input, { now: fixedNow });
    // No candidate should have a china-region provider ID
    for (const c of result.candidate_families) {
      expect(c.catalog_id).not.toMatch(/deepseek|moonshot|zhipu|minimax|baidu|bytedance|stepfun|sensetime|alibaba.*hosted/);
    }
  });

  it('prioritizes open-weight when prefer_local_or_open_weight', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
      user_constraints: { prefer_local_or_open_weight: true },
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.recommended_class).toBe('local_or_open_weight');
  });
});

describe('Model Recommender — candidate limit', () => {
  it('returns at most 5 candidate families', () => {
    const input: ModelRecommendationInput = {
      score: makeScore(),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.candidate_families.length).toBeLessThanOrEqual(5);
  });
});

describe('Model Recommender — deterministic output', () => {
  it('produces deep-equal output on repeated calls with same input + fixedNow', () => {
    const input: ModelRecommendationInput = {
      score: makeScore({ overall_score: 3 }),
      prompt_metadata: { tags: ['general'] },
    };
    const result1 = recommendModel(input, { now: fixedNow });
    const result2 = recommendModel(input, { now: fixedNow });
    expect(result1).toEqual(result2);
  });
});

describe('Model Recommender — safety routing postures', () => {
  it('secret_like → do_not_route_until_redacted', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'secret_like', severity: 'critical' })],
        highest_severity: 'critical',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('do_not_route_until_redacted');
  });

  it('credential_like → do_not_route_until_redacted', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'credential_like', severity: 'critical' })],
        highest_severity: 'critical',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('do_not_route_until_redacted');
  });

  it('private_key → do_not_route_until_redacted', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'private_key', severity: 'critical' })],
        highest_severity: 'critical',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('do_not_route_until_redacted');
  });

  it('personal_data → review_before_routing', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'personal_data', severity: 'medium' })],
        highest_severity: 'medium',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('review_before_routing');
  });

  it('customer_data → review_before_routing', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'customer_data', severity: 'medium' })],
        highest_severity: 'medium',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('review_before_routing');
  });

  it('citation_needed → review_before_routing', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'citation_needed', severity: 'medium' })],
        highest_severity: 'medium',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('review_before_routing');
  });

  it('prompt_injection → review_before_routing', () => {
    const input: ModelRecommendationInput = {
      safety_result: makeSafetyResult({
        warnings: [makeWarning({ category: 'prompt_injection', severity: 'high' })],
        highest_severity: 'high',
      }),
    };
    const result = recommendModel(input, { now: fixedNow });
    expect(result.safety_posture).toBe('review_before_routing');
  });
});
