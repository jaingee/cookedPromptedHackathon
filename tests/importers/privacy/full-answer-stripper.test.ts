import { describe, it, expect } from 'vitest';
import { stripFullAnswerFields } from '../../../src/importers/local/strippers/full-answer-stripper.js';
import { normalizePromptLog } from '../../../src/importers/local/normalizer/prompt-log-normalizer.js';
import { BANNED_FULL_ANSWER_FIELDS } from '../../../src/importers/local/constants.js';

const MOCK_ANSWER = '[MOCK MODEL ANSWER PLACEHOLDER - SHOULD BE STRIPPED]';

describe('stripFullAnswerFields — privacy behavior', () => {
  it('strips all banned full-answer fields', () => {
    const entry = {
      id: 'test-1',
      prompt_text: 'hello',
      response: MOCK_ANSWER,
      assistant_message: MOCK_ANSWER,
      completion: MOCK_ANSWER,
      model_answer: MOCK_ANSWER,
      output_text: MOCK_ANSWER,
      generated_text: MOCK_ANSWER,
    };

    const result = stripFullAnswerFields(entry, 1);

    // None of the banned fields should remain
    for (const field of BANNED_FULL_ANSWER_FIELDS) {
      expect(result.entry).not.toHaveProperty(field);
    }
    // Allowed fields remain
    expect(result.entry['id']).toBe('test-1');
    expect(result.entry['prompt_text']).toBe('hello');
  });

  it('emits warning with correct row number and stripped field names', () => {
    const entry = {
      id: 'test-2',
      response: MOCK_ANSWER,
      completion: MOCK_ANSWER,
    };

    const result = stripFullAnswerFields(entry, 7);

    expect(result.warning).not.toBeNull();
    expect(result.warning!.row_number).toBe(7);
    expect(result.warning!.stripped_fields).toContain('response');
    expect(result.warning!.stripped_fields).toContain('completion');
    expect(result.warning!.stripped_fields).toHaveLength(2);
  });

  it('warning message contains field NAMES but never field VALUES', () => {
    const entry = { id: 'test-3', response: MOCK_ANSWER };

    const result = stripFullAnswerFields(entry, 1);

    expect(result.warning!.message).toContain('response');
    expect(result.warning!.message).not.toContain(MOCK_ANSWER);
  });

  it('does not mutate the original input object', () => {
    const entry = { id: 'test-4', response: MOCK_ANSWER, prompt_text: 'hi' };
    const originalKeys = Object.keys(entry).sort();

    stripFullAnswerFields(entry, 1);

    expect(Object.keys(entry).sort()).toEqual(originalKeys);
    expect(entry.response).toBe(MOCK_ANSWER); // still on original
  });

  it('performs case-insensitive matching on banned fields', () => {
    const entry = {
      id: 'test-5',
      RESPONSE: MOCK_ANSWER,
      Assistant_Message: MOCK_ANSWER,
      OUTPUT_TEXT: MOCK_ANSWER,
    };

    const result = stripFullAnswerFields(entry, 1);

    expect(result.entry).not.toHaveProperty('RESPONSE');
    expect(result.entry).not.toHaveProperty('Assistant_Message');
    expect(result.entry).not.toHaveProperty('OUTPUT_TEXT');
    expect(result.warning!.stripped_fields).toHaveLength(3);
  });

  it('returns null warning when no banned fields are present', () => {
    const entry = { id: 'test-6', prompt_text: 'clean entry' };

    const result = stripFullAnswerFields(entry, 1);

    expect(result.warning).toBeNull();
    expect(result.entry['id']).toBe('test-6');
  });

  it('preserves non-banned unknown fields in the cleaned raw object', () => {
    const entry = { id: 'test-7', custom_field: 'keep me', response: MOCK_ANSWER };

    const result = stripFullAnswerFields(entry, 1);

    expect(result.entry['custom_field']).toBe('keep me');
    expect(result.entry).not.toHaveProperty('response');
  });

  it('stripped fields do not appear in normalized output', () => {
    const entry = {
      id: 'test-8',
      timestamp: '2024-06-15T10:00:00Z',
      source: 'manual',
      provider: 'openai',
      model_used: 'gpt-4o',
      prompt_text: 'test prompt',
      response: MOCK_ANSWER,
      completion: MOCK_ANSWER,
    };

    const { entry: cleaned } = stripFullAnswerFields(entry, 1);
    const normalized = normalizePromptLog(cleaned, 'batch-123');

    // Normalized output must not contain banned fields
    const normalizedObj = normalized as unknown as Record<string, unknown>;
    for (const field of BANNED_FULL_ANSWER_FIELDS) {
      expect(normalizedObj[field]).toBeUndefined();
    }
    // And must not contain the mock value anywhere in serialized form
    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain(MOCK_ANSWER);
  });

  it('handles multiple banned fields on one row and reports all by name', () => {
    const entry = {
      id: 'multi',
      response: MOCK_ANSWER,
      model_answer: MOCK_ANSWER,
      generated_text: MOCK_ANSWER,
    };

    const result = stripFullAnswerFields(entry, 3);

    expect(result.warning!.stripped_fields).toHaveLength(3);
    expect(result.warning!.stripped_fields).toContain('response');
    expect(result.warning!.stripped_fields).toContain('model_answer');
    expect(result.warning!.stripped_fields).toContain('generated_text');
  });
});
