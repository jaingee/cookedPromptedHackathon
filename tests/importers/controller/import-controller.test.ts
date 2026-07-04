import { describe, it, expect, vi } from 'vitest';
import { buildImportPreview, commitImportPreview } from '../../../src/importers/local/controller/import-controller.js';
import type { SafetyHandoffAdapter } from '../../../src/importers/local/adapters/safety-handoff-adapter.js';
import type { StorageHandoffPort } from '../../../src/importers/local/ports/storage-handoff-port.js';
import type { PromptLogEntry, ImportBatch, SafetyHandoffResult } from '../../../src/importers/local/types.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../../../src/importers/local/constants.js';

const MOCK_ANSWER = '[MOCK MODEL ANSWER PLACEHOLDER - SHOULD BE STRIPPED]';

const VALID_JSONL = [
  '{"id":"1","timestamp":"2024-06-15T10:00:00Z","source":"manual","provider":"openai","model_used":"gpt-4o","prompt_text":"hello"}',
  '{"id":"2","timestamp":"2024-06-15T11:00:00Z","source":"manual","provider":"openai","model_used":"gpt-4o","prompt_text":"world"}',
].join('\n');

const VALID_CSV = [
  'id,timestamp,source,provider,model_used,prompt_text',
  '1,2024-06-15T10:00:00Z,manual,openai,gpt-4o,hello',
  '2,2024-06-15T11:00:00Z,manual,openai,gpt-4o,world',
].join('\n');

function makeFakeStorage(opts?: { duplicateIds?: string[]; saveFails?: boolean }): StorageHandoffPort {
  return {
    checkDuplicateIds: vi.fn(async () => opts?.duplicateIds ?? []),
    saveImportBatch: vi.fn(async (_batch: ImportBatch, entries: PromptLogEntry[]) => {
      if (opts?.saveFails) return { success: false, entries_saved: 0, error: 'Disk full' };
      return { success: true, entries_saved: entries.length };
    }),
  };
}

function makeFakeSafety(warnings?: SafetyHandoffResult['warnings']): SafetyHandoffAdapter {
  return {
    scan: vi.fn((entries: PromptLogEntry[]) => ({
      entries_scanned: entries.length,
      warnings: warnings ?? [],
    })),
  };
}

describe('buildImportPreview', () => {
  it('works with valid JSONL', async () => {
    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });

    expect(preview.batch.source_type).toBe('jsonl');
    expect(preview.valid_entries).toHaveLength(2);
    expect(preview.invalid_entries).toHaveLength(0);
    expect(preview.batch.valid_rows).toBe(2);
    expect(preview.batch.invalid_rows).toBe(0);
  });

  it('works with valid CSV', async () => {
    const preview = await buildImportPreview({ source_type: 'csv', content: VALID_CSV });

    expect(preview.batch.source_type).toBe('csv');
    expect(preview.valid_entries).toHaveLength(2);
    expect(preview.batch.valid_rows).toBe(2);
  });

  it('works with demo source', async () => {
    const preview = await buildImportPreview({ source_type: 'demo' });

    expect(preview.batch.source_type).toBe('demo');
    expect(preview.valid_entries.length).toBeGreaterThan(0);
    expect(preview.invalid_entries).toHaveLength(0);
    expect(preview.batch.total_rows).toBe(preview.valid_entries.length);
  });

  it('demo dataset passes through full pipeline without errors', async () => {
    const preview = await buildImportPreview({ source_type: 'demo' });

    expect(preview.batch.invalid_rows).toBe(0);
    expect(preview.invalid_entries).toHaveLength(0);
    // All entries should have prompt_hash computed
    for (const entry of preview.valid_entries) {
      expect(entry.prompt_hash).toHaveLength(64);
    }
  });

  it('handles mixed valid/invalid rows correctly', async () => {
    const content = [
      '{"id":"good","timestamp":"2024-01-01T00:00:00Z","source":"s","provider":"p","model_used":"m","prompt_text":"ok"}',
      '{"id":"bad"}', // missing required fields
    ].join('\n');

    const preview = await buildImportPreview({ source_type: 'jsonl', content });

    expect(preview.valid_entries).toHaveLength(1);
    expect(preview.invalid_entries).toHaveLength(1);
    expect(preview.batch.valid_rows).toBe(1);
    expect(preview.batch.invalid_rows).toBe(1);
  });

  it('strips banned full-answer fields before normalization', async () => {
    const content = `{"id":"1","timestamp":"2024-01-01T00:00:00Z","source":"s","provider":"p","model_used":"m","prompt_text":"hi","response":"${MOCK_ANSWER}"}`;

    const preview = await buildImportPreview({ source_type: 'jsonl', content });

    expect(preview.valid_entries).toHaveLength(1);
    expect(preview.full_answer_warnings).toHaveLength(1);
    expect(preview.full_answer_warnings[0]!.stripped_fields).toContain('response');
    // Banned value must not appear anywhere
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain(MOCK_ANSWER);
  });

  it('surfaces safety warnings from adapter', async () => {
    const fakeSafety = makeFakeSafety([
      { entry_id: '1', warning_type: 'possible_api_key', severity: 'high', message: 'may contain key' },
    ]);

    const preview = await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      safety_adapter: fakeSafety,
    });

    expect(preview.safety_warnings.warnings).toHaveLength(1);
    expect(preview.safety_warnings.warnings[0]!.warning_type).toBe('possible_api_key');
    expect(fakeSafety.scan).toHaveBeenCalledOnce();
  });

  it('surfaces cross-batch duplicate warnings from storage port', async () => {
    const fakeStorage = makeFakeStorage({ duplicateIds: ['1'] });

    const preview = await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      storage_port: fakeStorage,
    });

    const dupWarning = preview.warnings.find((w) => w.warning_type === 'cross_batch_duplicate_ids');
    expect(dupWarning).toBeDefined();
    expect(fakeStorage.checkDuplicateIds).toHaveBeenCalledOnce();
  });

  it('does not call saveImportBatch during preview', async () => {
    const fakeStorage = makeFakeStorage();

    await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      storage_port: fakeStorage,
    });

    expect(fakeStorage.saveImportBatch).not.toHaveBeenCalled();
  });
});

describe('commitImportPreview', () => {
  it('calls saveImportBatch with preview valid_entries', async () => {
    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });
    const fakeStorage = makeFakeStorage();

    const result = await commitImportPreview(preview, fakeStorage);

    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.batch.id).toBe(preview.batch.id);
    expect(fakeStorage.saveImportBatch).toHaveBeenCalledWith(preview.batch, preview.valid_entries);
  });

  it('returns failure result when storage save fails', async () => {
    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });
    const fakeStorage = makeFakeStorage({ saveFails: true });

    const result = await commitImportPreview(preview, fakeStorage);

    expect(result.success).toBe(false);
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('Disk full');
  });
});
