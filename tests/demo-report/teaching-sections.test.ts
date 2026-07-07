import { describe, it, expect } from 'vitest';
import {
  buildModelWaste,
  buildSafetyPrivacyLessons,
} from '../../src/demo-report/section-builders.js';
import type { BatchSummary, PromptResult } from '../../src/integration-demo/types.js';
const REDACTION_SECRET = ['sk', 'test1234567890'].join('-');

function makeBatchSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total_prompts: 4,
    succeeded: 4,
    failed: 0,
    average_overall_score: 3.2,
    dimension_averages: {},
    issue_label_counts: {},
    most_common_labels: [],
    safety_summary: {
      prompts_with_warnings: 0,
      severity_counts: {},
      do_not_send_external_count: 0,
    },
    model_class_distribution: { balanced_general: 4 },
    ...overrides,
  };
}

function makePromptResult(overrides: Partial<PromptResult> = {}): PromptResult {
  return {
    prompt_log_id: 'teach-001',
    do_not_send_external: false,
    ...overrides,
  };
}

describe('teaching sections', () => {
  it('builds a model waste section from model-fit issue counts', () => {
    const section = buildModelWaste(
      makeBatchSummary({
        issue_label_counts: {
          overpowered_model: 2,
          wrong_model_class: 1,
          needs_search: 1,
          needs_tool_use: 3,
        },
        model_class_distribution: {
          frontier_reasoning: 3,
          balanced_general: 1,
        },
      }),
    );

    expect(section).not.toBeNull();
    expect(section!.kind).toBe('model_waste');
    expect(section!.overkill_count).toBe(3);
    expect(section!.underfit_count).toBe(4);
    expect(section!.teaching_points).toBeDefined();
    expect(section!.teaching_points!.some((item) => item.includes('model power'))).toBe(true);
    expect(section!.example_hints).toBeDefined();
    expect(section!.coaching_summary).toContain('overkill');
    expect(JSON.stringify(section)).not.toContain('$');
  });

  it('omits the model waste section when there are no relevant signals', () => {
    const section = buildModelWaste(makeBatchSummary());
    expect(section).toBeNull();
  });

  it('builds safety/privacy lessons from warnings and redacted prompt content', () => {
    const section = buildSafetyPrivacyLessons(
      makeBatchSummary({
        safety_summary: {
          prompts_with_warnings: 2,
          severity_counts: { critical: 1, high: 1 },
          do_not_send_external_count: 1,
        },
      }),
      [
        makePromptResult({
          prompt_text:
            `Use api key ${REDACTION_SECRET}, password=secret123, host service.internal.local, customer_id acme-42, and email alice@example.com.`,
        }),
      ],
    );

    expect(section).not.toBeNull();
    expect(section!.kind).toBe('safety_privacy_lessons');
    expect(section!.risk_category_counts).toBeDefined();
    expect(section!.risk_category_counts![0].category).toBe('Critical safety warnings');
    expect(section!.placeholder_examples).toContain('[REDACTED_SECRET] x1');
    expect(section!.placeholder_examples).toContain('[REDACTED_PASSWORD] x1');
    expect(section!.placeholder_examples).toContain('[REDACTED_INTERNAL_HOST] x1');
    expect(section!.lesson_items!.join(' ')).toContain('[REDACTED_SECRET]');
    expect(section!.lesson_items!.join(' ')).not.toContain('secret123');
    expect(section!.lesson_items!.join(' ')).not.toContain('acme-42');
    expect(section!.coaching_summary).toContain('redaction-worthy');
  });

  it('omits safety/privacy lessons when there are no warnings or prompt content', () => {
    const section = buildSafetyPrivacyLessons(makeBatchSummary(), [makePromptResult()]);
    expect(section).toBeNull();
  });
});
