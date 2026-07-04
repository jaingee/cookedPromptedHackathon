import { describe, it, expect } from 'vitest';
import {
  renderDemoReport,
  DEMO_REPORT_RENDERER_VERSION,
  DEFAULT_DEMO_REPORT_TITLE,
} from '../../src/demo-report/index.js';
import type { DemoReport, ReportSectionKind } from '../../src/demo-report/index.js';
import type {
  UnifiedDemoOutput,
  BatchSummary,
  PipelineMetadata,
  PromptResult,
} from '../../src/integration-demo/types.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult } from '../../src/safety/types.js';
import type { ModelRecommendation } from '../../src/model-recommendation/types.js';
import type { RewriteSuggestion, TemplateSuggestion } from '../../src/rewrite-template/types.js';

// --- Synthetic fixture helpers ---

const FIXED_NOW = '2026-07-04T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;

function makeBatchSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total_prompts: 5,
    succeeded: 4,
    failed: 1,
    average_overall_score: 3.5,
    dimension_averages: {
      clarity: 4.0,
      context: 2.8,
      constraints: 3.2,
      output_format: 3.5,
      capability_fit: 4.2,
      efficiency: 3.0,
      safety_privacy: 4.5,
    },
    issue_label_counts: {
      missing_context: 3,
      unclear_task: 2,
      overbroad_prompt: 1,
    },
    most_common_labels: ['missing_context', 'unclear_task'],
    safety_summary: {
      prompts_with_warnings: 1,
      severity_counts: { medium: 1 },
      do_not_send_external_count: 0,
    },
    model_class_distribution: {
      balanced_general: 3,
      coding_specialist: 1,
      frontier_reasoning: 1,
    },
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<PipelineMetadata> = {}): PipelineMetadata {
  return {
    orchestrator_version: 'test-v1',
    engines_used: { scoring: 'v1', safety: 'v1' },
    pipeline_started_at: '2026-07-04T11:59:00.000Z',
    pipeline_completed_at: '2026-07-04T12:00:00.000Z',
    total_duration_ms: 60000,
    input_source: 'test',
    ...overrides,
  };
}

function makePromptResult(overrides: Partial<PromptResult> = {}): PromptResult {
  return {
    prompt_log_id: 'test-prompt-001',
    do_not_send_external: false,
    score: {
      id: 'score-001',
      prompt_log_id: 'test-prompt-001',
      overall_score: 3,
      clarity_score: 4,
      context_score: 3,
      constraints_score: 3,
      output_format_score: 3,
      capability_fit_score: 4,
      efficiency_score: 3,
      safety_privacy_score: 4,
      issue_labels: ['missing_context'],
      explanations: ['Test explanation'],
      confidence: 'medium',
      scoring_version: 'v1',
      scored_at: FIXED_NOW,
    } as PromptScore,
    safety_result: {
      prompt_log_id: 'test-prompt-001',
      warnings: [],
      highest_severity: null,
      scanner_version: 'v1',
      scanned_at: FIXED_NOW,
    } as SafetyScanResult,
    model_recommendation: {
      recommended_class: 'balanced_general',
      recommended_effort: 'medium',
      cost_speed_posture: 'balanced',
      privacy_posture: 'external_ok_after_review',
      safety_posture: 'safe_to_route',
      explanation: 'Test recommendation',
      candidate_families: [],
      confidence: 'medium',
      recommender_version: 'v1',
      created_at: FIXED_NOW,
    } as ModelRecommendation,
    rewrite_suggestion: {
      prompt_log_id: 'test-prompt-001',
      guidance_items: [],
      overall_severity: 'medium',
      overall_priority: 1,
      summary: 'test rewrite',
      engine_version: 'v1',
      created_at: FIXED_NOW,
    } as RewriteSuggestion,
    template_suggestion: {
      prompt_log_id: 'test-prompt-001',
      suggested_templates: [
        {
          template_id: 'tmpl-001',
          template_name: 'Context Builder',
          template_body: '[TASK] with [CONTEXT] for [AUDIENCE]',
          category_tags: ['general'],
          applicable_issue_labels: ['missing_context'],
          description: 'test template',
          generator_version: 'v1',
          created_at: FIXED_NOW,
        },
      ],
      generator_version: 'v1',
      created_at: FIXED_NOW,
    } as TemplateSuggestion,
    ...overrides,
  };
}

function makeOutput(overrides: Partial<UnifiedDemoOutput> = {}): UnifiedDemoOutput {
  return {
    prompt_results: [makePromptResult()],
    batch_summary: makeBatchSummary(),
    metadata: makeMetadata(),
    ...overrides,
  };
}

// --- Tests ---

describe('renderDemoReport', () => {
  describe('4.1 Basic render from synthetic UnifiedDemoOutput', () => {
    it('produces a DemoReport with title, version, generated_at, and 8 sections', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });

      expect(report.title).toBe(DEFAULT_DEMO_REPORT_TITLE);
      expect(report.renderer_version).toBe(DEMO_REPORT_RENDERER_VERSION);
      expect(report.generated_at).toBe(FIXED_NOW);
      expect(report.sections).toHaveLength(8);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary).toBe('string');
    });
  });

  describe('4.2 Markdown on/off', () => {
    it('includes markdown by default', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      expect(report.markdown).toBeDefined();
      expect(typeof report.markdown).toBe('string');
      expect(report.markdown!.length).toBeGreaterThan(0);
    });

    it('omits markdown with include_markdown: false', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow, include_markdown: false });
      expect(report.markdown).toBeUndefined();
    });

    it('includes markdown with include_markdown: true', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow, include_markdown: true });
      expect(report.markdown).toBeDefined();
    });
  });

  describe('4.3 Section order is fixed/deterministic', () => {
    it('sections appear in the defined fixed order', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const expectedOrder: ReportSectionKind[] = [
        'batch_overview',
        'prompt_health',
        'issue_patterns',
        'safety_privacy',
        'model_recommendations',
        'rewrite_coaching',
        'next_actions',
        'limitations',
      ];
      const actualOrder = report.sections.map((s) => s.kind);
      expect(actualOrder).toEqual(expectedOrder);
    });
  });

  describe('4.4 Batch overview correctness', () => {
    it('shows total, success %, avg score, duration from summary', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const batchSection = report.sections.find((s) => s.kind === 'batch_overview')!;

      expect(batchSection.heading).toBe('Batch Overview');
      expect(batchSection.metrics).toBeDefined();

      const metrics = batchSection.metrics!;
      const metricMap = Object.fromEntries(metrics.map((m) => [m.label, m]));

      expect(metricMap['Total prompts'].value).toBe(5);
      expect(metricMap['Succeeded'].value).toBe(4);
      expect(metricMap['Failed'].value).toBe(1);
      expect(metricMap['Success rate'].value).toBe(80);
      expect(metricMap['Average score'].value).toBe(3.5);
      expect(metricMap['Duration'].value).toBe(60000);
    });
  });

  describe('4.5 Dimension ranking (weakest first, null last)', () => {
    it('ranks dimensions weakest first', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const healthSection = report.sections.find((s) => s.kind === 'prompt_health')!;

      expect(healthSection.items).toBeDefined();
      const items = healthSection.items!;

      // First item should be the weakest dimension (context: 2.8)
      expect(items[0]).toContain('context');
      expect(items[0]).toContain('2.8');
    });

    it('places null dimensions last', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          dimension_averages: {
            clarity: 4.0,
            context: 2.8,
            constraints: null,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const healthSection = report.sections.find((s) => s.kind === 'prompt_health')!;
      const items = healthSection.items!;

      // Last item should be the null one (constraints)
      const lastItem = items[items.length - 1];
      expect(lastItem).toContain('constraints');
      expect(lastItem).toContain('N/A');
    });

    it('includes coaching notes for capability_fit when weak', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          dimension_averages: {
            capability_fit: 2.0,
            clarity: 4.5,
            context: 4.0,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const healthSection = report.sections.find((s) => s.kind === 'prompt_health')!;
      expect(healthSection.coaching_notes).toBeDefined();
      expect(healthSection.coaching_notes!.length).toBeGreaterThan(0);
      // Should contain the capability_fit coaching note
      expect(healthSection.coaching_notes!.some((n) => n.includes('model class'))).toBe(true);
    });

    it('includes coaching notes for safety_privacy when weak', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          dimension_averages: {
            safety_privacy: 2.0,
            clarity: 4.5,
            context: 4.0,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const healthSection = report.sections.find((s) => s.kind === 'prompt_health')!;
      expect(healthSection.coaching_notes).toBeDefined();
      expect(healthSection.coaching_notes!.some((n) => n.includes('safety'))).toBe(true);
    });
  });

  describe('4.6 Issue sorting and max cap', () => {
    it('sorts issues by frequency descending', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          issue_label_counts: {
            missing_context: 5,
            unclear_task: 3,
            overbroad_prompt: 1,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const issueSection = report.sections.find((s) => s.kind === 'issue_patterns')!;
      const items = issueSection.items!;

      expect(items[0]).toContain('missing_context');
      expect(items[0]).toContain('×5');
      expect(items[1]).toContain('unclear_task');
      expect(items[2]).toContain('overbroad_prompt');
    });

    it('caps issues at max_issue_patterns', () => {
      const labels: Record<string, number> = {};
      for (let i = 0; i < 15; i++) {
        labels[`issue_${String(i).padStart(2, '0')}`] = 15 - i;
      }
      const output = makeOutput({
        batch_summary: makeBatchSummary({ issue_label_counts: labels }),
      });
      const report = renderDemoReport(output, { now: fixedNow, max_issue_patterns: 5 });
      const issueSection = report.sections.find((s) => s.kind === 'issue_patterns')!;
      expect(issueSection.items!.length).toBeLessThanOrEqual(5);
    });

    it('uses alpha tiebreaker for equal frequencies', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          issue_label_counts: {
            missing_context: 3,
            unclear_task: 3,
            overbroad_prompt: 3,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const issueSection = report.sections.find((s) => s.kind === 'issue_patterns')!;
      const items = issueSection.items!;

      // Alpha order: missing_context, overbroad_prompt, unclear_task
      expect(items[0]).toContain('missing_context');
      expect(items[1]).toContain('overbroad_prompt');
      expect(items[2]).toContain('unclear_task');
    });
  });

  describe('4.7 Safety section (clean state + risky state)', () => {
    it('shows clean state with cautious local-scan wording', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 0,
            severity_counts: {},
            do_not_send_external_count: 0,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const safetySection = report.sections.find((s) => s.kind === 'safety_privacy')!;
      expect(safetySection.summary).toContain('No safety warnings');
      // Must NOT overclaim external routing safety
      expect(safetySection.summary).not.toContain('safe for external routing');
      expect(safetySection.summary).not.toContain('safe to send');
      expect(safetySection.summary).not.toContain('external routing');
    });

    it('shows exact severity ordering: critical → high → medium → low → unknown alpha', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 6,
            severity_counts: { critical: 1, high: 2, medium: 3, low: 4, unknown_b: 5, unknown_a: 6 },
            do_not_send_external_count: 1,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const safetySection = report.sections.find((s) => s.kind === 'safety_privacy')!;
      expect(safetySection.items).toBeDefined();
      const items = safetySection.items!;
      expect(items[0]).toBe('critical: 1');
      expect(items[1]).toBe('high: 2');
      expect(items[2]).toBe('medium: 3');
      expect(items[3]).toBe('low: 4');
      expect(items[4]).toBe('unknown_a: 6');
      expect(items[5]).toBe('unknown_b: 5');
    });

    it('shows risky state with severity breakdown', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 3,
            severity_counts: { high: 2, medium: 1 },
            do_not_send_external_count: 1,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const safetySection = report.sections.find((s) => s.kind === 'safety_privacy')!;
      expect(safetySection.summary).toContain('3');
      expect(safetySection.items).toBeDefined();
      expect(safetySection.items!.some((i) => i.includes('high'))).toBe(true);
      expect(safetySection.metrics!.some((m) => m.label === 'Do not send externally' && m.value === 1)).toBe(true);
    });

    it('includes coaching note when do_not_send_external > 0', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 2,
            severity_counts: { high: 2 },
            do_not_send_external_count: 2,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const safetySection = report.sections.find((s) => s.kind === 'safety_privacy')!;
      expect(safetySection.coaching_notes).toBeDefined();
      expect(safetySection.coaching_notes!.length).toBeGreaterThan(0);
    });
  });

  describe('4.8 Model recommendation distribution + dominant-class note', () => {
    it('shows model class distribution sorted by frequency', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          model_class_distribution: {
            balanced_general: 10,
            coding_specialist: 3,
            frontier_reasoning: 2,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const modelSection = report.sections.find((s) => s.kind === 'model_recommendations')!;
      const items = modelSection.items!;

      expect(items[0]).toContain('balanced_general');
      expect(items[1]).toContain('coding_specialist');
      expect(items[2]).toContain('frontier_reasoning');
    });

    it('adds dominant-class coaching note when >70%', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          model_class_distribution: {
            balanced_general: 15,
            coding_specialist: 2,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const modelSection = report.sections.find((s) => s.kind === 'model_recommendations')!;
      expect(modelSection.coaching_notes).toBeDefined();
      expect(modelSection.coaching_notes!.some((n) => n.includes('balanced_general'))).toBe(true);
    });

    it('no dominant note when distribution is balanced', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          model_class_distribution: {
            balanced_general: 5,
            coding_specialist: 5,
            frontier_reasoning: 5,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const modelSection = report.sections.find((s) => s.kind === 'model_recommendations')!;
      expect(modelSection.coaching_notes).toBeUndefined();
    });
  });

  describe('4.9 Template aggregation (top 5)', () => {
    it('aggregates template frequency across prompt results', () => {
      const results: PromptResult[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          makePromptResult({
            prompt_log_id: `prompt-${i}`,
            template_suggestion: {
              prompt_log_id: `prompt-${i}`,
              suggested_templates: [
                {
                  template_id: 'tmpl-001',
                  template_name: 'Context Builder',
                  template_body: '[TASK] with [CONTEXT]',
                  category_tags: ['general'],
                  applicable_issue_labels: ['missing_context'],
                  description: 'test',
                  generator_version: 'v1',
                  created_at: FIXED_NOW,
                },
              ],
              generator_version: 'v1',
              created_at: FIXED_NOW,
            } as TemplateSuggestion,
          }),
        );
      }
      const output = makeOutput({ prompt_results: results });
      const report = renderDemoReport(output, { now: fixedNow });
      const rewriteSection = report.sections.find((s) => s.kind === 'rewrite_coaching')!;

      expect(rewriteSection.items).toBeDefined();
      expect(rewriteSection.items!.some((i) => i.includes('Context Builder') && i.includes('5'))).toBe(true);
    });

    it('caps templates at max_templates', () => {
      const results: PromptResult[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          makePromptResult({
            prompt_log_id: `prompt-${i}`,
            template_suggestion: {
              prompt_log_id: `prompt-${i}`,
              suggested_templates: [
                {
                  template_id: `tmpl-${i}`,
                  template_name: `Template ${String(i).padStart(2, '0')}`,
                  template_body: `[TASK ${i}]`,
                  category_tags: ['general'],
                  applicable_issue_labels: ['missing_context'],
                  description: 'test',
                  generator_version: 'v1',
                  created_at: FIXED_NOW,
                },
              ],
              generator_version: 'v1',
              created_at: FIXED_NOW,
            } as TemplateSuggestion,
          }),
        );
      }
      const output = makeOutput({ prompt_results: results });
      const report = renderDemoReport(output, { now: fixedNow, max_templates: 3 });
      const rewriteSection = report.sections.find((s) => s.kind === 'rewrite_coaching')!;

      // Should have rewrite severity items + at most 3 template items
      const templateItems = rewriteSection.items?.filter((i) => i.includes('Template')) ?? [];
      expect(templateItems.length).toBeLessThanOrEqual(3);
    });
  });

  describe('4.10 Next actions priority ordering + padding to min 3', () => {
    it('orders actions by priority (safety first)', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 2,
            severity_counts: { high: 2 },
            do_not_send_external_count: 1,
          },
          issue_label_counts: { missing_context: 5 },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const actionsSection = report.sections.find((s) => s.kind === 'next_actions')!;

      expect(actionsSection.items).toBeDefined();
      // First action should be safety-sourced
      expect(actionsSection.items![0]).toContain('[safety]');
    });

    it('pads to minimum 3 actions with encouragement', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 0,
            severity_counts: {},
            do_not_send_external_count: 0,
          },
          issue_label_counts: {},
          dimension_averages: { clarity: 5, context: 5 },
          model_class_distribution: {},
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      const actionsSection = report.sections.find((s) => s.kind === 'next_actions')!;

      expect(actionsSection.items).toBeDefined();
      expect(actionsSection.items!.length).toBeGreaterThanOrEqual(3);
    });

    it('caps at max_actions', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          safety_summary: {
            prompts_with_warnings: 5,
            severity_counts: { critical: 3, high: 2 },
            do_not_send_external_count: 3,
          },
          issue_label_counts: {
            missing_context: 10,
            unclear_task: 8,
            overbroad_prompt: 5,
          },
          dimension_averages: { clarity: 1, context: 1, constraints: 1 },
          model_class_distribution: { balanced_general: 20 },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow, max_actions: 3 });
      const actionsSection = report.sections.find((s) => s.kind === 'next_actions')!;

      expect(actionsSection.items!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('4.11 Empty input → valid report', () => {
    it('produces valid report with "no prompts" sections when empty', () => {
      const output: UnifiedDemoOutput = {
        prompt_results: [],
        batch_summary: makeBatchSummary({
          total_prompts: 0,
          succeeded: 0,
          failed: 0,
          average_overall_score: null,
          dimension_averages: {},
          issue_label_counts: {},
          most_common_labels: [],
          safety_summary: {
            prompts_with_warnings: 0,
            severity_counts: {},
            do_not_send_external_count: 0,
          },
          model_class_distribution: {},
        }),
        metadata: makeMetadata(),
      };
      const report = renderDemoReport(output, { now: fixedNow });

      expect(report.title).toBe(DEFAULT_DEMO_REPORT_TITLE);
      expect(report.sections).toHaveLength(8);
      expect(report.summary).toContain('No prompts');
    });
  });

  describe('4.12 Top-level error → reflected in summary', () => {
    it('includes error context in summary when input.error exists', () => {
      const output = makeOutput({ error: 'Pipeline failed at store.' });
      const report = renderDemoReport(output, { now: fixedNow });

      expect(report.summary).toContain('issue');
      // Still produces 8 sections
      expect(report.sections).toHaveLength(8);
    });
  });

  describe('4.13 Deterministic output with fixed now', () => {
    it('produces identical output on consecutive calls', () => {
      const input = makeOutput();
      const report1 = renderDemoReport(input, { now: fixedNow });
      const report2 = renderDemoReport(input, { now: fixedNow });

      expect(JSON.stringify(report1)).toBe(JSON.stringify(report2));
    });

    it('generated_at uses the injectable now function', () => {
      const customNow = () => '2030-01-01T00:00:00.000Z';
      const report = renderDemoReport(makeOutput(), { now: customNow });
      expect(report.generated_at).toBe('2030-01-01T00:00:00.000Z');
    });
  });
});
