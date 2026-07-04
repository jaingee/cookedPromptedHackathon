import { describe, it, expect, beforeEach } from 'vitest';
import { generateRewriteSuggestion, REWRITE_ENGINE_VERSION } from '../../src/rewrite-template/index.js';
import type { RewriteInput } from '../../src/rewrite-template/index.js';
import type { PromptScore, ScoringIssueLabel } from '../../src/scoring/types.js';
import type { SafetyScanResult, SafetyWarning } from '../../src/safety/types.js';
import type { ModelRecommendation } from '../../src/model-recommendation/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';
let idSeq = 0;
const fixedId = () => { idSeq += 1; return `test-id-${idSeq}`; };

beforeEach(() => { idSeq = 0; });

function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-1',
    prompt_log_id: 'log-1',
    overall_score: 3,
    clarity_score: 4,
    context_score: 4,
    constraints_score: 4,
    output_format_score: 4,
    capability_fit_score: 4,
    efficiency_score: 4,
    safety_privacy_score: 4,
    issue_labels: [],
    explanations: [],
    confidence: 'high',
    scoring_version: 'scoring-v1',
    scored_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeWarning(overrides: Partial<SafetyWarning> = {}): SafetyWarning {
  return {
    id: 'warn-1',
    category: 'secret_like',
    severity: 'high',
    confidence: 'high',
    message: 'Detected a secret-like pattern.',
    scanner_version: 'scanner-v1',
    created_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeSafetyResult(overrides: Partial<SafetyScanResult> = {}): SafetyScanResult {
  return {
    warnings: [],
    highest_severity: null,
    scanner_version: 'scanner-v1',
    scanned_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeModelRec(overrides: Partial<ModelRecommendation> = {}): ModelRecommendation {
  return {
    recommended_class: 'balanced_general',
    recommended_effort: 'medium',
    cost_speed_posture: 'balanced',
    privacy_posture: 'external_ok_after_review',
    safety_posture: 'safe_to_route',
    explanation: 'Balanced recommendation.',
    candidate_families: [],
    confidence: 'high',
    recommender_version: 'recommender-v1',
    created_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

const options = { now: fixedNow, idFactory: fixedId };

describe('generateRewriteSuggestion', () => {
  describe('4.1 Issue-label mapping', () => {
    const labelExpectations: Array<{
      label: ScoringIssueLabel;
      dimension: string;
      action: string;
      severity: string;
    }> = [
      { label: 'missing_context', dimension: 'context', action: 'add', severity: 'medium' },
      { label: 'unclear_task', dimension: 'clarity', action: 'change', severity: 'high' },
      { label: 'missing_constraints', dimension: 'constraints', action: 'add', severity: 'medium' },
      { label: 'missing_output_format', dimension: 'output_format', action: 'add', severity: 'medium' },
      { label: 'overbroad_prompt', dimension: 'efficiency', action: 'change', severity: 'medium' },
      { label: 'privacy_risk', dimension: 'safety_privacy', action: 'review', severity: 'high' },
      { label: 'possible_secret', dimension: 'safety_privacy', action: 'remove', severity: 'critical' },
      { label: 'wrong_model_class', dimension: 'capability_fit', action: 'change', severity: 'medium' },
      { label: 'overpowered_model', dimension: 'efficiency', action: 'change', severity: 'low' },
      { label: 'needs_search', dimension: 'capability_fit', action: 'add', severity: 'medium' },
      { label: 'needs_tool_use', dimension: 'capability_fit', action: 'change', severity: 'medium' },
      { label: 'too_long_for_task', dimension: 'efficiency', action: 'remove', severity: 'medium' },
    ];

    for (const { label, dimension, action, severity } of labelExpectations) {
      it(`maps ${label} → dimension=${dimension}, action=${action}, severity=${severity}`, () => {
        const input: RewriteInput = {
          prompt_score: makeScore({ issue_labels: [label] }),
          prompt_text: 'test prompt',
        };
        const result = generateRewriteSuggestion(input, options);
        const item = result.guidance_items.find((i) => i.issue_label === label);
        expect(item).toBeDefined();
        expect(item!.dimension).toBe(dimension);
        expect(item!.action).toBe(action);
        expect(item!.severity).toBe(severity);
      });
    }
  });

  describe('4.2 Dimension-score rules', () => {
    it('score=0 for clarity (not covered by label) → supplementary guidance produced', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ clarity_score: 0, issue_labels: [] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const clarityItem = result.guidance_items.find((i) => i.dimension === 'clarity');
      expect(clarityItem).toBeDefined();
      expect(clarityItem!.action).toBe('change');
    });

    it('score=4 for context → no supplementary dimension guidance produced', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ context_score: 4, issue_labels: [] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const contextItem = result.guidance_items.find((i) => i.dimension === 'context');
      expect(contextItem).toBeUndefined();
    });

    it('dimension already covered by issue label → no duplicate', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ clarity_score: 0, issue_labels: ['unclear_task'] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const clarityItems = result.guidance_items.filter((i) => i.dimension === 'clarity');
      expect(clarityItems.length).toBe(1);
      expect(clarityItems[0].issue_label).toBe('unclear_task');
    });

    it('score=1 for efficiency → supplementary guidance produced', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ efficiency_score: 1, issue_labels: [] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const effItem = result.guidance_items.find((i) => i.dimension === 'efficiency');
      expect(effItem).toBeDefined();
    });

    it('score=2 for constraints → no supplementary guidance (threshold is ≤1)', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ constraints_score: 2, issue_labels: [] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const item = result.guidance_items.find((i) => i.dimension === 'constraints');
      expect(item).toBeUndefined();
    });
  });

  describe('4.3 Safety priority', () => {
    it('possible_secret label → first item is safety dimension', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['possible_secret', 'missing_context'] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.guidance_items[0].dimension).toBe('safety_privacy');
      expect(result.guidance_items[0].priority).toBe(1);
    });

    it('do_not_route_until_redacted → redaction-first item at priority 1', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
        model_recommendation: makeModelRec({ safety_posture: 'do_not_route_until_redacted' }),
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.guidance_items[0].dimension).toBe('safety_privacy');
      expect(result.guidance_items[0].severity).toBe('critical');
      expect(result.guidance_items[0].priority).toBe(1);
    });

    it('citation_needed warning category → produces guidance', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning({ category: 'citation_needed', severity: 'medium' })],
          highest_severity: 'medium',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const citationItem = result.guidance_items.find(
        (i) => i.explanation.toLowerCase().includes('citation'),
      );
      expect(citationItem).toBeDefined();
    });

    it('prompt_injection warning category → produces high-severity guidance', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning({ category: 'prompt_injection', severity: 'high' })],
          highest_severity: 'high',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const injectionItem = result.guidance_items.find(
        (i) => i.explanation.toLowerCase().includes('injection'),
      );
      expect(injectionItem).toBeDefined();
      expect(injectionItem!.severity).toBe('high');
    });

    it('critical severity items ordered before medium', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['possible_secret', 'missing_context'] }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      const criticalIdx = result.guidance_items.findIndex((i) => i.severity === 'critical');
      const mediumIdx = result.guidance_items.findIndex((i) => i.severity === 'medium');
      expect(criticalIdx).toBeLessThan(mediumIdx);
    });
  });

  describe('4.4 Model recommendation guidance', () => {
    it('minimize_cost → simplification guidance at lower priority', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context'] }),
        prompt_text: 'test prompt',
        model_recommendation: makeModelRec({ cost_speed_posture: 'minimize_cost' }),
      };
      const result = generateRewriteSuggestion(input, options);
      const costItem = result.guidance_items.find(
        (i) => i.explanation.toLowerCase().includes('cost') || i.explanation.toLowerCase().includes('cheaper'),
      );
      expect(costItem).toBeDefined();
      // Model rec items should be after issue-label items (lower priority = higher number)
      const labelItem = result.guidance_items.find((i) => i.issue_label === 'missing_context');
      expect(costItem!.priority).toBeGreaterThan(labelItem!.priority);
    });

    it('frontier_reasoning → thoroughness guidance', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
        model_recommendation: makeModelRec({ recommended_class: 'frontier_reasoning' }),
      };
      const result = generateRewriteSuggestion(input, options);
      const reasoningItem = result.guidance_items.find(
        (i) => i.explanation.toLowerCase().includes('reasoning') || i.explanation.toLowerCase().includes('thorough'),
      );
      expect(reasoningItem).toBeDefined();
    });

    it('local_or_open_weight → concise guidance', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
        model_recommendation: makeModelRec({ recommended_class: 'local_or_open_weight' }),
      };
      const result = generateRewriteSuggestion(input, options);
      const localItem = result.guidance_items.find(
        (i) => i.explanation.toLowerCase().includes('local') || i.explanation.toLowerCase().includes('concise'),
      );
      expect(localItem).toBeDefined();
    });
  });

  describe('4.5 No-guidance case', () => {
    it('all scores ≥4, no labels, no safety, no model rec → empty guidance', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({
          clarity_score: 5,
          context_score: 4,
          constraints_score: 5,
          output_format_score: 4,
          capability_fit_score: 5,
          efficiency_score: 4,
          safety_privacy_score: 5,
          issue_labels: [],
        }),
        prompt_text: 'test prompt',
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.guidance_items).toHaveLength(0);
      expect(result.summary.toLowerCase()).toContain('no coaching guidance needed');
      expect(result.overall_severity).toBe('low');
      expect(result.overall_priority).toBe(0);
    });
  });

  describe('4.7 Deterministic output', () => {
    it('same input + fixedNow + fixedId → deep-equal on repeated calls', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'unclear_task'] }),
        prompt_text: 'test prompt for determinism check',
        safety_result: makeSafetyResult({
          warnings: [makeWarning({ category: 'citation_needed', severity: 'medium' })],
          highest_severity: 'medium',
        }),
        model_recommendation: makeModelRec({ cost_speed_posture: 'minimize_cost' }),
      };

      idSeq = 0;
      const result1 = generateRewriteSuggestion(input, options);
      idSeq = 0;
      const result2 = generateRewriteSuggestion(input, options);
      expect(result1).toEqual(result2);
    });
  });

  describe('engine metadata', () => {
    it('includes correct engine_version', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test',
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.engine_version).toBe(REWRITE_ENGINE_VERSION);
      expect(result.engine_version).toBe('rewrite-engine-v1');
    });

    it('uses provided timestamp from now option', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test',
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.created_at).toBe('2026-07-04T00:00:00.000Z');
    });

    it('uses provided idFactory for guidance item IDs', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context'] }),
        prompt_text: 'test',
      };
      const result = generateRewriteSuggestion(input, options);
      expect(result.guidance_items[0].id).toBe('test-id-1');
    });
  });
});
