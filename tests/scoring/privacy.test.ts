/**
 * Wave 4 — Task 4.9: Privacy / no-network guardrail tests.
 *
 * This is the privacy proof pass: these tests must fail if prompt text,
 * banned fields, matched secrets, or internal modules ever leak, or if any
 * network call is attempted during scoring.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import * as scoring from '../../src/scoring/index.js';
import { scorePrompt, scorePrompts } from '../../src/scoring/index.js';
import { makePromptLogEntry, fixedClock, fixedIdFactory, FAKE_SECRET } from './test-helpers.js';

const fixedOptions = { clock: fixedClock, idFactory: fixedIdFactory };

const BANNED_ANSWER_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('no network calls during scoring', () => {
  it('scorePrompt does not call globalThis.fetch', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('Network call detected!');
    });
    vi.stubGlobal('fetch', fetchSpy);
    scorePrompt(makePromptLogEntry(), fixedOptions);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scorePrompts does not call globalThis.fetch', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('Network call detected!');
    });
    vi.stubGlobal('fetch', fetchSpy);
    scorePrompts([makePromptLogEntry(), makePromptLogEntry({ id: 'p2' })], fixedOptions);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('PromptScore contains no prompt text or banned fields', () => {
  it('does not include banned full-answer fields', () => {
    const result = scorePrompt(makePromptLogEntry(), fixedOptions) as unknown as Record<
      string,
      unknown
    >;
    for (const banned of BANNED_ANSWER_FIELDS) {
      expect(result[banned]).toBeUndefined();
    }
  });

  it('does not include prompt_text', () => {
    const result = scorePrompt(makePromptLogEntry(), fixedOptions) as unknown as Record<
      string,
      unknown
    >;
    expect(result['prompt_text']).toBeUndefined();
  });

  it('explanations do not include the exact synthetic prompt text', () => {
    const unique = 'UNIQUE-SYNTHETIC-PROMPT-privacy-xyz789';
    const result = scorePrompt(
      makePromptLogEntry({ prompt_text: unique }),
      fixedOptions,
    );
    for (const explanation of result.explanations) {
      expect(explanation).not.toContain(unique);
    }
  });

  it('safety/privacy outputs do not include the fake secret value', () => {
    const result = scorePrompt(
      makePromptLogEntry({ prompt_text: `Here is my key: ${FAKE_SECRET}` }),
      fixedOptions,
    );
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
  });
});

describe('public barrel does not expose internal modules', () => {
  it('does not export internal scoring internals', () => {
    const exposed = scoring as unknown as Record<string, unknown>;
    for (const name of [
      'extractSignals',
      'matchSafetyPatterns',
      'scoreClarity',
      'scoreContext',
      'scoreConstraints',
      'scoreOutputFormat',
      'scoreCapabilityFit',
      'scoreEfficiency',
      'scoreSafetyPrivacy',
      'buildExplanations',
    ]) {
      expect(exposed[name]).toBeUndefined();
    }
  });

  it('does export the intended public API', () => {
    const exposed = scoring as unknown as Record<string, unknown>;
    expect(typeof exposed['scorePrompt']).toBe('function');
    expect(typeof exposed['scorePrompts']).toBe('function');
    expect(typeof exposed['createScoringEngine']).toBe('function');
  });
});
