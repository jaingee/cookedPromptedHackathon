import { describe, it, expect } from 'vitest';
import { normalizePromptLog } from '../../../src/importers/local/normalizer/prompt-log-normalizer.js';
import { computePromptHash } from '../../../src/importers/local/services/prompt-hash-service.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../../../src/importers/local/constants.js';

const BATCH_ID = 'test-batch-001';

function validRawEntry() {
  return {
    id: 'entry-1',
    timestamp: '2024-06-15T10:30:00Z',
    source: 'manual',
    provider: 'openai',
    model_used: 'gpt-4o',
    prompt_text: 'Write a haiku about testing.',
  };
}

describe('normalizePromptLog', () => {
  describe('required fields', () => {
    it('maps required fields correctly', () => {
      const result = normalizePromptLog(validRawEntry(), BATCH_ID);

      expect(result.id).toBe('entry-1');
      expect(result.timestamp).toBe('2024-06-15T10:30:00Z');
      expect(result.source).toBe('manual');
      expect(result.provider).toBe('openai');
      expect(result.model_used).toBe('gpt-4o');
      expect(result.prompt_text).toBe('Write a haiku about testing.');
    });

    it('includes import_batch_id', () => {
      const result = normalizePromptLog(validRawEntry(), BATCH_ID);
      expect(result.import_batch_id).toBe(BATCH_ID);
    });
  });

  describe('optional fields — null defaults', () => {
    it('missing optional fields become null', () => {
      const result = normalizePromptLog(validRawEntry(), BATCH_ID);

      expect(result.session_id).toBeNull();
      expect(result.follow_up_index).toBeNull();
      expect(result.parent_prompt_id).toBeNull();
      expect(result.input_tokens).toBeNull();
      expect(result.output_tokens).toBeNull();
      expect(result.total_tokens).toBeNull();
      expect(result.estimated_cost).toBeNull();
      expect(result.latency_ms).toBeNull();
      expect(result.solved_status).toBeNull();
      expect(result.user_rating).toBeNull();
    });
  });

  describe('tags', () => {
    it('defaults to empty array when absent', () => {
      const result = normalizePromptLog(validRawEntry(), BATCH_ID);
      expect(result.tags).toEqual([]);
    });

    it('normalizes comma-separated string to trimmed array', () => {
      const entry = { ...validRawEntry(), tags: ' coding , urgent , followup ' };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.tags).toEqual(['coding', 'urgent', 'followup']);
    });

    it('normalizes string array to trimmed array', () => {
      const entry = { ...validRawEntry(), tags: [' coding ', 'testing', '  '] };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.tags).toEqual(['coding', 'testing']);
    });

    it('removes empty/whitespace-only tags', () => {
      const entry = { ...validRawEntry(), tags: ',  , coding, ,  ' };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.tags).toEqual(['coding']);
    });
  });

  describe('prompt_hash', () => {
    it('computes prompt_hash from prompt_text when absent', () => {
      const entry = validRawEntry();
      const result = normalizePromptLog(entry, BATCH_ID);

      const expectedHash = computePromptHash(entry.prompt_text);
      expect(result.prompt_hash).toBe(expectedHash);
      expect(result.prompt_hash).toHaveLength(64);
    });

    it('preserves existing prompt_hash when provided', () => {
      const entry = { ...validRawEntry(), prompt_hash: 'user-provided-hash-value' };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.prompt_hash).toBe('user-provided-hash-value');
    });
  });

  describe('redaction_status', () => {
    it('defaults to "none" when absent', () => {
      const result = normalizePromptLog(validRawEntry(), BATCH_ID);
      expect(result.redaction_status).toBe('none');
    });

    it('preserves valid redaction_status values', () => {
      for (const status of ['none', 'partial', 'full']) {
        const entry = { ...validRawEntry(), redaction_status: status };
        const result = normalizePromptLog(entry, BATCH_ID);
        expect(result.redaction_status).toBe(status);
      }
    });

    it('defaults invalid redaction_status to "none"', () => {
      const entry = { ...validRawEntry(), redaction_status: 'unknown_value' };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.redaction_status).toBe('none');
    });
  });

  describe('numeric string coercion', () => {
    it('converts numeric strings to numbers for integer fields', () => {
      const entry = {
        ...validRawEntry(),
        input_tokens: '150',
        output_tokens: '50',
        total_tokens: '200',
        latency_ms: '320',
        user_rating: '4',
        follow_up_index: '2',
      };
      const result = normalizePromptLog(entry, BATCH_ID);

      expect(result.input_tokens).toBe(150);
      expect(result.output_tokens).toBe(50);
      expect(result.total_tokens).toBe(200);
      expect(result.latency_ms).toBe(320);
      expect(result.user_rating).toBe(4);
      expect(result.follow_up_index).toBe(2);
    });

    it('converts numeric string to number for estimated_cost', () => {
      const entry = { ...validRawEntry(), estimated_cost: '0.0025' };
      const result = normalizePromptLog(entry, BATCH_ID);
      expect(result.estimated_cost).toBe(0.0025);
    });
  });

  describe('banned field exclusion', () => {
    it('banned full-answer fields do not appear in normalized output', () => {
      // Even if somehow a banned field survives stripping (it shouldn't),
      // the normalizer only maps known fields — banned ones are ignored.
      const entry = {
        ...validRawEntry(),
        response: '[SHOULD NOT APPEAR]',
        completion: '[SHOULD NOT APPEAR]',
      };

      const result = normalizePromptLog(entry, BATCH_ID);
      const keys = Object.keys(result);

      for (const banned of BANNED_FULL_ANSWER_FIELDS) {
        expect(keys).not.toContain(banned);
      }
      // Serialized output must not contain banned values
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('[SHOULD NOT APPEAR]');
    });
  });
});
