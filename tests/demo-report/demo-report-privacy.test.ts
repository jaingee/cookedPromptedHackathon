import { describe, it, expect, vi } from 'vitest';
import { renderDemoReport } from '../../src/demo-report/index.js';
import type { UnifiedDemoOutput, BatchSummary, PipelineMetadata, PromptResult } from '../../src/integration-demo/types.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult } from '../../src/safety/types.js';
import type { ModelRecommendation } from '../../src/model-recommendation/types.js';
import type { RewriteSuggestion, TemplateSuggestion } from '../../src/rewrite-template/types.js';

const FIXED_NOW = '2026-07-04T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;
const REDACTION_SECRET = ['sk', 'test1234567890'].join('-');

const SENTINEL_PROMPT_TEXT_DO_NOT_LEAK = 'SENTINEL_PROMPT_TEXT_DO_NOT_LEAK_xK9mZ2pQ';
const SENTINEL_SECRET_VALUE_DO_NOT_LEAK = 'SENTINEL_SECRET_VALUE_DO_NOT_LEAK_Qw3rTy9X';

/** Banned field keys that must never appear at any nesting level. */
const BANNED_FIELD_KEYS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
  'template_body',
];

/**
 * Recursively collect all keys from an object/array structure.
 */
function recursiveKeys(obj: unknown, keys: Set<string> = new Set()): Set<string> {
  if (obj === null || obj === undefined) return keys;
  if (Array.isArray(obj)) {
    for (const item of obj) recursiveKeys(item, keys);
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      keys.add(key);
      recursiveKeys((obj as Record<string, unknown>)[key], keys);
    }
  }
  return keys;
}

// --- Fixture helpers ---

function makeBatchSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total_prompts: 3,
    succeeded: 3,
    failed: 0,
    average_overall_score: 3.5,
    dimension_averages: { clarity: 4.0, context: 3.0 },
    issue_label_counts: { missing_context: 2 },
    most_common_labels: ['missing_context'],
    safety_summary: {
      prompts_with_warnings: 1,
      severity_counts: { medium: 1 },
      do_not_send_external_count: 0,
    },
    model_class_distribution: { balanced_general: 3 },
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<PipelineMetadata> = {}): PipelineMetadata {
  return {
    orchestrator_version: 'test-v1',
    engines_used: { scoring: 'v1' },
    pipeline_started_at: '2026-07-04T11:59:00.000Z',
    pipeline_completed_at: FIXED_NOW,
    total_duration_ms: 5000,
    input_source: 'test',
    ...overrides,
  };
}

function makePromptResult(overrides: Partial<PromptResult> = {}): PromptResult {
  return {
    prompt_log_id: 'priv-prompt-001',
    do_not_send_external: false,
    score: {
      id: 'score-priv-001',
      prompt_log_id: 'priv-prompt-001',
      overall_score: 3,
      clarity_score: 3,
      context_score: 3,
      constraints_score: 3,
      output_format_score: 3,
      capability_fit_score: 3,
      efficiency_score: 3,
      safety_privacy_score: 3,
      issue_labels: ['missing_context'],
      explanations: ['Needs more context'],
      confidence: 'medium',
      scoring_version: 'v1',
      scored_at: FIXED_NOW,
    } as PromptScore,
    safety_result: {
      prompt_log_id: 'priv-prompt-001',
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
      prompt_log_id: 'priv-prompt-001',
      guidance_items: [],
      overall_severity: 'medium',
      overall_priority: 1,
      summary: 'test rewrite',
      engine_version: 'v1',
      created_at: FIXED_NOW,
    } as RewriteSuggestion,
    template_suggestion: {
      prompt_log_id: 'priv-prompt-001',
      suggested_templates: [
        {
          template_id: 'tmpl-priv-001',
          template_name: 'Test Template',
          template_body: SENTINEL_SECRET_VALUE_DO_NOT_LEAK,
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

describe('Demo Report Privacy Verification', () => {
  describe('4.14 No prompt_text sentinel in output', () => {
    it('prompt_text sentinel does not appear in JSON report with default options', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });

    it('prompt_text sentinel does not appear even with include_prompt_text: true', () => {
      const report = renderDemoReport(makeOutput(), {
        now: fixedNow,
        include_prompt_text: true,
      });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });

    it('prompt_text sentinel absent from markdown output', () => {
      const report = renderDemoReport(makeOutput(), {
        now: fixedNow,
        include_markdown: true,
        include_prompt_text: true,
      });
      expect(report.markdown).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });
  });

  describe('4.15 No banned field keys (recursive scan)', () => {
    it('recursive key scan finds no banned keys in report', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const allKeys = recursiveKeys(report);

      for (const banned of BANNED_FIELD_KEYS) {
        expect(allKeys.has(banned)).toBe(false);
      }
    });

    it('banned field names do not appear as JSON property names in serialized output', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const serialized = JSON.stringify(report);

      for (const banned of BANNED_FIELD_KEYS) {
        expect(serialized).not.toContain(`"${banned}"`);
      }
    });

    it('banned fields absent even with include_prompt_text: true', () => {
      const report = renderDemoReport(makeOutput(), {
        now: fixedNow,
        include_prompt_text: true,
      });
      const allKeys = recursiveKeys(report);

      for (const banned of BANNED_FIELD_KEYS) {
        expect(allKeys.has(banned)).toBe(false);
      }
    });
  });

  describe('4.16 No secret sentinels in output', () => {
    it('secret sentinel in template body does not leak to report', () => {
      const report = renderDemoReport(makeOutput(), { now: fixedNow });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(SENTINEL_SECRET_VALUE_DO_NOT_LEAK);
    });

    it('prompt examples stay redacted even when prompt text is available', () => {
      const report = renderDemoReport(
        makeOutput({
          prompt_results: [
            makePromptResult({
              prompt_log_id: 'priv-example-001',
              prompt_text:
                `Use api key ${REDACTION_SECRET}, password=secret123, and customer_id: acme-42 for alice@example.com.`,
            }),
          ],
        }),
        { now: fixedNow, include_markdown: true },
      );

      const exampleSection = report.sections.find((entry) => entry.kind === 'prompt_examples');
      expect(exampleSection).toBeDefined();
      expect(exampleSection!.prompt_example_cards).toHaveLength(1);
      expect(exampleSection!.prompt_example_cards![0].prompt_excerpt).toBe(
        '[Prompt excerpt withheld after redaction]',
      );
      expect(exampleSection!.prompt_example_cards![0].prompt_excerpt).not.toContain(REDACTION_SECRET);
      expect(exampleSection!.prompt_example_cards![0].prompt_excerpt).not.toContain('secret123');
      expect(exampleSection!.prompt_example_cards![0].prompt_excerpt).not.toContain('acme-42');
      expect(exampleSection!.prompt_example_cards![0].prompt_excerpt).not.toContain('alice@example.com');
      expect(report.markdown).toContain('## Prompt Examples');
      expect(report.markdown).toContain('[Prompt excerpt withheld after redaction]');
      expect(report.markdown).not.toContain(REDACTION_SECRET);
      expect(report.markdown).not.toContain('secret123');
    });

    it('safety lessons use placeholders, not raw sensitive values', () => {
      const report = renderDemoReport(
        makeOutput({
          batch_summary: makeBatchSummary({
            safety_summary: {
              prompts_with_warnings: 2,
              severity_counts: { critical: 1 },
              do_not_send_external_count: 1,
            },
          }),
          prompt_results: [
            makePromptResult({
              prompt_log_id: 'priv-lesson-001',
              prompt_text:
                `Use api key ${REDACTION_SECRET}, password=secret123, and host service.internal.local for customer acme-42 and alice@example.com.`,
            }),
          ],
        }),
        { now: fixedNow, include_markdown: true },
      );

      const lessonSection = report.sections.find((entry) => entry.kind === 'safety_privacy_lessons');
      expect(lessonSection).toBeDefined();
      expect(lessonSection!.placeholder_examples).toContain('[REDACTED_SECRET] x1');
      expect(lessonSection!.placeholder_examples).toContain('[REDACTED_PASSWORD] x1');
      expect(lessonSection!.placeholder_examples).toContain('[REDACTED_INTERNAL_HOST] x1');
      expect(JSON.stringify(lessonSection)).not.toContain(REDACTION_SECRET);
      expect(JSON.stringify(lessonSection)).not.toContain('secret123');
      expect(JSON.stringify(lessonSection)).not.toContain('service.internal.local');
      expect(JSON.stringify(lessonSection)).not.toContain('acme-42');
      expect(report.markdown).toContain('## Safety & Privacy Lessons');
      expect(report.markdown).toContain('[REDACTED_SECRET]');
      expect(report.markdown).not.toContain(REDACTION_SECRET);
      expect(report.markdown).not.toContain('secret123');
    });

    it('secret sentinel in error field does not leak', () => {
      const output = makeOutput({ error: SENTINEL_SECRET_VALUE_DO_NOT_LEAK });
      const report = renderDemoReport(output, { now: fixedNow });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(SENTINEL_SECRET_VALUE_DO_NOT_LEAK);
    });

    it('prompt_text sentinel can appear in local prompt examples', () => {
      const results = [
        makePromptResult({ prompt_log_id: 'priv-001', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
        makePromptResult({ prompt_log_id: 'priv-002', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
        makePromptResult({ prompt_log_id: 'priv-003', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const output = makeOutput({ prompt_results: results });
      const report = renderDemoReport(output, { now: fixedNow });
      const serialized = JSON.stringify(report);
      expect(serialized).toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });

    it('safety warning message sentinel does not leak into report', () => {
      const SENTINEL_MATCHED = 'SENTINEL_MATCHED_SECRET_DO_NOT_LEAK_A1b2C3';
      const results = [
        makePromptResult({
          prompt_log_id: 'priv-matched-001',
          safety_result: {
            prompt_log_id: 'priv-matched-001',
            warnings: [
              {
                id: 'warn-matched-001',
                category: 'secret_like',
                severity: 'critical',
                confidence: 'high',
                message: SENTINEL_MATCHED,
                scanner_version: 'v1',
                created_at: FIXED_NOW,
              },
            ],
            highest_severity: 'critical',
            scanner_version: 'v1',
            scanned_at: FIXED_NOW,
          } as SafetyScanResult,
        }),
      ];
      const output = makeOutput({ prompt_results: results });
      const report = renderDemoReport(output, { now: fixedNow });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(SENTINEL_MATCHED);
      if (report.markdown) {
        expect(report.markdown).not.toContain(SENTINEL_MATCHED);
      }
    });
  });

  describe('4.17 No fetch calls', () => {
    it('renderDemoReport does not call globalThis.fetch', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
      renderDemoReport(makeOutput(), { now: fixedNow });
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('no network calls with include_prompt_text: true', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
      renderDemoReport(makeOutput(), { now: fixedNow, include_prompt_text: true });
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('4.18 No input mutation', () => {
    it('does not mutate the input UnifiedDemoOutput', () => {
      const input = makeOutput();
      const inputSnapshot = JSON.stringify(input);

      renderDemoReport(input, { now: fixedNow });

      expect(JSON.stringify(input)).toBe(inputSnapshot);
    });

    it('does not mutate prompt_results array', () => {
      const results = [
        makePromptResult({ prompt_log_id: 'mut-001' }),
        makePromptResult({ prompt_log_id: 'mut-002' }),
      ];
      const input = makeOutput({ prompt_results: results });
      const originalLength = input.prompt_results.length;
      const originalIds = input.prompt_results.map((r) => r.prompt_log_id);

      renderDemoReport(input, { now: fixedNow });

      expect(input.prompt_results.length).toBe(originalLength);
      expect(input.prompt_results.map((r) => r.prompt_log_id)).toEqual(originalIds);
    });

    it('does not mutate batch_summary', () => {
      const input = makeOutput();
      const summarySnapshot = JSON.stringify(input.batch_summary);

      renderDemoReport(input, { now: fixedNow });

      expect(JSON.stringify(input.batch_summary)).toBe(summarySnapshot);
    });
  });
});
