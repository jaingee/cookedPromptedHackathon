import { describe, it, expect } from 'vitest';
import { renderDemoReport } from '../../src/demo-report/index.js';
import type {
  UnifiedDemoOutput,
  BatchSummary,
  PipelineMetadata,
  PromptResult,
} from '../../src/integration-demo/types.js';
import type { PromptScore } from '../../src/scoring/types.js';

const FIXED_NOW = '2026-07-04T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;
const REDACTION_SECRET = ['sk', 'test1234567890'].join('-');

function makeBatchSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total_prompts: 4,
    succeeded: 4,
    failed: 0,
    average_overall_score: 1.8,
    dimension_averages: {
      clarity: 2.0,
      context: 1.8,
      constraints: 2.1,
      output_format: 1.9,
      capability_fit: 2.2,
      efficiency: 2.0,
      safety_privacy: 2.5,
    },
    issue_label_counts: {
      missing_context: 2,
      missing_output_format: 1,
      too_long_for_task: 1,
    },
    most_common_labels: ['missing_context'],
    safety_summary: {
      prompts_with_warnings: 1,
      severity_counts: { medium: 1 },
      do_not_send_external_count: 0,
    },
    model_class_distribution: { balanced_general: 4 },
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
    prompt_log_id: 'p-001',
    do_not_send_external: false,
    prompt_text: 'Write a better prompt.',
    score: {
      id: 'score-p-001',
      prompt_log_id: 'p-001',
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

describe('prompt example sections', () => {
  it('renders the prompt examples section when prompt text is available', () => {
    const prompt_results = [
      makePromptResult({
        prompt_log_id: 'p-001',
        prompt_text:
          `Use api key ${REDACTION_SECRET}, password=secret123, customer_id: acme-42, and email alice@example.com while drafting the request.`,
        score: {
          id: 'score-p-001',
          prompt_log_id: 'p-001',
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
        prompt_log_id: 'p-002',
        prompt_text: 'Return JSON with three fields.',
        score: {
          id: 'score-p-002',
          prompt_log_id: 'p-002',
          overall_score: 1,
          clarity_score: 1,
          context_score: 1,
          constraints_score: 1,
          output_format_score: 1,
          capability_fit_score: 1,
          efficiency_score: 1,
          safety_privacy_score: 1,
          issue_labels: ['missing_output_format'],
          explanations: ['Output format is missing'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
      makePromptResult({
        prompt_log_id: 'p-003',
        prompt_text: 'Keep this short.',
        score: {
          id: 'score-p-003',
          prompt_log_id: 'p-003',
          overall_score: 1,
          clarity_score: 1,
          context_score: 1,
          constraints_score: 1,
          output_format_score: 1,
          capability_fit_score: 1,
          efficiency_score: 1,
          safety_privacy_score: 1,
          issue_labels: ['too_long_for_task'],
          explanations: ['Too much filler'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
    ];

    const report = renderDemoReport(makeOutput({ prompt_results }), {
      now: fixedNow,
      include_markdown: true,
    });
    const section = report.sections.find((entry) => entry.kind === 'prompt_examples');

    expect(section).toBeDefined();
    expect(section!.prompt_example_cards).toHaveLength(3);
    expect(section!.prompt_example_cards![0].top_issue_labels[0]).toBe('Missing context');
    expect(section!.prompt_example_cards![1].top_issue_labels[0]).toBe('Missing output format');
    expect(section!.prompt_example_cards![2].top_issue_labels[0]).toBe('Too long for task');
    expect(section!.prompt_example_cards![0].prompt_excerpt).toContain('[REDACTED_SECRET]');
    expect(section!.prompt_example_cards![0].prompt_excerpt).toContain('[REDACTED_PASSWORD]');
    expect(section!.prompt_example_cards![0].prompt_excerpt).toContain('[REDACTED_PERSONAL_DATA]');
    expect(section!.prompt_example_cards![0].prompt_excerpt).not.toContain(REDACTION_SECRET);
    expect(section!.prompt_example_cards![0].prompt_excerpt).not.toContain('secret123');
    expect(section!.prompt_example_cards![0].prompt_excerpt).not.toContain('alice@example.com');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('I need help with [task].');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Context:');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Output format:');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Safety and privacy:');
    expect(section!.prompt_example_cards![0].improved_prompt).not.toContain(REDACTION_SECRET);
    expect(section!.prompt_example_cards![0].why_it_works).toContain('clear task');
    expect(report.markdown).toContain('## Prompt Examples');
    expect(report.markdown).toContain('```text');
    expect(report.markdown).toContain('**A stronger version**');
    expect(report.markdown).toContain('**Why this works**');
  });

  it('prefers different primary issues before duplicates and stays deterministic', () => {
    const prompt_results = [
      makePromptResult({
        prompt_log_id: 'p-001',
        prompt_text: 'First weak prompt.',
        score: {
          id: 'score-p-001',
          prompt_log_id: 'p-001',
          overall_score: 1,
          clarity_score: 1,
          context_score: 1,
          constraints_score: 1,
          output_format_score: 1,
          capability_fit_score: 1,
          efficiency_score: 1,
          safety_privacy_score: 1,
          issue_labels: ['missing_context', 'missing_constraints'],
          explanations: ['Needs context'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
      makePromptResult({
        prompt_log_id: 'p-002',
        prompt_text: 'Second weak prompt.',
        score: {
          id: 'score-p-002',
          prompt_log_id: 'p-002',
          overall_score: 1,
          clarity_score: 1,
          context_score: 1,
          constraints_score: 1,
          output_format_score: 1,
          capability_fit_score: 1,
          efficiency_score: 1,
          safety_privacy_score: 1,
          issue_labels: ['missing_context'],
          explanations: ['Needs context'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
      makePromptResult({
        prompt_log_id: 'p-003',
        prompt_text: 'Third weak prompt.',
        score: {
          id: 'score-p-003',
          prompt_log_id: 'p-003',
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
      makePromptResult({
        prompt_log_id: 'p-004',
        prompt_text: 'Fourth weak prompt.',
        score: {
          id: 'score-p-004',
          prompt_log_id: 'p-004',
          overall_score: 1,
          clarity_score: 1,
          context_score: 1,
          constraints_score: 1,
          output_format_score: 1,
          capability_fit_score: 1,
          efficiency_score: 1,
          safety_privacy_score: 1,
          issue_labels: ['too_long_for_task'],
          explanations: ['Too long'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
    ];

    const output = makeOutput({ prompt_results });
    const first = renderDemoReport(output, { now: fixedNow });
    const second = renderDemoReport(output, { now: fixedNow });
    const section = first.sections.find((entry) => entry.kind === 'prompt_examples');

    expect(section).toBeDefined();
    expect(section!.prompt_example_cards).toHaveLength(3);
    expect(section!.prompt_example_cards!.map((card) => card.top_issue_labels[0])).toEqual([
      'Missing context',
      'Too long for task',
      'Missing output format',
    ]);
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Context:');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Please focus on [success criteria].');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('withholds over-redacted excerpts when the helper falls back', () => {
    const output = makeOutput({
      prompt_results: [
        makePromptResult({
          prompt_log_id: 'p-001',
        prompt_text: `${REDACTION_SECRET} password=abc123 customer_id: acme-42 alice@example.com`,
          score: {
            id: 'score-p-001',
            prompt_log_id: 'p-001',
            overall_score: 1,
            clarity_score: 1,
            context_score: 1,
            constraints_score: 1,
            output_format_score: 1,
            capability_fit_score: 1,
            efficiency_score: 1,
            safety_privacy_score: 1,
            issue_labels: ['missing_context'],
            explanations: ['Needs context'],
            confidence: 'medium',
            scoring_version: 'v1',
            scored_at: FIXED_NOW,
          } as PromptScore,
        }),
      ],
    });

    const report = renderDemoReport(output, { now: fixedNow });
    const section = report.sections.find((entry) => entry.kind === 'prompt_examples');

    expect(section).toBeDefined();
    expect(section!.prompt_example_cards![0].prompt_excerpt).toBe(
      '[Prompt excerpt withheld after redaction]',
    );
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('I need help with [task].');
    expect(section!.prompt_example_cards![0].improved_prompt).toContain('Output format:');
  });

  it('omits the prompt examples section when no prompt text is available', () => {
    const output = makeOutput({
      prompt_results: [
        makePromptResult({
          prompt_log_id: 'p-001',
          prompt_text: undefined,
        }),
      ],
    });

    const report = renderDemoReport(output, { now: fixedNow });
    expect(report.sections.some((entry) => entry.kind === 'prompt_examples')).toBe(false);
  });

  it('renders roast and copy-worthy sections with distinct candidates when possible', () => {
    const prompt_results = [
      makePromptResult({
        prompt_log_id: 'p-roast',
        prompt_text: 'Explain what this feature does.',
        score: {
          id: 'score-p-roast',
          prompt_log_id: 'p-roast',
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
        prompt_log_id: 'p-copy',
        prompt_text: 'Write a concise three-bullet summary with a title and next steps.',
        score: {
          id: 'score-p-copy',
          prompt_log_id: 'p-copy',
          overall_score: 5,
          clarity_score: 5,
          context_score: 5,
          constraints_score: 5,
          output_format_score: 5,
          capability_fit_score: 5,
          efficiency_score: 5,
          safety_privacy_score: 5,
          issue_labels: [],
          explanations: [],
          confidence: 'high',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
      makePromptResult({
        prompt_log_id: 'p-middle',
        prompt_text: 'Return JSON with three fields and keep it short.',
        score: {
          id: 'score-p-middle',
          prompt_log_id: 'p-middle',
          overall_score: 2,
          clarity_score: 2,
          context_score: 2,
          constraints_score: 2,
          output_format_score: 2,
          capability_fit_score: 2,
          efficiency_score: 2,
          safety_privacy_score: 2,
          issue_labels: ['missing_output_format'],
          explanations: ['Needs format'],
          confidence: 'medium',
          scoring_version: 'v1',
          scored_at: FIXED_NOW,
        } as PromptScore,
      }),
    ];

    const report = renderDemoReport(makeOutput({ prompt_results }), { now: fixedNow });
    const roast = report.sections.find((entry) => entry.kind === 'roast_of_the_batch');
    const copy = report.sections.find((entry) => entry.kind === 'copy_worthy_prompt');

    expect(roast).toBeDefined();
    expect(copy).toBeDefined();
    expect(roast!.roast_line).toBeDefined();
    expect(roast!.coaching_reason).toBeDefined();
    expect(copy!.prompt_excerpt).toContain('Write a concise three-bullet summary');
    expect(copy!.why_it_works).toContain('enough context');
    expect(copy!.copy_pattern).toContain('Task + context + constraints + output format');
    expect(roast!.prompt_excerpt).not.toBe(copy!.prompt_excerpt);
    expect(report.markdown).toContain('## Roast of the Batch');
    expect(report.markdown).toContain('## One Good Prompt Worth Copying');
    expect(report.markdown).toContain('**Pattern to copy**');
  });
});
