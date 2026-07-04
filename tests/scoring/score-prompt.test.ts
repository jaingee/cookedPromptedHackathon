/**
 * Wave 4 — Tasks 4.5, 4.6, 4.7, 4.10: pipeline, overall score + safety gate,
 * confidence, and determinism.
 */

import { describe, it, expect } from 'vitest';

import { scorePrompt, scorePrompts } from '../../src/scoring/index.js';
import type { PromptScore } from '../../src/scoring/types.js';
import {
  makePromptLogEntry,
  fixedClock,
  fixedIdFactory,
  FAKE_SECRET,
} from './test-helpers.js';

const fixedOptions = { clock: fixedClock, idFactory: fixedIdFactory };

const SCORE_KEYS = [
  'overall_score',
  'clarity_score',
  'context_score',
  'constraints_score',
  'output_format_score',
  'capability_fit_score',
  'efficiency_score',
  'safety_privacy_score',
] as const;

describe('scorePrompt pipeline', () => {
  it('returns a full PromptScore with expected field mapping', () => {
    const entry = makePromptLogEntry({ id: 'entry-42' });
    const result = scorePrompt(entry, fixedOptions);

    expect(result.prompt_log_id).toBe('entry-42');
    expect(result.id).toBe('score-1');
    expect(result.scored_at).toBe('2026-01-01T00:00:00.000Z');
    expect(result.scoring_version).toBe('1.0.0');
    expect(result.confidence).toBeDefined();

    for (const key of SCORE_KEYS) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(5);
    }
  });

  it('does not copy prompt_text into the PromptScore', () => {
    const entry = makePromptLogEntry({
      prompt_text: 'UNIQUE-SYNTHETIC-PROMPT-marker-abc123',
    });
    const result = scorePrompt(entry, fixedOptions);
    expect(JSON.stringify(result)).not.toContain('UNIQUE-SYNTHETIC-PROMPT-marker-abc123');
  });

  it('scorePrompts([]) returns []', () => {
    expect(scorePrompts([], fixedOptions)).toEqual([]);
  });

  it('scorePrompts preserves input order', () => {
    const entries = [
      makePromptLogEntry({ id: 'a' }),
      makePromptLogEntry({ id: 'b' }),
      makePromptLogEntry({ id: 'c' }),
    ];
    const results = scorePrompts(entries, fixedOptions);
    expect(results.map((r) => r.prompt_log_id)).toEqual(['a', 'b', 'c']);
  });
});

describe('overall score and safety gate', () => {
  it('a well-structured prompt scores higher overall than a vague one', () => {
    const good = scorePrompt(makePromptLogEntry(), fixedOptions);
    const weak = scorePrompt(
      makePromptLogEntry({ prompt_text: 'help' }),
      fixedOptions,
    );
    expect(good.overall_score).toBeGreaterThan(weak.overall_score);
  });

  it('a high-severity secret-like prompt triggers safety_privacy_score <= 1', () => {
    const result = scorePrompt(
      makePromptLogEntry({ prompt_text: `Here is my key: ${FAKE_SECRET}` }),
      fixedOptions,
    );
    expect(result.safety_privacy_score).toBeLessThanOrEqual(1);
  });

  it('the safety gate caps overall_score at 1 for a critical safety risk', () => {
    const result = scorePrompt(
      makePromptLogEntry({ prompt_text: `Here is my key: ${FAKE_SECRET}` }),
      fixedOptions,
    );
    expect(result.overall_score).toBe(1);
  });

  it('a clean prompt is not capped by the safety gate', () => {
    const result = scorePrompt(makePromptLogEntry(), fixedOptions);
    expect(result.overall_score).toBeGreaterThan(1);
  });
});

describe('confidence derivation', () => {
  it('no model and no usage metadata -> low', () => {
    const result = scorePrompt(
      makePromptLogEntry({ model_used: '', input_tokens: null }),
      fixedOptions,
    );
    expect(result.confidence).toBe('low');
  });

  it('model metadata only -> medium', () => {
    const result = scorePrompt(
      makePromptLogEntry({ model_used: 'general purpose', input_tokens: null }),
      fixedOptions,
    );
    expect(result.confidence).toBe('medium');
  });

  it('usage metadata only -> medium', () => {
    const result = scorePrompt(
      makePromptLogEntry({ model_used: '', input_tokens: 100 }),
      fixedOptions,
    );
    expect(result.confidence).toBe('medium');
  });

  it('model + usage metadata -> high', () => {
    const result = scorePrompt(
      makePromptLogEntry({ model_used: 'general purpose', input_tokens: 100 }),
      fixedOptions,
    );
    expect(result.confidence).toBe('high');
  });
});

describe('deterministic output', () => {
  function withoutVolatile(score: PromptScore): Omit<PromptScore, 'id' | 'scored_at'> {
    const { id: _id, scored_at: _scoredAt, ...rest } = score;
    return rest;
  }

  it('same entry + fixed clock/idFactory -> deep-equal PromptScore', () => {
    const entry = makePromptLogEntry();
    const a = scorePrompt(entry, fixedOptions);
    const b = scorePrompt(entry, fixedOptions);
    expect(a).toEqual(b);
  });

  it('changing only the clock changes scored_at but not scores/labels/confidence', () => {
    const entry = makePromptLogEntry();
    const a = scorePrompt(entry, fixedOptions);
    const b = scorePrompt(entry, {
      clock: { now: () => '2030-12-31T23:59:59.000Z' },
      idFactory: fixedIdFactory,
    });
    expect(b.scored_at).not.toBe(a.scored_at);
    expect(withoutVolatile(a)).toEqual(withoutVolatile(b));
  });

  it('changing only the idFactory changes id but not scores/labels/confidence', () => {
    const entry = makePromptLogEntry();
    const a = scorePrompt(entry, fixedOptions);
    const b = scorePrompt(entry, {
      clock: fixedClock,
      idFactory: () => 'score-2',
    });
    expect(b.id).not.toBe(a.id);
    expect(withoutVolatile(a)).toEqual(withoutVolatile(b));
  });
});
