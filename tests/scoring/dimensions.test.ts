/**
 * Wave 4 — Task 4.4 / 4.8: Dimension scorer behavior + capability-fit labels.
 *
 * Scorers are internal — imported directly from their modules.
 */

import { describe, it, expect } from 'vitest';

import { extractSignals } from '../../src/scoring/signals.js';
import { scoreClarity } from '../../src/scoring/dimensions/clarity.js';
import { scoreContext } from '../../src/scoring/dimensions/context.js';
import { scoreConstraints } from '../../src/scoring/dimensions/constraints.js';
import { scoreOutputFormat } from '../../src/scoring/dimensions/output-format.js';
import { scoreCapabilityFit } from '../../src/scoring/dimensions/capability-fit.js';
import { scoreEfficiency } from '../../src/scoring/dimensions/efficiency.js';
import { scoreSafetyPrivacy } from '../../src/scoring/dimensions/safety-privacy.js';
import { makePromptLogEntry, FAKE_SECRET, FAKE_EMAIL } from './test-helpers.js';

function score(fn: typeof scoreClarity, prompt: string, overrides = {}) {
  const entry = makePromptLogEntry({ prompt_text: prompt, ...overrides });
  return fn(entry, extractSignals(entry));
}

describe('clarity scorer', () => {
  it('empty prompt scores 0 with unclear_task', () => {
    const r = score(scoreClarity, '');
    expect(r.score).toBe(0);
    expect(r.labels).toContain('unclear_task');
  });

  it('vague prompt scores low with unclear_task', () => {
    const r = score(scoreClarity, 'help');
    expect(r.labels).toContain('unclear_task');
    expect(r.score).toBeLessThanOrEqual(2);
  });
});

describe('context scorer', () => {
  it('low-context prompt emits missing_context and a low score', () => {
    const r = score(scoreContext, 'Explain stuff');
    expect(r.labels).toContain('missing_context');
    expect(r.score).toBeLessThanOrEqual(2);
  });
});

describe('constraints scorer', () => {
  it('missing constraints emits missing_constraints', () => {
    const r = score(scoreConstraints, 'Explain how photosynthesis works.');
    expect(r.labels).toContain('missing_constraints');
  });

  it('overbroad prompt emits overbroad_prompt', () => {
    const r = score(scoreConstraints, 'Build everything from scratch.');
    expect(r.labels).toContain('overbroad_prompt');
  });
});

describe('output-format scorer', () => {
  it('missing format emits missing_output_format', () => {
    const r = score(scoreOutputFormat, 'Explain how photosynthesis works.');
    expect(r.labels).toContain('missing_output_format');
  });
});

describe('capability-fit scorer', () => {
  it('current-info prompt emits needs_search', () => {
    const r = score(scoreCapabilityFit, 'What is the latest news today?', {
      model_used: '',
    });
    expect(r.labels).toContain('needs_search');
  });

  it('API/tool prompt emits needs_tool_use', () => {
    const r = score(scoreCapabilityFit, 'Call an API and fetch the data.', {
      model_used: '',
    });
    expect(r.labels).toContain('needs_tool_use');
  });

  it('uncovered required capability emits wrong_model_class', () => {
    const r = score(scoreCapabilityFit, 'Debug this python code and fix the error.', {
      model_used: 'cheap fast',
    });
    expect(r.labels).toContain('wrong_model_class');
    expect(r.score).toBeLessThanOrEqual(2);
  });

  it('simple task on a powerful model emits overpowered_model', () => {
    const r = score(scoreCapabilityFit, 'Say hello to the team.', {
      model_used: 'deep reasoning',
    });
    expect(r.labels).toContain('overpowered_model');
  });

  it('missing model metadata is neutral, no wrong_model_class', () => {
    const r = score(scoreCapabilityFit, 'Debug this python code.', {
      model_used: '',
    });
    expect(r.labels).not.toContain('wrong_model_class');
    expect(r.score).toBe(3);
  });
});

describe('efficiency scorer', () => {
  it('very long simple prompt emits too_long_for_task', () => {
    const longPrompt = 'Please make this note read a little nicer overall. '.repeat(30);
    const r = score(scoreEfficiency, longPrompt, { model_used: '' });
    expect(r.labels).toContain('too_long_for_task');
  });

  it('concise prompt scores high without too_long_for_task', () => {
    const r = score(scoreEfficiency, 'Write a short greeting for the team.', {
      model_used: '',
    });
    expect(r.labels).not.toContain('too_long_for_task');
    expect(r.score).toBeGreaterThanOrEqual(4);
  });
});

describe('safety/privacy scorer', () => {
  it('high-severity secret-like text emits possible_secret and scores <= 1 when not redacted', () => {
    const r = score(scoreSafetyPrivacy, `Here is my key: ${FAKE_SECRET}`, {
      redaction_status: 'none',
    });
    expect(r.labels).toContain('possible_secret');
    expect(r.score).toBeLessThanOrEqual(1);
    // Never leak the matched value.
    expect(JSON.stringify(r)).not.toContain(FAKE_SECRET);
  });

  it('fully redacted high-severity text relaxes but does not clear risk', () => {
    const r = score(scoreSafetyPrivacy, `Here is my key: ${FAKE_SECRET}`, {
      redaction_status: 'full',
    });
    expect(r.labels).toContain('possible_secret');
    expect(r.score).toBeGreaterThan(1);
    expect(r.score).toBeLessThanOrEqual(2);
  });

  it('email/personal data emits privacy_risk', () => {
    const r = score(scoreSafetyPrivacy, `Contact me at ${FAKE_EMAIL}.`, {
      redaction_status: 'none',
    });
    expect(r.labels).toContain('privacy_risk');
    expect(JSON.stringify(r)).not.toContain(FAKE_EMAIL);
  });

  it('clean prompt scores 5 with no safety labels', () => {
    const r = score(scoreSafetyPrivacy, 'Write a short greeting for the team.');
    expect(r.score).toBe(5);
    expect(r.labels).toHaveLength(0);
  });
});
