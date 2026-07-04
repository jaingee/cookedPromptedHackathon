import { describe, it, expect } from 'vitest';
import { parseJsonl } from '../../../src/importers/local/parsers/jsonl-parser.js';

describe('parseJsonl', () => {
  it('parses valid JSONL into rows with correct row numbers', () => {
    const content = [
      '{"id":"1","prompt_text":"hello"}',
      '{"id":"2","prompt_text":"world"}',
    ].join('\n');

    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]!.row_number).toBe(1);
    expect(result.rows[0]!.entry['id']).toBe('1');
    expect(result.rows[1]!.row_number).toBe(2);
    expect(result.rows[1]!.entry['prompt_text']).toBe('world');
  });

  it('skips empty lines', () => {
    const content = '{"id":"1"}\n\n\n{"id":"2"}\n';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]!.row_number).toBe(1);
    expect(result.rows[1]!.row_number).toBe(4);
  });

  it('reports malformed JSON with correct line number', () => {
    const content = '{"id":"1"}\nnot json\n{"id":"3"}';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.row_number).toBe(2);
    expect(result.issues[0]!.message).toContain('invalid JSON');
  });

  it('rejects non-object JSON values (arrays)', () => {
    const content = '[1, 2, 3]';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.row_number).toBe(1);
    expect(result.issues[0]!.message).toContain('array');
  });

  it('rejects non-object JSON values (strings, numbers, booleans, null)', () => {
    const content = '"just a string"\n42\ntrue\nnull';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(4);
  });

  it('does not validate field semantics', () => {
    // Parser accepts any object shape — semantic validation is a later step
    const content = '{"random_field":"value","count":42}';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]!.entry['random_field']).toBe('value');
  });

  it('handles completely empty input', () => {
    const result = parseJsonl('');

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('returns both valid rows and issues from a mixed file', () => {
    const content = '{"id":"good"}\nBROKEN\n{"id":"also_good"}';
    const result = parseJsonl(content);

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
  });
});
