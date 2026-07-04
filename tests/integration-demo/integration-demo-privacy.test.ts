import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runIntegrationDemo, BANNED_OUTPUT_FIELDS } from '../../src/integration-demo/index.js';
import type { UnifiedDemoOutput } from '../../src/integration-demo/index.js';
import type { PromptLogEntry } from '../../src/importers/local/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';
let idSeq = 0;
const fixedId = () => { idSeq += 1; return `priv-id-${idSeq}`; };

beforeEach(() => {
  idSeq = 0;
});

function makeEntry(overrides: Partial<PromptLogEntry> = {}): PromptLogEntry {
  return {
    id: 'entry-priv-001',
    import_batch_id: 'batch-priv-001',
    prompt_text: 'Write a function that sorts an array.',
    prompt_hash: 'hash-priv-001',
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
const SENTINEL_SECRET_VALUE_DO_NOT_LEAK = 'SENTINEL_SECRET_VALUE_DO_NOT_LEAK_Qw3rTy9X';

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

describe('Integration Demo Privacy Verification', () => {
  describe('4.10 No banned fields in output', () => {
    it('recursive key scan of entries-mode output has no banned keys', async () => {
      const entries = [
        makeEntry({ id: 'ban-1', prompt_text: 'Help me write a reducer.' }),
        makeEntry({ id: 'ban-2', prompt_text: 'Explain promises in JS.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      const allKeys = recursiveKeys(result);
      for (const banned of BANNED_OUTPUT_FIELDS) {
        expect(allKeys.has(banned)).toBe(false);
      }
    });

    it('recursive key scan of demo-mode output has no banned keys', async () => {
      const result = await runIntegrationDemo({ mode: 'demo' });

      const allKeys = recursiveKeys(result);
      for (const banned of BANNED_OUTPUT_FIELDS) {
        expect(allKeys.has(banned)).toBe(false);
      }
    });

    it('banned field names do not appear in serialized output', async () => {
      const entries = [makeEntry({ id: 'ban-3' })];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      const serialized = JSON.stringify(result);
      for (const banned of BANNED_OUTPUT_FIELDS) {
        expect(serialized).not.toContain(`"${banned}"`);
      }
    });
  });

  describe('4.11 No secret sentinels in output', () => {
    it('sentinel prompt_text does not leak when include_prompt_text is false', async () => {
      const entries = [
        makeEntry({ id: 'sec-1', prompt_text: SENTINEL_SECRET_VALUE_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: false },
      );

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SENTINEL_SECRET_VALUE_DO_NOT_LEAK);
    });

    it('sentinel in prompt_text with default options does not appear in output', async () => {
      const entries = [
        makeEntry({ id: 'sec-2', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId },
      );

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
    });
  });

  describe('4.8 batch_summary and metadata never contain prompt_text', () => {
    it('batch_summary has no prompt_text even with include_prompt_text true', async () => {
      const entries = [
        makeEntry({ id: 'bs-1', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: true },
      );

      const bsSerialized = JSON.stringify(result.batch_summary);
      expect(bsSerialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
      expect(bsSerialized).not.toContain('prompt_text');
    });

    it('metadata has no prompt_text even with include_prompt_text true', async () => {
      const entries = [
        makeEntry({ id: 'md-1', prompt_text: SENTINEL_PROMPT_TEXT_DO_NOT_LEAK }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: true },
      );

      const metaSerialized = JSON.stringify(result.metadata);
      expect(metaSerialized).not.toContain(SENTINEL_PROMPT_TEXT_DO_NOT_LEAK);
      expect(metaSerialized).not.toContain('prompt_text');
    });

    it('batch_summary keys never include prompt_text', async () => {
      const entries = [
        makeEntry({ id: 'bk-1', prompt_text: 'Some content here.' }),
      ];
      const result = await runIntegrationDemo(
        { mode: 'entries', entries },
        { now: fixedNow, idFactory: fixedId, include_prompt_text: true },
      );

      const bsKeys = recursiveKeys(result.batch_summary);
      expect(bsKeys.has('prompt_text')).toBe(false);

      const metaKeys = recursiveKeys(result.metadata);
      expect(metaKeys.has('prompt_text')).toBe(false);
    });
  });
});
