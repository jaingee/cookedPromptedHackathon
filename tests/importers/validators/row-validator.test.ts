import { describe, it, expect } from 'vitest';
import { validateRow } from '../../../src/importers/local/validators/row-validator.js';

/** Helper: a valid minimal entry. */
function validEntry() {
  return {
    id: 'test-id-1',
    timestamp: '2024-06-15T10:30:00Z',
    source: 'manual',
    provider: 'openai',
    model_used: 'gpt-4o',
    prompt_text: 'Write a haiku about testing.',
  };
}

describe('validateRow', () => {
  describe('required fields', () => {
    const requiredFields = ['id', 'timestamp', 'source', 'provider', 'model_used', 'prompt_text'];

    for (const field of requiredFields) {
      it(`reports missing "${field}" as a missing_required issue`, () => {
        const entry = validEntry();
        delete (entry as Record<string, unknown>)[field];
        const seenIds = new Set<string>();

        const result = validateRow(entry, 1, seenIds);

        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        const issue = result.issues.find((i) => i.field === field);
        expect(issue).toBeDefined();
        expect(issue!.issue_type).toBe('missing_required');
        expect(issue!.suggestion).toBeTruthy();
      });
    }
  });

  it('passes a valid entry', () => {
    const seenIds = new Set<string>();
    const result = validateRow(validEntry(), 1, seenIds);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports invalid timestamp as invalid_timestamp', () => {
    const entry = { ...validEntry(), timestamp: 'not-a-date' };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 3, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.issue_type === 'invalid_timestamp');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('timestamp');
    expect(issue!.row_number).toBe(3);
    expect(issue!.suggestion).toContain('ISO 8601');
  });

  it('reports negative input_tokens as invalid_value', () => {
    const entry = { ...validEntry(), input_tokens: -5 };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'input_tokens');
    expect(issue).toBeDefined();
    expect(issue!.issue_type).toBe('invalid_value');
  });

  it('reports non-integer token counts as invalid', () => {
    const entry = { ...validEntry(), output_tokens: 3.5 };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'output_tokens');
    expect(issue).toBeDefined();
  });

  it('reports user_rating outside 1-5 as invalid_value', () => {
    const entry = { ...validEntry(), user_rating: 7 };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'user_rating');
    expect(issue).toBeDefined();
    expect(issue!.issue_type).toBe('invalid_value');
  });

  it('reports invalid solved_status as invalid_value', () => {
    const entry = { ...validEntry(), solved_status: 'maybe' };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'solved_status');
    expect(issue).toBeDefined();
    expect(issue!.issue_type).toBe('invalid_value');
  });

  it('reports invalid follow_up_index as error', () => {
    const entry = { ...validEntry(), follow_up_index: -1 };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'follow_up_index');
    expect(issue).toBeDefined();
  });

  it('reports duplicate ID within batch as duplicate_id', () => {
    const seenIds = new Set<string>(['test-id-1']);
    const entry = validEntry(); // id is 'test-id-1'

    const result = validateRow(entry, 5, seenIds);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.issue_type === 'duplicate_id');
    expect(issue).toBeDefined();
    expect(issue!.row_number).toBe(5);
  });

  it('produces warning (not error) for parent_prompt_id not in batch', () => {
    const entry = { ...validEntry(), id: 'unique-id', parent_prompt_id: 'nonexistent-parent' };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(true); // warning only
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.warning_type).toBe('parent_id_not_in_batch');
  });

  it('accepts valid optional fields without issues', () => {
    const entry = {
      ...validEntry(),
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      user_rating: 4,
      solved_status: 'solved',
      follow_up_index: 0,
    };
    const seenIds = new Set<string>();

    const result = validateRow(entry, 1, seenIds);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
