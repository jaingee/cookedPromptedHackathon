import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildImportPreview, commitImportPreview } from '../../../src/importers/local/controller/import-controller.js';
import type { SafetyHandoffAdapter } from '../../../src/importers/local/adapters/safety-handoff-adapter.js';
import type { StorageHandoffPort } from '../../../src/importers/local/ports/storage-handoff-port.js';
import type { PromptLogEntry, ImportBatch } from '../../../src/importers/local/types.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../../../src/importers/local/constants.js';

const MOCK_ANSWER = '[MOCK MODEL ANSWER PLACEHOLDER - SHOULD BE STRIPPED]';

const VALID_JSONL = '{"id":"1","timestamp":"2024-06-15T10:00:00Z","source":"s","provider":"p","model_used":"m","prompt_text":"test"}';

describe('no-network guardrails', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock globalThis.fetch to detect any network call
    fetchSpy = vi.fn(() => { throw new Error('Network call detected!'); });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('buildImportPreview does not call fetch', async () => {
    await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('buildImportPreview with demo does not call fetch', async () => {
    await buildImportPreview({ source_type: 'demo' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('commitImportPreview does not call fetch', async () => {
    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });
    const fakeStorage: StorageHandoffPort = {
      checkDuplicateIds: async () => [],
      saveImportBatch: async (_b: ImportBatch, entries: PromptLogEntry[]) => ({
        success: true,
        entries_saved: entries.length,
      }),
    };

    await commitImportPreview(preview, fakeStorage);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('privacy guard — safety adapter boundary', () => {
  it('default StubSafetyHandoffAdapter returns deterministic empty result', async () => {
    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });

    expect(preview.safety_warnings.entries_scanned).toBe(1);
    expect(preview.safety_warnings.warnings).toHaveLength(0);
  });

  it('custom fake safety adapter receives only normalized PromptLogEntry entries', async () => {
    const receivedEntries: PromptLogEntry[] = [];
    const fakeSafety: SafetyHandoffAdapter = {
      scan(entries) {
        receivedEntries.push(...entries);
        return { entries_scanned: entries.length, warnings: [] };
      },
    };

    await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      safety_adapter: fakeSafety,
    });

    expect(receivedEntries).toHaveLength(1);
    // Each entry must be a normalized PromptLogEntry with import_batch_id
    expect(receivedEntries[0]!.import_batch_id).toBeTruthy();
    expect(receivedEntries[0]!.prompt_hash).toHaveLength(64);
    // Must not have raw import entry shape (no banned fields)
    for (const banned of BANNED_FULL_ANSWER_FIELDS) {
      expect((receivedEntries[0] as unknown as Record<string, unknown>)[banned]).toBeUndefined();
    }
  });
});

describe('privacy guard — storage boundary', () => {
  it('saveImportBatch is NOT called during buildImportPreview', async () => {
    const saveSpy = vi.fn(async () => ({ success: true, entries_saved: 0 }));
    const fakeStorage: StorageHandoffPort = {
      checkDuplicateIds: async () => [],
      saveImportBatch: saveSpy,
    };

    await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      storage_port: fakeStorage,
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('saveImportBatch IS called during commitImportPreview', async () => {
    const saveSpy = vi.fn(async (_b: ImportBatch, entries: PromptLogEntry[]) => ({
      success: true,
      entries_saved: entries.length,
    }));
    const fakeStorage: StorageHandoffPort = {
      checkDuplicateIds: async () => [],
      saveImportBatch: saveSpy,
    };

    const preview = await buildImportPreview({ source_type: 'jsonl', content: VALID_JSONL });
    await commitImportPreview(preview, fakeStorage);

    expect(saveSpy).toHaveBeenCalledOnce();
    // Storage receives only normalized entries
    const savedEntries = saveSpy.mock.calls[0]![1] as PromptLogEntry[];
    expect(savedEntries[0]!.import_batch_id).toBeTruthy();
    expect(savedEntries[0]!.prompt_hash).toHaveLength(64);
  });

  it('storage receives no banned full-answer field values', async () => {
    const content = `{"id":"1","timestamp":"2024-01-01T00:00:00Z","source":"s","provider":"p","model_used":"m","prompt_text":"hi","response":"${MOCK_ANSWER}","completion":"${MOCK_ANSWER}"}`;

    const saveSpy = vi.fn(async (_b: ImportBatch, entries: PromptLogEntry[]) => ({
      success: true,
      entries_saved: entries.length,
    }));
    const fakeStorage: StorageHandoffPort = {
      checkDuplicateIds: async () => [],
      saveImportBatch: saveSpy,
    };

    const preview = await buildImportPreview({ source_type: 'jsonl', content });
    await commitImportPreview(preview, fakeStorage);

    const savedEntries = saveSpy.mock.calls[0]![1] as PromptLogEntry[];
    const serialized = JSON.stringify(savedEntries);
    expect(serialized).not.toContain(MOCK_ANSWER);
    for (const banned of BANNED_FULL_ANSWER_FIELDS) {
      expect((savedEntries[0] as unknown as Record<string, unknown>)[banned]).toBeUndefined();
    }
  });
});

describe('privacy guard — preview output', () => {
  it('banned placeholder values never appear in serialized preview', async () => {
    const content = `{"id":"1","timestamp":"2024-01-01T00:00:00Z","source":"s","provider":"p","model_used":"m","prompt_text":"clean","response":"${MOCK_ANSWER}"}`;

    const preview = await buildImportPreview({ source_type: 'jsonl', content });
    const serialized = JSON.stringify(preview);

    expect(serialized).not.toContain(MOCK_ANSWER);
  });

  it('no raw parsed rows appear in preview safety_warnings', async () => {
    const receivedEntries: unknown[] = [];
    const fakeSafety: SafetyHandoffAdapter = {
      scan(entries) {
        receivedEntries.push(...entries);
        return { entries_scanned: entries.length, warnings: [] };
      },
    };

    await buildImportPreview({
      source_type: 'jsonl',
      content: VALID_JSONL,
      safety_adapter: fakeSafety,
    });

    // Safety adapter receives normalized entries, not raw rows
    for (const entry of receivedEntries) {
      expect((entry as PromptLogEntry).import_batch_id).toBeTruthy();
    }
  });
});
