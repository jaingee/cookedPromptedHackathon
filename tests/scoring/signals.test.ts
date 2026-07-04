/**
 * Wave 4 — Task 4.3: Signal extraction tests.
 *
 * extractSignals is internal — imported directly from the module, never the
 * public barrel.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { extractSignals } from '../../src/scoring/signals.js';
import { makePromptLogEntry } from './test-helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extractSignals — markers', () => {
  it('detects format markers', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Return this as a json table.' }),
    );
    expect(s.hasFormatMarker).toBe(true);
  });

  it('detects constraint markers', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Keep it concise and under 100 words.' }),
    );
    expect(s.hasConstraintMarker).toBe(true);
  });

  it('detects context markers', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Given the project background and data, help.' }),
    );
    expect(s.hasContextMarker).toBe(true);
  });

  it('flags vagueTaskOnly for short vague prompts', () => {
    const s = extractSignals(makePromptLogEntry({ prompt_text: 'help' }));
    expect(s.vagueTaskOnly).toBe(true);
  });
});

describe('extractSignals — required capabilities', () => {
  it('includes search_required for current-events prompts', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'What is the latest news today?' }),
    );
    expect(s.requiredCapabilities).toContain('search_required');
  });

  it('includes tool_using for tool/API prompts', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Call an API and fetch the results.' }),
    );
    expect(s.requiredCapabilities).toContain('tool_using');
  });

  it('includes coding for code prompts', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Debug this python code and fix the error.' }),
    );
    expect(s.requiredCapabilities).toContain('coding');
  });

  it('includes privacy_sensitive_local for sensitive prompts', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'This is confidential customer data, summarize privately.' }),
    );
    expect(s.requiredCapabilities).toContain('privacy_sensitive_local');
  });

  it('falls back to general_purpose when no specific intent is detected', () => {
    const s = extractSignals(
      makePromptLogEntry({ prompt_text: 'Say hello to the team.' }),
    );
    expect(s.requiredCapabilities).toEqual(['general_purpose']);
  });
});

describe('extractSignals — metadata flags', () => {
  it('hasModelMetadata is false for blank model_used', () => {
    const s = extractSignals(makePromptLogEntry({ model_used: '   ' }));
    expect(s.hasModelMetadata).toBe(false);
  });

  it('hasModelMetadata is true when model_used is present', () => {
    const s = extractSignals(makePromptLogEntry({ model_used: 'general purpose' }));
    expect(s.hasModelMetadata).toBe(true);
  });

  it('hasUsageMetadata is true when at least one usage field is finite', () => {
    const s = extractSignals(makePromptLogEntry({ input_tokens: 120 }));
    expect(s.hasUsageMetadata).toBe(true);
  });

  it('hasUsageMetadata is false when all usage fields are null', () => {
    const s = extractSignals(makePromptLogEntry());
    expect(s.hasUsageMetadata).toBe(false);
  });
});

describe('extractSignals — privacy', () => {
  it('computes lowered internally', () => {
    const s = extractSignals(makePromptLogEntry({ prompt_text: 'MiXeD Case' }));
    expect(s.lowered).toBe('mixed case');
  });

  it('does not log prompt content', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    extractSignals(makePromptLogEntry({ prompt_text: 'secret marker text' }));
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
