import { describe, it, expect } from 'vitest';
import { buildImportPreview } from '../../../src/importers/local/preview/import-preview-builder.js';
import type { PromptLogEntry, ImportBatch } from '../../../src/importers/local/types.js';

function makeBatch(overrides?: Partial<ImportBatch>): ImportBatch {
  return {
    id: 'batch-001',
    source_type: 'jsonl',
    source_filename: 'test.jsonl',
    total_rows: 3,
    valid_rows: 2,
    invalid_rows: 1,
    warnings_count: 0,
    created_at: '2024-06-15T10:00:00Z',
    ...overrides,
  };
}

function makeEntry(overrides?: Partial<PromptLogEntry>): PromptLogEntry {
  return {
    id: 'e1',
    timestamp: '2024-06-15T10:00:00Z',
    source: 'manual',
    provider: 'openai',
    model_used: 'gpt-4o',
    prompt_text: 'test prompt',
    import_batch_id: 'batch-001',
    prompt_hash: 'abc123',
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
    redaction_status: 'none',
    ...overrides,
  };
}

describe('buildImportPreview', () => {
  it('includes batch, valid entries, invalid entries, and warnings', () => {
    const batch = makeBatch();
    const validEntries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })];
    const invalidEntries = [{ row_number: 3, issues: [{ row_number: 3, field: 'id', issue_type: 'missing_required' as const, message: 'missing', suggestion: null }] }];
    const warnings = [{ row_number: null, warning_type: 'test', message: 'warn' }];

    const preview = buildImportPreview({
      batch,
      valid_entries: validEntries,
      invalid_entries: invalidEntries,
      warnings,
      full_answer_warnings: [],
      safety_warnings: { entries_scanned: 2, warnings: [] },
    });

    expect(preview.batch).toBe(batch);
    expect(preview.valid_entries).toHaveLength(2);
    expect(preview.invalid_entries).toHaveLength(1);
    expect(preview.warnings).toHaveLength(1);
  });

  it('includes full_answer_warnings and safety_warnings', () => {
    const fullAnswerWarnings = [{ row_number: 1, stripped_fields: ['response'], message: 'stripped' }];
    const safetyWarnings = { entries_scanned: 1, warnings: [{ entry_id: 'e1', warning_type: 'api_key', severity: 'high' as const, message: 'possible key' }] };

    const preview = buildImportPreview({
      batch: makeBatch(),
      valid_entries: [makeEntry()],
      invalid_entries: [],
      warnings: [],
      full_answer_warnings: fullAnswerWarnings,
      safety_warnings: safetyWarnings,
    });

    expect(preview.full_answer_warnings).toHaveLength(1);
    expect(preview.safety_warnings.warnings).toHaveLength(1);
  });

  it('computes missing metadata summary correctly', () => {
    const entries = [
      makeEntry({ id: 'e1', input_tokens: null, output_tokens: null, total_tokens: null, estimated_cost: null, latency_ms: null, user_rating: null }),
      makeEntry({ id: 'e2', input_tokens: 100, output_tokens: 50, total_tokens: 150, estimated_cost: 0.01, latency_ms: 200, user_rating: 4 }),
      makeEntry({ id: 'e3', input_tokens: null, output_tokens: null, total_tokens: null, estimated_cost: 0.02, latency_ms: null, user_rating: null }),
    ];

    const preview = buildImportPreview({
      batch: makeBatch({ total_rows: 3, valid_rows: 3 }),
      valid_entries: entries,
      invalid_entries: [],
      warnings: [],
      full_answer_warnings: [],
      safety_warnings: { entries_scanned: 3, warnings: [] },
    });

    expect(preview.missing_metadata_summary.entries_missing_tokens).toBe(2);
    expect(preview.missing_metadata_summary.entries_missing_cost).toBe(1);
    expect(preview.missing_metadata_summary.entries_missing_latency).toBe(2);
    expect(preview.missing_metadata_summary.entries_missing_rating).toBe(2);
  });
});
