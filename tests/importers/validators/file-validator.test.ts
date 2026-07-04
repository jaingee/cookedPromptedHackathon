import { describe, it, expect } from 'vitest';
import { validateFile } from '../../../src/importers/local/validators/file-validator.js';

describe('validateFile', () => {
  it('passes when rows exist and file is within limits', () => {
    const result = validateFile({
      file_size_bytes: 1024,
      file_extension: '.jsonl',
      rows: [{ row_number: 1, entry: { id: '1' } }],
      parse_issue_count: 0,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects files that exceed 50 MB', () => {
    const overLimit = 51 * 1024 * 1024;
    const result = validateFile({
      file_size_bytes: overLimit,
      file_extension: '.jsonl',
      rows: [{ row_number: 1, entry: { id: '1' } }],
      parse_issue_count: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('50 MB');
  });

  it('rejects unsupported file extensions', () => {
    const result = validateFile({
      file_extension: '.txt',
      rows: [{ row_number: 1, entry: { id: '1' } }],
      parse_issue_count: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('.txt');
  });

  it('rejects when no rows and no parse issues exist (empty file)', () => {
    const result = validateFile({
      file_extension: '.jsonl',
      rows: [],
      parse_issue_count: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('empty');
  });

  it('rejects CSV with no recognized columns', () => {
    const result = validateFile({
      file_extension: '.csv',
      rows: [{ row_number: 2, entry: { unknown_col: 'val' } }],
      parse_issue_count: 0,
      headers: ['unknown_col', 'another_unknown'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no recognized field names');
  });

  it('rejects CSV with empty headers array', () => {
    const result = validateFile({
      file_extension: '.csv',
      rows: [],
      parse_issue_count: 0,
      headers: [],
    });

    expect(result.valid).toBe(false);
  });

  it('produces warnings for banned full-answer fields by name only', () => {
    const result = validateFile({
      file_extension: '.jsonl',
      rows: [
        { row_number: 1, entry: { id: '1', response: '[MOCK PLACEHOLDER]' } },
        { row_number: 2, entry: { id: '2', assistant_message: '[MOCK PLACEHOLDER]' } },
      ],
      parse_issue_count: 0,
    });

    expect(result.valid).toBe(true); // warnings don't fail validation
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.warning_type).toBe('full_answer_fields_detected');
    expect(result.warnings[0]!.message).toContain('response');
    expect(result.warnings[0]!.message).toContain('assistant_message');
    // Must NOT include the banned field values
    expect(result.warnings[0]!.message).not.toContain('[MOCK PLACEHOLDER]');
  });

  it('accepts .csv extension', () => {
    const result = validateFile({
      file_extension: '.csv',
      rows: [{ row_number: 2, entry: { id: '1', source: 'test' } }],
      parse_issue_count: 0,
      headers: ['id', 'source'],
    });

    expect(result.valid).toBe(true);
  });
});
