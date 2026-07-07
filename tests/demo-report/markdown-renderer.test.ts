import { describe, it, expect } from 'vitest';
import {
  renderDemoReport,
  renderReportMarkdown,
  DEFAULT_DEMO_REPORT_TITLE,
  DEMO_REPORT_RENDERER_VERSION,
} from '../../src/demo-report/index.js';
import type { UnifiedDemoOutput, BatchSummary, PipelineMetadata, PromptResult } from '../../src/integration-demo/types.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult } from '../../src/safety/types.js';
import type { ModelRecommendation } from '../../src/model-recommendation/types.js';
import type { RewriteSuggestion, TemplateSuggestion } from '../../src/rewrite-template/types.js';

const FIXED_NOW = '2026-07-04T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;
const REDACTION_SECRET = ['sk', 'test1234567890'].join('-');

function makeBatchSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total_prompts: 3,
    succeeded: 3,
    failed: 0,
    average_overall_score: 3.8,
    dimension_averages: { clarity: 4.0, context: 3.5 },
    issue_label_counts: { missing_context: 2 },
    most_common_labels: ['missing_context'],
    safety_summary: {
      prompts_with_warnings: 0,
      severity_counts: {},
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
    prompt_log_id: 'md-prompt-001',
    do_not_send_external: false,
    score: {
      id: 'score-md-001',
      prompt_log_id: 'md-prompt-001',
      overall_score: 4,
      clarity_score: 4,
      context_score: 3,
      constraints_score: 4,
      output_format_score: 4,
      capability_fit_score: 4,
      efficiency_score: 4,
      safety_privacy_score: 5,
      issue_labels: [],
      explanations: [],
      confidence: 'high',
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

describe('renderReportMarkdown', () => {
  it('starts with h1 title matching report title', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    expect(md.startsWith(`# ${DEFAULT_DEMO_REPORT_TITLE}`)).toBe(true);
  });

  it('has h2 section headings for all 9 sections', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    const h2Matches = md.match(/^## .+$/gm);
    expect(h2Matches).not.toBeNull();
    expect(h2Matches!.length).toBe(9);

    // Verify expected headings are present
    expect(md).toContain('## Batch Verdict');
    expect(md).toContain('## Prompt Habit Score');
    expect(md).toContain('## Category Scorecard');
    expect(md).toContain('## What Kept Hurting Results');
    expect(md).toContain('## Safety & Privacy');
    expect(md).toContain('## Model Recommendations');
    expect(md).toContain('## Rewrite & Template Coaching');
    expect(md).toContain('## Top Fixes Checklist');
    expect(md).toContain('## Limitations');
  });

  it('renders score and category scorecard lines as markdown bullets, not raw JSON', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    expect(md).toContain('- **Score**: 76 / 100');
    expect(md).toContain('- **Band**: Good');
    expect(md).toContain('- **Clarity**: 80 / 100 (Good)');
    expect(md).toContain('- **Context**: 70 / 100 (Good)');
  });

  it('renders prompt example cards as readable markdown with redacted excerpts', () => {
    const prompt_results: PromptResult[] = [
      makePromptResult({
        prompt_log_id: 'md-ex-001',
        prompt_text:
          `Use api key ${REDACTION_SECRET} and password=secret123 while keeping customer_id: acme-42 and email alice@example.com out of the prompt.`,
        score: {
          id: 'score-md-ex-001',
          prompt_log_id: 'md-ex-001',
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
        prompt_log_id: 'md-ex-002',
        prompt_text: 'Return JSON with three fields.',
        score: {
          id: 'score-md-ex-002',
          prompt_log_id: 'md-ex-002',
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
    const report = renderDemoReport(makeOutput({ prompt_results }), { now: fixedNow });
    const md = report.markdown!;

    expect(md).toContain('## Prompt Examples');
    expect(md).toContain('### Example 1 — Missing context');
    expect(md).toContain('**Original prompt excerpt**');
    expect(md).toContain('```text');
    expect(md).toContain('[REDACTED_SECRET]');
    expect(md).toContain('[REDACTED_PASSWORD]');
    expect(md).toContain('**A stronger version**');
    expect(md).toContain('**Why this works**');
    expect(md).not.toContain(REDACTION_SECRET);
    expect(md).not.toContain('secret123');
  });

  it('renders roast and copy-worthy coaching sections in markdown', () => {
    const prompt_results: PromptResult[] = [
      makePromptResult({
        prompt_log_id: 'md-roast-001',
        prompt_text: 'Explain what this feature does.',
        score: {
          id: 'score-md-roast-001',
          prompt_log_id: 'md-roast-001',
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
        prompt_log_id: 'md-copy-001',
        prompt_text: 'Write a concise three-bullet summary with a title and next steps.',
        score: {
          id: 'score-md-copy-001',
          prompt_log_id: 'md-copy-001',
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
    ];
    const report = renderDemoReport(makeOutput({ prompt_results }), { now: fixedNow });
    const md = report.markdown!;

    expect(md).toContain('## Roast of the Batch');
    expect(md).toContain('## One Good Prompt Worth Copying');
    expect(md).toContain('> This prompt showed up wearing a name tag and no instructions.');
    expect(md).toContain('**Why this one hurt**');
    expect(md).toContain('**Pattern to copy**');
    expect(md).toContain('Task + context + constraints + output format');
  });

  it('renders model waste and safety lessons sections in markdown', () => {
    const prompt_results: PromptResult[] = [
      makePromptResult({
        prompt_log_id: 'md-safety-001',
        prompt_text:
          `Use api key ${REDACTION_SECRET} and password=secret123 while keeping host service.internal.local and customer_id acme-42 out of the prompt.`,
      }),
    ];
    const report = renderDemoReport(
      makeOutput({
        prompt_results,
        batch_summary: makeBatchSummary({
          issue_label_counts: {
            overpowered_model: 2,
            needs_search: 1,
          },
          safety_summary: {
            prompts_with_warnings: 2,
            severity_counts: { critical: 1, high: 1 },
            do_not_send_external_count: 1,
          },
          model_class_distribution: { frontier_reasoning: 3, balanced_general: 1 },
        }),
      }),
      { now: fixedNow },
    );
    const md = report.markdown!;

    expect(md).toContain('## Model Waste / Overkill');
    expect(md).toContain('## Safety & Privacy Lessons');
    expect(md).toContain('- **Overkill**: 2');
    expect(md).toContain('- **Underfit**: 1');
    expect(md).toContain('[REDACTED_SECRET]');
    expect(md).toContain('[REDACTED_INTERNAL_HOST]');
    expect(md).not.toContain(REDACTION_SECRET);
    expect(md).not.toContain('secret123');
  });

  it('does not contain raw JSON objects', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    // No raw JSON object patterns
    expect(md).not.toMatch(/\{[^}]*"[^"]+"\s*:/);
    // No array brackets that look like JSON arrays
    expect(md).not.toMatch(/\[\s*\{/);
  });

  it('is deterministic — same input produces same output', () => {
    const input = makeOutput();
    const report1 = renderDemoReport(input, { now: fixedNow });
    const report2 = renderDemoReport(input, { now: fixedNow });

    expect(report1.markdown).toBe(report2.markdown);
  });

  it('includes renderer version in footer', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    expect(md).toContain(DEMO_REPORT_RENDERER_VERSION);
  });

  it('includes generated_at timestamp in footer', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    expect(md).toContain(FIXED_NOW);
  });

  it('renderReportMarkdown directly produces same result as embedded markdown', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow, include_markdown: false });
    const directMd = renderReportMarkdown(report);
    const reportWithMd = renderDemoReport(makeOutput(), { now: fixedNow, include_markdown: true });

    expect(directMd).toBe(reportWithMd.markdown);
  });
});
