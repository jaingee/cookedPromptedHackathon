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

  it('has h2 section headings for all 8 sections', () => {
    const report = renderDemoReport(makeOutput(), { now: fixedNow });
    const md = report.markdown!;

    const h2Matches = md.match(/^## .+$/gm);
    expect(h2Matches).not.toBeNull();
    expect(h2Matches!.length).toBe(8);

    // Verify expected headings are present
    expect(md).toContain('## Batch Overview');
    expect(md).toContain('## Prompt Health');
    expect(md).toContain('## Issue Patterns');
    expect(md).toContain('## Safety & Privacy');
    expect(md).toContain('## Model Recommendations');
    expect(md).toContain('## Rewrite & Template Coaching');
    expect(md).toContain('## Next Actions');
    expect(md).toContain('## Limitations');
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
