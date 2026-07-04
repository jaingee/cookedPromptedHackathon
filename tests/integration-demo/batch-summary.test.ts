import { describe, it, expect } from 'vitest';
import { computeBatchSummary } from '../../src/integration-demo/index.js';
import type { PromptResult } from '../../src/integration-demo/index.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult, SafetyWarning } from '../../src/safety/types.js';
import type { ModelRecommendation } from '../../src/model-recommendation/types.js';

function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-1',
    prompt_log_id: 'log-1',
    overall_score: 3,
    clarity_score: 3,
    context_score: 3,
    constraints_score: 3,
    output_format_score: 3,
    capability_fit_score: 3,
    efficiency_score: 3,
    safety_privacy_score: 3,
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
    message: 'Detected something.',
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
    explanation: 'Standard prompt.',
    candidate_families: [],
    confidence: 'high',
    recommender_version: 'recommender-v1',
    created_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeResult(overrides: Partial<PromptResult> = {}): PromptResult {
  return {
    prompt_log_id: 'log-1',
    do_not_send_external: false,
    score: makeScore(),
    safety_result: makeSafetyResult(),
    model_recommendation: makeModelRec(),
    ...overrides,
  };
}

describe('computeBatchSummary', () => {
  describe('Empty input', () => {
    it('produces valid zero/null summary for empty array', () => {
      const summary = computeBatchSummary([]);

      expect(summary.total_prompts).toBe(0);
      expect(summary.succeeded).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.average_overall_score).toBeNull();
      expect(summary.most_common_labels).toEqual([]);
      expect(summary.safety_summary.prompts_with_warnings).toBe(0);
      expect(summary.safety_summary.do_not_send_external_count).toBe(0);
      expect(Object.keys(summary.model_class_distribution)).toHaveLength(0);
    });
  });

  describe('Single successful result', () => {
    it('produces correct averages and counts', () => {
      const result = makeResult({
        score: makeScore({
          overall_score: 4,
          clarity_score: 5,
          context_score: 3,
          constraints_score: 4,
          output_format_score: 2,
          capability_fit_score: 4,
          efficiency_score: 3,
          safety_privacy_score: 5,
          issue_labels: ['missing_context'],
        }),
      });

      const summary = computeBatchSummary([result]);

      expect(summary.total_prompts).toBe(1);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.average_overall_score).toBe(4);
      expect(summary.dimension_averages['clarity']).toBe(5);
      expect(summary.dimension_averages['context']).toBe(3);
      expect(summary.issue_label_counts['missing_context']).toBe(1);
      expect(summary.most_common_labels).toEqual(['missing_context']);
      expect(summary.model_class_distribution['balanced_general']).toBe(1);
    });
  });

  describe('Multiple results', () => {
    it('calculates correct aggregation', () => {
      const results: PromptResult[] = [
        makeResult({
          prompt_log_id: 'r1',
          score: makeScore({ overall_score: 2, issue_labels: ['missing_context', 'unclear_task'] }),
          model_recommendation: makeModelRec({ recommended_class: 'basic_fast' }),
        }),
        makeResult({
          prompt_log_id: 'r2',
          score: makeScore({ overall_score: 4, issue_labels: ['missing_context'] }),
          model_recommendation: makeModelRec({ recommended_class: 'balanced_general' }),
        }),
        makeResult({
          prompt_log_id: 'r3',
          score: makeScore({ overall_score: 3, issue_labels: ['unclear_task', 'missing_constraints'] }),
          model_recommendation: makeModelRec({ recommended_class: 'basic_fast' }),
        }),
      ];

      const summary = computeBatchSummary(results);

      expect(summary.total_prompts).toBe(3);
      expect(summary.succeeded).toBe(3);
      expect(summary.failed).toBe(0);
      expect(summary.average_overall_score).toBe(3); // (2+4+3)/3
      expect(summary.issue_label_counts['missing_context']).toBe(2);
      expect(summary.issue_label_counts['unclear_task']).toBe(2);
      expect(summary.issue_label_counts['missing_constraints']).toBe(1);
      expect(summary.model_class_distribution['basic_fast']).toBe(2);
      expect(summary.model_class_distribution['balanced_general']).toBe(1);
    });
  });

  describe('Failed results', () => {
    it('excludes failed results from score averages', () => {
      const results: PromptResult[] = [
        makeResult({
          prompt_log_id: 'r1',
          score: makeScore({ overall_score: 4 }),
        }),
        makeResult({
          prompt_log_id: 'r2',
          score: undefined,
          error: 'Pipeline failed at score.',
          failed_step: 'score',
        }),
      ];

      const summary = computeBatchSummary(results);

      expect(summary.total_prompts).toBe(2);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.average_overall_score).toBe(4); // only the successful result counts
    });
  });

  describe('Issue label frequency', () => {
    it('sorts descending by frequency with alpha tiebreaker', () => {
      const results: PromptResult[] = [
        makeResult({
          score: makeScore({ issue_labels: ['unclear_task', 'missing_context', 'missing_constraints'] }),
        }),
        makeResult({
          score: makeScore({ issue_labels: ['unclear_task', 'missing_context'] }),
        }),
        makeResult({
          score: makeScore({ issue_labels: ['unclear_task'] }),
        }),
      ];

      const summary = computeBatchSummary(results);

      // unclear_task: 3, missing_context: 2, missing_constraints: 1
      expect(summary.most_common_labels[0]).toBe('unclear_task');
      expect(summary.most_common_labels[1]).toBe('missing_context');
      expect(summary.most_common_labels[2]).toBe('missing_constraints');
    });

    it('applies alpha tiebreaker when frequencies are equal', () => {
      const results: PromptResult[] = [
        makeResult({
          score: makeScore({ issue_labels: ['unclear_task', 'missing_context'] }),
        }),
      ];

      const summary = computeBatchSummary(results);

      // Both have count 1, alpha order: missing_context < unclear_task
      expect(summary.most_common_labels[0]).toBe('missing_context');
      expect(summary.most_common_labels[1]).toBe('unclear_task');
    });
  });

  describe('Safety summary counts', () => {
    it('counts prompts with warnings and severity distribution', () => {
      const results: PromptResult[] = [
        makeResult({
          safety_result: makeSafetyResult({
            warnings: [
              makeWarning({ severity: 'high' }),
              makeWarning({ id: 'w2', severity: 'critical' }),
            ],
            highest_severity: 'critical',
          }),
        }),
        makeResult({
          safety_result: makeSafetyResult({
            warnings: [makeWarning({ severity: 'high' })],
            highest_severity: 'high',
          }),
        }),
        makeResult({
          safety_result: makeSafetyResult({ warnings: [] }),
        }),
      ];

      const summary = computeBatchSummary(results);

      expect(summary.safety_summary.prompts_with_warnings).toBe(2);
      expect(summary.safety_summary.severity_counts['high']).toBe(2);
      expect(summary.safety_summary.severity_counts['critical']).toBe(1);
    });
  });

  describe('do_not_send_external counting', () => {
    it('counts results flagged as do_not_send_external', () => {
      const results: PromptResult[] = [
        makeResult({ do_not_send_external: true }),
        makeResult({ do_not_send_external: false }),
        makeResult({ do_not_send_external: true }),
      ];

      const summary = computeBatchSummary(results);

      expect(summary.safety_summary.do_not_send_external_count).toBe(2);
    });
  });

  describe('Model class distribution', () => {
    it('counts by recommended_class', () => {
      const results: PromptResult[] = [
        makeResult({ model_recommendation: makeModelRec({ recommended_class: 'basic_fast' }) }),
        makeResult({ model_recommendation: makeModelRec({ recommended_class: 'basic_fast' }) }),
        makeResult({ model_recommendation: makeModelRec({ recommended_class: 'frontier_reasoning' }) }),
        makeResult({ model_recommendation: undefined }),
      ];

      const summary = computeBatchSummary(results);

      expect(summary.model_class_distribution['basic_fast']).toBe(2);
      expect(summary.model_class_distribution['frontier_reasoning']).toBe(1);
      expect(Object.keys(summary.model_class_distribution)).toHaveLength(2);
    });
  });
});
