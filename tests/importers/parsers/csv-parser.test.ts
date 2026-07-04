import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../../src/importers/local/parsers/csv-parser.js';

describe('parseCsv', () => {
  it('parses valid CSV into rows with lowercased headers', () => {
    const content = 'ID,Prompt_Text,Source\nrow1,hello,manual\nrow2,world,export';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(0);
    expect(result.headers).toEqual(['id', 'prompt_text', 'source']);
    expect(result.rows[0]!.row_number).toBe(2); // header is row 1
    expect(result.rows[0]!.entry['id']).toBe('row1');
    expect(result.rows[0]!.entry['prompt_text']).toBe('hello');
    expect(result.rows[1]!.row_number).toBe(3);
  });

  it('trims header names', () => {
    const content = '  id  , prompt_text , source \nval1,val2,val3';
    const result = parseCsv(content);

    expect(result.headers).toEqual(['id', 'prompt_text', 'source']);
    expect(result.rows).toHaveLength(1);
  });

  it('handles quoted fields with commas', () => {
    const content = 'id,prompt_text\n1,"hello, world"';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.entry['prompt_text']).toBe('hello, world');
  });

  it('handles escaped double quotes inside quoted fields', () => {
    const content = 'id,prompt_text\n1,"say ""hello"" to them"';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.entry['prompt_text']).toBe('say "hello" to them');
  });

  it('handles quoted fields with newlines', () => {
    const content = 'id,prompt_text\n1,"line one\nline two"';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.entry['prompt_text']).toBe('line one\nline two');
  });

  it('reports empty CSV content as an issue', () => {
    const result = parseCsv('');

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toContain('empty');
  });

  it('reports malformed CSV (unclosed quote) as an issue', () => {
    const content = 'id,prompt_text\n1,"unclosed quote';
    const result = parseCsv(content);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]!.message).toContain('unclosed');
  });

  it('does not validate field semantics', () => {
    // Unknown columns are accepted; semantic validation is later
    const content = 'foo,bar\nval1,val2';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.entry['foo']).toBe('val1');
  });

  it('handles missing cell values as empty strings', () => {
    const content = 'id,source,provider\nonly-id,,';
    const result = parseCsv(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.entry['source']).toBe('');
    expect(result.rows[0]!.entry['provider']).toBe('');
  });

  it('reports extra cells beyond header count as an issue', () => {
    const content = 'id,source\nval1,val2,extra_cell';
    const result = parseCsv(content);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]!.message).toContain('cells');
  });
});
