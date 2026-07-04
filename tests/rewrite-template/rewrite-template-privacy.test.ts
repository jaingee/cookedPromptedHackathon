import { describe, it, expect, vi } from 'vitest';
import { generateRewriteSuggestion, generateTemplateSuggestion } from '../../src/rewrite-template/index.js';
import type { RewriteInput } from '../../src/rewrite-template/index.js';
import type { PromptScore } from '../../src/scoring/types.js';
import type { SafetyScanResult, SafetyWarning } from '../../src/safety/types.js';

const fixedNow = () => '2026-07-04T00:00:00.000Z';
let idSeq = 0;
const fixedId = () => { idSeq += 1; return `priv-id-${idSeq}`; };
const options = { now: fixedNow, idFactory: fixedId };

function makeScore(overrides: Partial<PromptScore> = {}): PromptScore {
  return {
    id: 'score-1',
    prompt_log_id: 'log-1',
    overall_score: 3,
    clarity_score: 2,
    context_score: 2,
    constraints_score: 2,
    output_format_score: 2,
    capability_fit_score: 2,
    efficiency_score: 2,
    safety_privacy_score: 2,
    issue_labels: ['missing_context', 'unclear_task', 'possible_secret'],
    explanations: [],
    confidence: 'high',
    scoring_version: 'scoring-v1',
    scored_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeWarning(overrides: Partial<SafetyWarning> = {}): SafetyWarning {
  return {
    id: 'warn-1',
    category: 'secret_like',
    severity: 'high',
    confidence: 'high',
    message: 'Detected a secret-like pattern.',
    scanner_version: 'scanner-v1',
    created_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeSafetyResult(overrides: Partial<SafetyScanResult> = {}): SafetyScanResult {
  return {
    warnings: [],
    highest_severity: null,
    scanner_version: 'scanner-v1',
    scanned_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('Rewrite/Template Privacy Verification', () => {
  describe('4.8 No-network tests', () => {
    it('globalThis.fetch is never called by generateRewriteSuggestion', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'possible_secret'] }),
        prompt_text: 'Test prompt with various content',
        safety_result: makeSafetyResult({
          warnings: [makeWarning()],
          highest_severity: 'high',
        }),
      };
      generateRewriteSuggestion(input, options);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('globalThis.fetch is never called by generateTemplateSuggestion', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'unclear_task'] }),
        prompt_text: 'Test prompt with various content',
      };
      generateTemplateSuggestion(input, options);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('4.9 No prompt_text leakage', () => {
    const SENTINEL = 'SENTINEL_PROMPT_TEXT_DO_NOT_LEAK_xK9mZ2pQ';

    it('prompt_text sentinel not in generateRewriteSuggestion output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'possible_secret'] }),
        prompt_text: SENTINEL,
        safety_result: makeSafetyResult({
          warnings: [makeWarning()],
          highest_severity: 'high',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SENTINEL);
    });

    it('prompt_text sentinel not in generateTemplateSuggestion output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'unclear_task'] }),
        prompt_text: SENTINEL,
      };
      const result = generateTemplateSuggestion(input, options);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SENTINEL);
    });
  });

  describe('4.10 No matched secret substrings', () => {
    const SECRET_SENTINEL = 'SENTINEL_SECRET_VALUE_DO_NOT_LEAK_Qw3rTy9X';

    it('safety warning message sentinel not in rewrite suggestion output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['possible_secret'] }),
        prompt_text: 'some prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning({ message: SECRET_SENTINEL })],
          highest_severity: 'critical',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SECRET_SENTINEL);
    });

    it('safety warning message sentinel not in template suggestion output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['possible_secret'] }),
        prompt_text: 'some prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning({ message: SECRET_SENTINEL })],
          highest_severity: 'critical',
        }),
      };
      const result = generateTemplateSuggestion(input, options);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SECRET_SENTINEL);
    });
  });

  describe('4.11 No banned full-answer fields', () => {
    const BANNED_FIELDS = [
      'assistant_message',
      'response',
      'completion',
      'model_answer',
      'output_text',
      'generated_text',
    ];

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

    it('rewrite suggestion output has no banned field keys', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'possible_secret', 'unclear_task'] }),
        prompt_text: 'test prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning()],
          highest_severity: 'high',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const keys = recursiveKeys(result);
      for (const banned of BANNED_FIELDS) {
        expect(keys.has(banned)).toBe(false);
      }
    });

    it('template suggestion output has no banned field keys', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'unclear_task', 'missing_constraints'] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      const keys = recursiveKeys(result);
      for (const banned of BANNED_FIELDS) {
        expect(keys.has(banned)).toBe(false);
      }
    });

    it('banned field names do not appear in serialized rewrite output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'possible_secret'] }),
        prompt_text: 'test prompt',
        safety_result: makeSafetyResult({
          warnings: [makeWarning()],
          highest_severity: 'high',
        }),
      };
      const result = generateRewriteSuggestion(input, options);
      const serialized = JSON.stringify(result);
      for (const banned of BANNED_FIELDS) {
        expect(serialized).not.toContain(`"${banned}"`);
      }
    });

    it('banned field names do not appear in serialized template output', () => {
      const input: RewriteInput = {
        prompt_score: makeScore({ issue_labels: ['missing_context', 'unclear_task'] }),
        prompt_text: 'test prompt',
      };
      const result = generateTemplateSuggestion(input, options);
      const serialized = JSON.stringify(result);
      for (const banned of BANNED_FIELDS) {
        expect(serialized).not.toContain(`"${banned}"`);
      }
    });
  });
});
