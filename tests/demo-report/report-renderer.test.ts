import { describe, it, expect } from 'vitest';
import {
  renderDemoReport,
  DEMO_REPORT_RENDERER_VERSION,
  DEFAULT_DEMO_REPORT_TITLE,
} from '../../src/demo-report/index.js';
import type { DemoReport, ReportSectionKind } from '../../src/demo-report/index.js';
import { getScoreBand, toScore100 } from '../../src/demo-report/scorecard.js';
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
const REDACTION_SECRET = ['sk', 'test1234567890'].join('-');

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
    it('produces a DemoReport with title, version, generated_at, and 10 sections', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });

      expect(report.title).toBe(DEFAULT_DEMO_REPORT_TITLE);
      expect(report.renderer_version).toBe(DEMO_REPORT_RENDERER_VERSION);
      expect(report.generated_at).toBe(FIXED_NOW);
      expect(report.sections).toHaveLength(10);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary).toBe('string');
    });
  });

  describe('4.1a Score conversion helpers', () => {
    it('converts 0-5 scores to 0-100 with Math.round(score * 20)', () => {
      expect(toScore100(0)).toBe(0);
      expect(toScore100(2.49)).toBe(50);
      expect(toScore100(3.5)).toBe(70);
      expect(toScore100(4.24)).toBe(85);
      expect(toScore100(5)).toBe(100);
    });

    it('returns null for missing scores', () => {
      expect(toScore100(null)).toBeNull();
      expect(toScore100(undefined)).toBeNull();
    });

    it('assigns score bands at the correct boundaries', () => {
      expect(getScoreBand(0)).toBe('Poor');
      expect(getScoreBand(49)).toBe('Poor');
      expect(getScoreBand(50)).toBe('Okay');
      expect(getScoreBand(69)).toBe('Okay');
      expect(getScoreBand(70)).toBe('Good');
      expect(getScoreBand(84)).toBe('Good');
      expect(getScoreBand(85)).toBe('Excellent');
      expect(getScoreBand(100)).toBe('Excellent');
      expect(getScoreBand(null)).toBeNull();
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
        'batch_verdict',
        'prompt_habit_score',
        'category_scorecard',
        'issue_patterns',
        'safety_privacy',
        'safety_privacy_lessons',
        'model_recommendations',
        'rewrite_coaching',
        'next_actions',
        'limitations',
      ];
      const actualOrder = report.sections.map((s) => s.kind);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('inserts prompt examples after issue patterns when prompt text is available', () => {
      const promptResults: PromptResult[] = [
        makePromptResult({
        prompt_log_id: 'ex-001',
        prompt_text:
            `Use api key ${REDACTION_SECRET} and password=secret123 while keeping customer_id: acme-42 out of the prompt.`,
          score: {
            id: 'score-ex-001',
            prompt_log_id: 'ex-001',
            overall_score: 1,
            clarity_score: 1,
            context_score: 1,
            constraints_score: 1,
            output_format_score: 1,
            capability_fit_score: 1,
            efficiency_score: 1,
            safety_privacy_score: 1,
            issue_labels: ['missing_context'],
            explanations: ['Needs more context'],
            confidence: 'medium',
            scoring_version: 'v1',
            scored_at: FIXED_NOW,
          } as PromptScore,
        }),
        makePromptResult({
        prompt_log_id: 'ex-002',
        prompt_text:
            `Return JSON with three fields while keeping api key ${REDACTION_SECRET} and customer_id: acme-42 out of the prompt.`,
          score: {
            id: 'score-ex-002',
            prompt_log_id: 'ex-002',
            overall_score: 1,
            clarity_score: 1,
            context_score: 1,
            constraints_score: 1,
            output_format_score: 1,
            capability_fit_score: 1,
            efficiency_score: 1,
            safety_privacy_score: 1,
            issue_labels: ['missing_output_format'],
            explanations: ['Needs format'],
            confidence: 'medium',
            scoring_version: 'v1',
            scored_at: FIXED_NOW,
          } as PromptScore,
        }),
      ];
      const report = renderDemoReport(makeOutput({ prompt_results: promptResults }), { now: fixedNow });
      const expectedOrder: ReportSectionKind[] = [
        'batch_verdict',
        'prompt_habit_score',
        'category_scorecard',
        'issue_patterns',
        'prompt_examples',
        'roast_of_the_batch',
        'copy_worthy_prompt',
        'safety_privacy',
        'safety_privacy_lessons',
        'model_recommendations',
        'rewrite_coaching',
        'next_actions',
        'limitations',
      ];
      const actualOrder = report.sections.map((s) => s.kind);
      expect(actualOrder).toEqual(expectedOrder);
      const promptExamples = report.sections.find((s) => s.kind === 'prompt_examples');
      expect(promptExamples?.prompt_example_cards).toHaveLength(2);
      expect(report.sections.find((s) => s.kind === 'roast_of_the_batch')).toBeDefined();
      expect(report.sections.find((s) => s.kind === 'copy_worthy_prompt')).toBeDefined();
    });

    it('inserts model waste before safety sections when model-fit signals exist', () => {
      const report = renderDemoReport(
        makeOutput({
          batch_summary: makeBatchSummary({
            issue_label_counts: {
              overpowered_model: 2,
              needs_search: 1,
            },
            most_common_labels: ['overpowered_model'],
            safety_summary: {
              prompts_with_warnings: 0,
              severity_counts: {},
              do_not_send_external_count: 0,
            },
          }),
        }),
        { now: fixedNow },
      );

      const expectedOrder: ReportSectionKind[] = [
        'batch_verdict',
        'prompt_habit_score',
        'category_scorecard',
        'issue_patterns',
        'model_waste',
        'safety_privacy',
        'model_recommendations',
        'rewrite_coaching',
        'next_actions',
        'limitations',
      ];

      expect(report.sections.map((s) => s.kind)).toEqual(expectedOrder);
      const modelWaste = report.sections.find((s) => s.kind === 'model_waste');
      expect(modelWaste).toBeDefined();
      expect(modelWaste!.overkill_count).toBe(2);
      expect(modelWaste!.underfit_count).toBe(1);
    });
  });

  describe('4.4 Batch overview correctness', () => {
    it('shows total, success %, duration, overall score, and score band from summary', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const batchSection = report.sections.find((s) => s.kind === 'batch_verdict')!;

      expect(batchSection.heading).toBe('Batch Verdict');
      expect(batchSection.metrics).toBeDefined();
      expect(batchSection.overall_score_100).toBe(70);
      expect(batchSection.score_band).toBe('Good');

      const metrics = batchSection.metrics!;
      const metricMap = Object.fromEntries(metrics.map((m) => [m.label, m]));

      expect(metricMap['Total prompts'].value).toBe(5);
      expect(metricMap['Succeeded'].value).toBe(4);
      expect(metricMap['Failed'].value).toBe(1);
      expect(metricMap['Success rate'].value).toBe(80);
      expect(metricMap['Duration'].value).toBe(60000);
    });
  });

  describe('4.5 Prompt Habit Score and Category Scorecard', () => {
    it('shows Prompt Habit Score in 0-100 form with a band', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const scoreSection = report.sections.find((s) => s.kind === 'prompt_habit_score')!;

      expect(scoreSection.heading).toBe('Prompt Habit Score');
      expect(scoreSection.overall_score_100).toBe(70);
      expect(scoreSection.score_band).toBe('Good');
      expect(scoreSection.summary).toContain('solid');
    });

    it('renders all 7 category scores in fixed order with 0-100 values', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const scorecardSection = report.sections.find((s) => s.kind === 'category_scorecard')!;

      expect(scorecardSection.category_scores_100).toBeDefined();
      expect(scorecardSection.category_scores_100).toHaveLength(7);
      expect(scorecardSection.category_scores_100!.map((item) => item.category)).toEqual([
        'Clarity',
        'Context',
        'Constraints',
        'Output Format',
        'Model Fit',
        'Efficiency',
        'Safety & Privacy',
      ]);
      expect(scorecardSection.category_scores_100![0].score_100).toBe(80);
      expect(scorecardSection.category_scores_100![1].score_100).toBe(56);
      expect(scorecardSection.category_scores_100![6].score_100).toBe(90);
    });

    it('handles null category scores safely', () => {
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
      const scorecardSection = report.sections.find((s) => s.kind === 'category_scorecard')!;
      const constraints = scorecardSection.category_scores_100!.find((item) => item.category === 'Constraints');

      expect(constraints?.score_100).toBeNull();
      expect(constraints?.score_band).toBeNull();
    });

    it('includes coaching notes for weak categories', () => {
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
      const scorecardSection = report.sections.find((s) => s.kind === 'category_scorecard')!;
      expect(scorecardSection.coaching_notes).toBeDefined();
      expect(scorecardSection.coaching_notes!.length).toBeGreaterThan(0);
      expect(scorecardSection.coaching_notes!.some((n) => n.includes('model'))).toBe(true);
    });
  });

  describe('4.6 Issue sorting and max cap', () => {
    it('sorts issues by frequency descending with human-readable labels', () => {
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
      expect(issueSection.heading).toBe('What Kept Hurting Results');
      const items = issueSection.items!;

      expect(items[0]).toContain('Missing context');
      expect(items[0]).toContain('×5');
      expect(items[1]).toContain('Unclear task');
      expect(items[2]).toContain('Overbroad prompt');
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

      // Alpha order by raw key: missing_context, overbroad_prompt, unclear_task
      expect(items[0]).toContain('Missing context');
      expect(items[1]).toContain('Overbroad prompt');
      expect(items[2]).toContain('Unclear task');
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
      expect(items[0]).toBe('Critical warnings: 1');
      expect(items[1]).toBe('High warnings: 2');
      expect(items[2]).toBe('Medium warnings: 3');
      expect(items[3]).toBe('Low warnings: 4');
      expect(items[4]).toBe('Unknown_a warnings: 6');
      expect(items[5]).toBe('Unknown_b warnings: 5');
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
      expect(safetySection.items!.some((i) => i.includes('High warnings'))).toBe(true);
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
    it('orders actions by priority (safety first) with clean prefixes', () => {
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
      expect(actionsSection.heading).toBe('Top Fixes Checklist');

      expect(actionsSection.items).toBeDefined();
      // First action should have Safety: prefix (no brackets)
      expect(actionsSection.items![0]).toMatch(/^Safety:/);
      // No bracket-style prefixes
      for (const item of actionsSection.items!) {
        expect(item).not.toMatch(/^\[/);
      }
    });

    it('pads to minimum 3 actions with encouragement (no prefix)', () => {
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
      // Encouragement items have no prefix
      for (const item of actionsSection.items!) {
        expect(item).not.toMatch(/^Safety:|^Issue:|^Prompt health:|^Model fit:/);
      }
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
      expect(report.sections).toHaveLength(9);
      expect(report.summary).toContain('No prompts');
    });
  });

  describe('4.12 Top-level error → reflected in summary', () => {
    it('includes error context in summary when input.error exists', () => {
      const output = makeOutput({ error: 'Pipeline failed at store.' });
      const report = renderDemoReport(output, { now: fixedNow });

      expect(report.summary).toContain('issue');
      // Still produces all sections
      expect(report.sections).toHaveLength(10);
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

  describe('4.14 Summary coaching hook', () => {
    it('includes coaching hook when most_common_labels exists', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          most_common_labels: ['missing_context', 'unclear_task'],
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      expect(report.summary).toContain('Biggest coaching opportunity: Missing context.');
    });

    it('includes weak structure hook when avg score < 3 and no common labels', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          average_overall_score: 2.5,
          most_common_labels: [],
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      expect(report.summary).toContain('Your prompts need stronger structure before they scale.');
    });

    it('includes solid habits hook when avg >= 4 and no safety warnings and no common labels', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          average_overall_score: 4.2,
          most_common_labels: [],
          safety_summary: {
            prompts_with_warnings: 0,
            severity_counts: {},
            do_not_send_external_count: 0,
          },
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      expect(report.summary).toContain('Solid habits overall — now tighten the weak spots.');
    });

    it('prefers most_common_labels hook over score-based hooks', () => {
      const output = makeOutput({
        batch_summary: makeBatchSummary({
          average_overall_score: 2.0,
          most_common_labels: ['unclear_task'],
        }),
      });
      const report = renderDemoReport(output, { now: fixedNow });
      expect(report.summary).toContain('Biggest coaching opportunity: Unclear task.');
      expect(report.summary).not.toContain('stronger structure');
    });
  });

  describe('Copy polish verification — regression tests', () => {
    describe('Test 1 — summary humanizes most common issue', () => {
      it('shows human-readable issue label in summary, not raw key', () => {
        const output = makeOutput({
          batch_summary: makeBatchSummary({
            most_common_labels: ['missing_context'],
            issue_label_counts: { missing_context: 4 },
          }),
        });
        const report = renderDemoReport(output, { now: fixedNow });

        expect(report.summary).toContain('Most common issue: Missing context.');
        expect(report.summary).toContain('Biggest coaching opportunity: Missing context.');
        expect(report.summary).not.toContain('"missing_context"');
        expect(report.summary).not.toContain('Most common issue: "missing_context"');
      });
    });

    describe('Test 2 — next actions humanize issue labels', () => {
      it('uses human-readable issue labels in action text', () => {
        const output = makeOutput({
          batch_summary: makeBatchSummary({
            issue_label_counts: { missing_context: 5 },
            most_common_labels: ['missing_context'],
            // No safety to ensure issue action is visible
            safety_summary: {
              prompts_with_warnings: 0,
              severity_counts: {},
              do_not_send_external_count: 0,
            },
          }),
        });
        const report = renderDemoReport(output, { now: fixedNow });
        const actionsSection = report.sections.find((s) => s.kind === 'next_actions')!;
        const items = actionsSection.items!;

        // Should contain humanized label
        const issueItem = items.find((i) => i.startsWith('Issue:'));
        expect(issueItem).toBeDefined();
        expect(issueItem).toContain('Fix "Missing context"');

        // Should NOT contain raw key or bracketed prefix
        for (const item of items) {
          expect(item).not.toContain('missing_context');
          expect(item).not.toContain('[issue]');
        }
      });
    });

    describe('Test 3 — next actions humanize dimension labels', () => {
      it('uses human-readable dimension labels in action text', () => {
        const output = makeOutput({
          batch_summary: makeBatchSummary({
            // Low dimension score to trigger dimension action
            dimension_averages: { context: 2.0, clarity: 4.5 },
            // No safety, no issues to ensure dimension action is visible
            safety_summary: {
              prompts_with_warnings: 0,
              severity_counts: {},
              do_not_send_external_count: 0,
            },
            issue_label_counts: {},
            most_common_labels: [],
            model_class_distribution: {},
          }),
        });
        const report = renderDemoReport(output, { now: fixedNow });
        const actionsSection = report.sections.find((s) => s.kind === 'next_actions')!;
        const items = actionsSection.items!;

        // Should contain humanized dimension label
        const dimItem = items.find((i) => i.startsWith('Prompt health:'));
        expect(dimItem).toBeDefined();
        expect(dimItem).toContain('Improve Context & Background');

        // Should NOT contain raw patterns
        for (const item of items) {
          expect(item).not.toContain('"context" dimension');
          expect(item).not.toContain('[dimension]');
        }
      });
    });

    describe('Test 4 — partial fallback summary does not throw', () => {
      it('handles deliberately partial input without throwing', () => {
        const partial = {
          prompt_results: [],
        } as unknown as UnifiedDemoOutput;

        const report = renderDemoReport(partial, { now: fixedNow });

        expect(report.sections).toHaveLength(9);
        expect(report.summary).toContain('No prompts');
        expect(report.summary).not.toContain('undefined');
        expect(report.summary).not.toContain('Error');
        expect(report.summary).not.toContain('at ');
      });
    });

    describe('Test 5 — markdown avoids raw known labels', () => {
      it('markdown uses human labels, not raw identifiers', () => {
        const output = makeOutput({
          batch_summary: makeBatchSummary({
            most_common_labels: ['missing_context'],
            issue_label_counts: { missing_context: 4 },
            dimension_averages: {
              context: 2.5,
              output_format: 3.0,
              clarity: 4.0,
            },
          }),
        });
        const report = renderDemoReport(output, { now: fixedNow, include_markdown: true });
        const md = report.markdown!;

        // Should contain human-readable labels
        expect(md).toContain('Missing context');
        expect(md).toContain('Context & Background');
        expect(md).toContain('Output Format');

        // Should NOT contain raw identifiers in user-facing content
        expect(md).not.toContain('missing_context');
        expect(md).not.toContain('output_format');
        expect(md).not.toContain('[issue]');
        expect(md).not.toContain('[dimension]');
      });
    });
  });
});
