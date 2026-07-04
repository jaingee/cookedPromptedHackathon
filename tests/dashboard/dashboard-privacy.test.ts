/**
 * cookedPrompts — Dashboard Privacy Tests
 *
 * Verifies privacy guardrails: no prompt_text in aggregates/list DTOs,
 * no banned full-answer fields, no network calls during dashboard operations.
 * All data is synthetic. No real prompts, secrets, or model answers.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  setupDashboardTestDb,
  insertPromptWithScore,
  SYNTHETIC_PROMPT_TEXT,
  expectNoPromptText,
  expectNoBannedAnswerFields,
} from './dashboard-test-helpers.js';

// --- Privacy guardrails ---

describe('Dashboard privacy guardrails', () => {
  function setupWithData() {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
      overallScore: 3,
      confidence: 'medium',
      issueLabels: ['missing_constraints'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      promptText: SYNTHETIC_PROMPT_TEXT,
      overallScore: 5,
      confidence: 'high',
      issueLabels: ['unclear_task'],
    });
    return service;
  }

  it('getOverview has no prompt_text and no banned fields', () => {
    const service = setupWithData();
    const result = service.getOverview();
    expectNoPromptText(result);
    expectNoBannedAnswerFields(result);
  });

  it('listScores has no prompt_text and no banned fields', () => {
    const service = setupWithData();
    const result = service.listScores({ limit: 10 });
    expectNoPromptText(result);
    expectNoBannedAnswerFields(result);
  });

  it('getIssueLabelCounts has no prompt_text and no banned fields', () => {
    const service = setupWithData();
    const result = service.getIssueLabelCounts();
    expectNoPromptText(result);
    expectNoBannedAnswerFields(result);
  });

  it('getConfidenceCounts has no prompt_text and no banned fields', () => {
    const service = setupWithData();
    const result = service.getConfidenceCounts();
    expectNoPromptText(result);
    expectNoBannedAnswerFields(result);
  });

  it('getDimensionSummary has no prompt_text and no banned fields', () => {
    const service = setupWithData();
    const result = service.getDimensionSummary();
    expectNoPromptText(result);
    expectNoBannedAnswerFields(result);
  });

  it('getScoreDetail DOES contain prompt_text (intentional for local display)', () => {
    const service = setupWithData();
    const detail = service.getScoreDetail('s-1');
    expect(detail).not.toBeNull();
    expect(detail!.prompt_text).toBe(SYNTHETIC_PROMPT_TEXT);
  });

  it('source code does not use object spread on prompt logs', () => {
    const servicePath = resolve('src/dashboard/dashboard-data-service.ts');
    const source = readFileSync(servicePath, 'utf-8');
    // Must not contain ...entry or ...log (object spread on prompt logs)
    expect(source).not.toMatch(/\.\.\.entry/);
    expect(source).not.toMatch(/\.\.\.log/);
  });
});

// --- No-network tests ---

describe('Dashboard no-network guarantee', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('no fetch calls during any dashboard operation', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
    });

    // Call all 6 service methods
    service.getOverview();
    service.listScores({ limit: 10 });
    service.getScoreDetail('s-1');
    service.getIssueLabelCounts();
    service.getConfidenceCounts();
    service.getDimensionSummary();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
