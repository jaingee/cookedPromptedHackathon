import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runIntegrationDemo } from '../../src/integration-demo/index.js';
import type { DemoInput, PipelineOptions, PromptResult, UnifiedDemoOutput } from '../../src/integration-demo/index.js';
import type { PromptLogEntry } from '../../src/importers/local/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';
let idSeq = 0;
const fixedId = () => { idSeq += 1; return `test-id-${idSeq}`; };

beforeEach(() => {
  idSeq = 0;
});

function makeEntry(overrides: Partial<PromptLogEntry> = {}): PromptLogEntry {
  return {
    id: 'entry-001',
    import_batch_id: 'batch-001',
    prompt_text: 'Write a function that sorts an array.',
    prompt_hash: 'hash-001',
    source: 'test',
    provider: 'test-provider',
    model_used: 'test-model',
    timestamp: '2026-07-01T00:00:00.000Z',
    session_id: null,
    follow_up_index: null,
    parent_prompt_id: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: null,
    estimated_cost: null,
    latency_ms: null,
    solved_status: null,
    user_rating: null,
    tags: [],
    redaction_status: null,
    ...overrides,
  };
}

const SENTINEL_PROMPT_TEXT_DO_NOT_LEAK = 'SENTINEL_PROMPT_TEXT_DO_NOT_LEAK_xK9mZ2pQ';

describe('Integration Demo Orchestrator', () => {
  describe('4.1 Demo mode', () => {
    it('runs full pipeline on demo dataset and produces valid UnifiedDemoOutput', async () => {
      const result = await runIntegrationDemo({ mode: 'demo' });

      expect(result).toBeDefined();
      expect(result.prompt_results).toBeDefined();
      expect(Array.isArray(result.prompt_results)).toBe(true);
      expect(result.prompt_results.length).toBeGreaterThan(0);
      expect(result.batch_summary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('demo mode produces results with all pipeline stages', async () => {
      const result = await runIntegrationDemo({ mode: 'demo' });

      // At least some results should have all pipeline stages completed
      const successfulResults = result.prompt_results.filter((r) => !r.error);
      expect(successfulResults.length).toBeGreaterThan(0);

      for (const r of successfulResults) {
        expect(r.score).toBeDefined();
        expect(r.safety_result).toBeDefined();
        expect(r.model_recommendation).toBeDefined();
        expect(r.rewrite_suggestion).toBeDefined();
        expect(r.template_suggestion).toBeDefined();
      }
    });

    it('demo mode metadata has input_source "demo"', async () => {
      const result = await runIntegrationDemo({ mode: 'demo' });
      expect(result.metadata.input_source).toBe('demo');
    });
  });

  describe('4.2 Entries mode', () => {
    it('accepts a single entry and produces full pipeline success', async () => {
      const entry = makeEntry();
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [entry] },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeUndefined();
      expect(result.prompt_results).toHaveLength(1);
      expect(result.prompt_results[0].prompt_log_id).toBe('entry-001');
      expect(result.prompt_results[0].error).toBeUndefined();
      expect(result.prompt_results[0].score).toBeDefined();
      expect(result.prompt_results[0].safety_result).toBeDefined();
      expect(result.prompt_results[0].model_recommendation).toBeDefined();
      expect(result.prompt_results[0].rewrite_suggestion).toBeDefined();
      expect(result.prompt_results[0].template_suggestion).toBeDefined();
    });

    it('accepts multiple entries with same batch ID', async () => {
      const entries = [
        makeEntry({ id: 'e1', prompt_text: 'Explain closures in JavaScript.' }),
        makeEntry({ id: 'e2', prompt_text: 'Write a sort function.' }),
        makeEntry({ id: 'e3', prompt_text: 'What is a monad?' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeUndefined();
      expect(result.prompt_results).toHaveLength(3);
    });

    it('mismatched batch IDs produce top-level error and empty prompt_results', async () => {
      const entries = [
        makeEntry({ id: 'e1', import_batch_id: 'batch-A' }),
        makeEntry({ id: 'e2', import_batch_id: 'batch-B' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeDefined();
      expect(result.prompt_results).toHaveLength(0);
    });

    it('empty entries array produces zero results and no error', async () => {
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [] },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeUndefined();
      expect(result.prompt_results).toHaveLength(0);
      expect(result.batch_summary.total_prompts).toBe(0);
    });

    it('entries mode metadata has input_source "entries"', async () => {
      const entry = makeEntry();
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [entry] },
        { now: fixedNow, idFactory: fixedId },
      );
      expect(result.metadata.input_source).toBe('entries');
    });
  });

  describe('4.3 Result shape', () => {
    it('each successful result has all expected fields', async () => {
      const entry = makeEntry();
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [entry] },
        { now: fixedNow, idFactory: fixedId },
      );

      const r = result.prompt_results[0];
      expect(r.prompt_log_id).toBe('entry-001');
      expect(typeof r.do_not_send_external).toBe('boolean');
      expect(r.score).toBeDefined();
      expect(r.score!.overall_score).toBeDefined();
      expect(r.score!.issue_labels).toBeDefined();
      expect(r.safety_result).toBeDefined();
      expect(r.safety_result!.warnings).toBeDefined();
      expect(r.model_recommendation).toBeDefined();
      expect(r.model_recommendation!.recommended_class).toBeDefined();
      expect(r.rewrite_suggestion).toBeDefined();
      expect(r.rewrite_suggestion!.guidance_items).toBeDefined();
      expect(r.template_suggestion).toBeDefined();
      expect(r.template_suggestion!.suggested_templates).toBeDefined();
    });

    it('metadata has all expected fields', async () => {
      const entry = makeEntry();
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [entry] },
        { now: fixedNow, idFactory: fixedId },
      );

      const m = result.metadata;
      expect(m.orchestrator_version).toBeDefined();
      expect(m.engines_used).toBeDefined();
      expect(m.pipeline_started_at).toBeDefined();
      expect(m.pipeline_completed_at).toBeDefined();
      expect(typeof m.total_duration_ms).toBe('number');
      expect(m.input_source).toBeDefined();
    });

    it('batch_summary has all expected fields', async () => {
      const entry = makeEntry();
      const result = await runIntegrationDemo(
        { mode: 'entries', entries: [entry] },
        { now: fixedNow, idFactory: fixedId },
      );

      const bs = result.batch_summary;
      expect(typeof bs.total_prompts).toBe('number');
      expect(typeof bs.succeeded).toBe('number');
      expect(typeof bs.failed).toBe('number');
      expect(bs.dimension_averages).toBeDefined();
      expect(bs.issue_label_counts).toBeDefined();
      expect(bs.most_common_labels).toBeDefined();
      expect(bs.safety_summary).toBeDefined();
      expect(bs.model_class_distribution).toBeDefined();
    });
  });

  describe('4.5 Partial results (contract shape verification)', () => {
    it('mismatched batch IDs path: error is content-free, prompt_results empty', async () => {
      const entries = [
        makeEntry({ id: 'e1', import_batch_id: 'batch-A' }),
        makeEntry({ id: 'e2', import_batch_id: 'batch-B' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeDefined();
      expect(result.error).toBe('Pipeline failed at store.');
      expect(result.prompt_results).toHaveLength(0);
      // batch_summary and metadata still present
      expect(result.batch_summary).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('successful results preserve all fields when no step fails', async () => {
      const entries = [
        makeEntry({ id: 'e1', prompt_text: 'Help me debug this code.' }),
        makeEntry({ id: 'e2', prompt_text: 'Write comprehensive tests for auth module.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      for (const r of result.prompt_results) {
        if (!r.error) {
          expect(r.score).toBeDefined();
          expect(r.safety_result).toBeDefined();
          expect(r.model_recommendation).toBeDefined();
          expect(r.rewrite_suggestion).toBeDefined();
          expect(r.template_suggestion).toBeDefined();
        }
      }
    });

    it('per-prompt persist_score failure preserves partial score and continues batch', async () => {
      // Use a colliding idFactory: returns the same score ID for every prompt,
      // causing the second PromptScoreRepository.save() to fail on duplicate ID.
      const collidingId = () => 'colliding-score-id';
      const entries = [
        makeEntry({ id: 'partial-1', prompt_text: 'First prompt succeeds.' }),
        makeEntry({ id: 'partial-2', prompt_text: 'Second prompt fails at persist.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: collidingId },
      );

      // No top-level error — batch continues
      expect(result.error).toBeUndefined();
      expect(result.prompt_results).toHaveLength(2);

      const first = result.prompt_results[0];
      const second = result.prompt_results[1];

      // First prompt succeeds completely
      expect(first.error).toBeUndefined();
      expect(first.score).toBeDefined();

      // Second prompt: score was computed but persist_score failed (duplicate ID)
      expect(second.score).toBeDefined();
      expect(second.failed_step).toBe('persist_score');
      expect(second.error).toBe('Pipeline failed at persist_score.');

      // Error is content-free: no prompt IDs, no SQLite error text, no stack
      expect(second.error).not.toContain(second.prompt_log_id);
      expect(JSON.stringify(second)).not.toContain('SQLITE');
      expect(JSON.stringify(second)).not.toContain('stack');

      // Batch summary still valid
      expect(result.batch_summary.total_prompts).toBe(2);
      expect(result.batch_summary.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4.6 Top-level error', () => {
    it('mismatched batch IDs produce content-free error', async () => {
      const entries = [
        makeEntry({ id: 'e1', import_batch_id: 'batch-X' }),
        makeEntry({ id: 'e2', import_batch_id: 'batch-Y' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBe('Pipeline failed at store.');
      expect(result.prompt_results).toHaveLength(0);
    });

    it('top-level error does not contain prompt text', async () => {
      const entries = [
        makeEntry({ id: 'e1', import_batch_id: 'batch-X', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
        makeEntry({ id: 'e2', import_batch_id: 'batch-Y', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(result.error).toBeDefined();
      expect(result.error).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
      expect(result.error).not.toContain('Multiple');
      expect(result.error).not.toContain('batch');
    });
  });

  describe('4.7 Deterministic output', () => {
    it('same entries + fixedNow + fixedId produces deep-equal output across 2 runs', async () => {
      const entries = [
        makeEntry({ id: 'det-1', prompt_text: 'Write a sorting algorithm.' }),
        makeEntry({ id: 'det-2', prompt_text: 'Explain recursion simply.' }),
      ];
      const opts: PipelineOptions = { now: fixedNow, idFactory: fixedId };

      // Run 1
      idSeq = 0;
      const run1 = await runIntegrationDemo({ mode: 'entries', entries }, opts);

      // Run 2 (reset idSeq)
      idSeq = 0;
      const run2 = await runIntegrationDemo({ mode: 'entries', entries }, opts);

      expect(run1).toEqual(run2);
    });
  });

  describe('4.8 include_prompt_text false (default)', () => {
    it('prompt_text is absent from all PromptResult when not explicitly opted in', async () => {
      const entries = [
        makeEntry({ id: 'priv-1', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      for (const r of result.prompt_results) {
        expect(r.prompt_text).toBeUndefined();
      }
    });

    it('sentinel prompt_text does not appear anywhere in JSON output', async () => {
      const entries = [
        makeEntry({ id: 'priv-2', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });
  });

  describe('4.9 include_prompt_text true', () => {
    it('prompt_text is present in PromptResult when include_prompt_text is true', async () => {
      const entries = [
        makeEntry({ id: 'inc-1', prompt_text: 'Some visible prompt.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: true },
      );

      expect(result.prompt_results[0].prompt_text).toBe('Some visible prompt.');
    });

    it('prompt_text appears in JSON output when opted in', async () => {
      const entries = [
        makeEntry({ id: 'inc-2', prompt_text: 'Visible prompt content.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: true },
      );

      const serialized = JSON.stringify(result);
      expect(serialized).toContain('Visible prompt content.');
    });
  });

  describe('4.12 No-network', () => {
    it('globalThis.fetch is never called during full demo pipeline', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await runIntegrationDemo({ mode: 'demo' });

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('globalThis.fetch is never called during entries pipeline', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const entries = [makeEntry()];
      await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
