/**
 * Wave 4 — Task 4.2: Core types/constants and stable label tests.
 */

import { describe, it, expect } from 'vitest';

import {
  SCORING_ISSUE_LABELS,
  CAPABILITY_CLASSES,
  SCORING_VERSION,
  dedupeIssueLabels,
} from '../../src/scoring/index.js';

describe('scoring constants', () => {
  it('SCORING_ISSUE_LABELS has all 12 expected labels', () => {
    expect(SCORING_ISSUE_LABELS).toEqual([
      'missing_context',
      'unclear_task',
      'missing_constraints',
      'missing_output_format',
      'overbroad_prompt',
      'privacy_risk',
      'possible_secret',
      'wrong_model_class',
      'overpowered_model',
      'needs_search',
      'needs_tool_use',
      'too_long_for_task',
    ]);
  });

  it('CAPABILITY_CLASSES has all 9 expected classes', () => {
    expect(CAPABILITY_CLASSES).toEqual([
      'cheap_fast',
      'general_purpose',
      'coding',
      'deep_reasoning',
      'long_context',
      'tool_using',
      'search_required',
      'multimodal',
      'privacy_sensitive_local',
    ]);
  });

  it('SCORING_VERSION is non-empty and currently 1.0.0', () => {
    expect(SCORING_VERSION).toBe('1.0.0');
  });
});

describe('dedupeIssueLabels', () => {
  it('removes duplicates', () => {
    const result = dedupeIssueLabels(['unclear_task', 'unclear_task', 'privacy_risk']);
    // Canonical order: unclear_task (index 1) precedes privacy_risk (index 5).
    expect(result).toEqual(['unclear_task', 'privacy_risk']);
  });

  it('returns labels in canonical stable order regardless of input order', () => {
    const result = dedupeIssueLabels([
      'too_long_for_task',
      'missing_context',
      'needs_search',
    ]);
    expect(result).toEqual(['missing_context', 'needs_search', 'too_long_for_task']);
  });

  it('returns [] for empty input', () => {
    expect(dedupeIssueLabels([])).toEqual([]);
  });
});
