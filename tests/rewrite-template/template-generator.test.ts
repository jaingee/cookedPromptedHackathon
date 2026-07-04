import { describe, it, expect } from 'vitest';
import { generateTemplateSuggestion, TEMPLATE_GENERATOR_VERSION } from '../../src/rewrite-template/index.js';
import type { RewriteInput } from '../../src/rewrite-template/index.js';
import type { PromptScore, ScoringIssueLabel } from '../../src/scoring/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';

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

const options = { now: fixedNow };

describe('generateTemplateSuggestion', () => {
  describe('4.6 Template selection', () => {
    it('single label → matching template(s) returned', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context'] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.suggested_templates.length).toBeGreaterThan(0);
      // Each returned template should match the issue label
      for (const t of result.suggested_templates) {
        expect(t.applicable_issue_labels).toContain('missing_context');
      }
    });

    it('multi-label input → cross-cutting template preferred (higher match count)', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['privacy_risk', 'possible_secret'] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.suggested_templates.length).toBeGreaterThan(0);
      // The cross-cutting safety-first template covers both labels
      const crossCutting = result.suggested_templates[0];
      expect(crossCutting.applicable_issue_labels).toContain('privacy_risk');
      expect(crossCutting.applicable_issue_labels).toContain('possible_secret');
    });

    it('max 3 templates returned even with many labels', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({
          issue_labels: [
            'missing_context',
            'unclear_task',
            'missing_constraints',
            'missing_output_format',
            'overbroad_prompt',
          ],
        }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.suggested_templates.length).toBeLessThanOrEqual(3);
    });

    it('empty labels → empty suggested_templates', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: [] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.suggested_templates).toHaveLength(0);
    });

    it('stable ordering with same match count', () => {
      // Two labels that each match exactly one label-specific template
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['needs_search', 'needs_tool_use'] }),
        prompt_text: 'test prompt',
      };
      const result1 = generateTemplateSuggestion(input, options);
      const result2 = generateTemplateSuggestion(input, options);
      expect(result1.suggested_templates.map((t) => t.template_id)).toEqual(
        result2.suggested_templates.map((t) => t.template_id),
      );
    });

    it('each label produces at least one matching template', () => {
      const allLabels: ScoringIssueLabel[] = [
        'missing_context', 'unclear_task', 'missing_constraints',
        'missing_output_format', 'overbroad_prompt', 'privacy_risk',
        'possible_secret', 'wrong_model_class', 'overpowered_model',
        'needs_search', 'needs_tool_use', 'too_long_for_task',
      ];
      for (const label of allLabels) {
        const input: RewriteInput = {
          prompt_score: makeScore({ issue_labels: [label] }),
          prompt_text: 'test prompt',
        };
        const result = generateTemplateSuggestion(input, options);
        expect(result.suggested_templates.length).toBeGreaterThan(0);
      }
    });

    it('cross-cutting constraints+scope template preferred over single-label when both labels present', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_constraints', 'overbroad_prompt'] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      // Cross-cutting template matching both should be first
      const first = result.suggested_templates[0];
      expect(first.applicable_issue_labels).toContain('missing_constraints');
      expect(first.applicable_issue_labels).toContain('overbroad_prompt');
    });
  });

  describe('4.7 Deterministic output', () => {
    it('same input + fixedNow → deep-equal on repeated calls', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'missing_output_format'] }),
        prompt_text: 'test prompt for determinism',
      };
      const result1 = generateTemplateSuggestion(input, options);
      const result2 = generateTemplateSuggestion(input, options);
      expect(result1).toEqual(result2);
    });
  });

  describe('metadata', () => {
    it('includes correct generator_version', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['unclear_task'] }),
        prompt_text: 'test',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.generator_version).toBe(TEMPLATE_GENERATOR_VERSION);
      expect(result.generator_version).toBe('template-generator-v1');
    });

    it('uses provided timestamp from now option', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['unclear_task'] }),
        prompt_text: 'test',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.created_at).toBe('2026-07-04T00:00:00.000Z');
    });

    it('includes prompt_log_id from input score', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ prompt_log_id: 'my-log-99', issue_labels: ['unclear_task'] }),
        prompt_text: 'test',
      };
      const result = generateTemplateSuggestion(input, options);
      expect(result.prompt_log_id).toBe('my-log-99');
    });

    it('template bodies use bracket placeholders only', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({
          issue_labels: ['missing_context', 'unclear_task', 'missing_constraints'],
        }),
        prompt_text: 'test',
      };
      const result = generateTemplateSuggestion(input, options);
      for (const t of result.suggested_templates) {
        // Should contain at least one placeholder
        expect(t.template_body).toMatch(/\[.+\]/);
      }
    });
  });
});
