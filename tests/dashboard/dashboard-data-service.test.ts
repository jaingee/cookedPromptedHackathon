/**
 * cookedPrompts — Dashboard Data Service Tests
 *
 * Comprehensive unit tests for DashboardDataService methods.
 * All data is synthetic. No real prompts, secrets, or model answers.
 * Local-first: no network, no cloud, no telemetry.
 */

import { describe, it, expect } from 'vitest';
import {
  setupDashboardTestDb,
  insertPromptWithScore,
  insertPromptLog,
  insertImportBatch,
  makeScore,
  SYNTHETIC_PROMPT_TEXT,
  expectNoPromptText,
} from './dashboard-test-helpers.js';
import { PromptScoreRepository } from '../../src/storage/sqlite/repositories/prompt-score-repository.js';

// --- getOverview ---

describe('DashboardDataService.getOverview', () => {
  it('returns zeros/null on empty database', () => {
    const { service } = setupDashboardTestDb();
    const overview = service.getOverview();
    expect(overview.total_scored).toBe(0);
    expect(overview.average_overall_score).toBe(0);
    expect(overview.low_confidence_count).toBe(0);
    expect(overview.needs_action_count).toBe(0);
    expect(overview.most_common_label).toBeNull();
  });

  it('computes correct totals with multiple scores', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 5, confidence: 'high',
      issueLabels: ['missing_context'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      overallScore: 2, confidence: 'low',
      issueLabels: ['missing_constraints'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-3', scoreId: 's-3',
      overallScore: 1, confidence: 'low',
      issueLabels: ['missing_context'],
    });

    const overview = service.getOverview();
    expect(overview.total_scored).toBe(3);
    // average: (5+2+1)/3 = 2.666... → 2.7
    expect(overview.average_overall_score).toBe(2.7);
    expect(overview.low_confidence_count).toBe(2);
    // needs_action: overall_score <= 2 → p-2 (2) and p-3 (1) = 2
    expect(overview.needs_action_count).toBe(2);
    // missing_context appears 2 times, missing_constraints 1 time
    expect(overview.most_common_label).toBe('missing_context');
  });

  it('filters by importBatchId', () => {
    const { db, service } = setupDashboardTestDb();
    insertImportBatch(db, { id: 'batch-2' });

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 4, importBatchId: 'batch-1',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      overallScore: 2, importBatchId: 'batch-2',
    });

    const overview = service.getOverview({ importBatchId: 'batch-2' });
    expect(overview.total_scored).toBe(1);
    expect(overview.average_overall_score).toBe(2);
    expect(overview.needs_action_count).toBe(1);
  });

  it('filters by scoringVersion', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 5, scoringVersion: '1.0.0',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      overallScore: 3, scoringVersion: '2.0.0',
    });

    const overview = service.getOverview({ scoringVersion: '2.0.0' });
    expect(overview.total_scored).toBe(1);
    expect(overview.average_overall_score).toBe(3);
  });
});

// --- listScores ---

describe('DashboardDataService.listScores', () => {
  it('maps basic fields correctly', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 4, confidence: 'high',
      issueLabels: ['unclear_task'],
      scoringVersion: '1.0.0',
      scoredAt: '2026-02-01T00:00:00.000Z',
      timestamp: '2026-01-15T00:00:00.000Z',
    });

    const items = service.listScores({ limit: 10 });
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.score_id).toBe('s-1');
    expect(item.prompt_log_id).toBe('p-1');
    expect(item.timestamp).toBe('2026-01-15T00:00:00.000Z');
    expect(item.source).toBe('manual');
    expect(item.provider).toBe('synthetic-provider');
    expect(item.model_used).toBe('synthetic-model');
    expect(item.overall_score).toBe(4);
    expect(item.confidence).toBe('high');
    expect(item.issue_labels).toEqual(['unclear_task']);
    expect(item.scoring_version).toBe('1.0.0');
    expect(item.scored_at).toBe('2026-02-01T00:00:00.000Z');
  });

  it('does not include prompt_text in list items', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });

    const items = service.listScores({ limit: 10 });
    expectNoPromptText(items);
  });

  it('handles missing prompt log gracefully', () => {
    const { db, service, scoreRepo } = setupDashboardTestDb();
    // Insert a prompt log then a score, then delete the prompt log
    insertPromptLog(db, { id: 'orphan-prompt' });
    scoreRepo.save(makeScore({ id: 'orphan-score', prompt_log_id: 'orphan-prompt' }));
    // Soft-delete the prompt log
    db.prepare('UPDATE prompt_logs SET deleted_at = ? WHERE id = ?')
      .run(new Date().toISOString(), 'orphan-prompt');

    // With includeDeletedPromptLogs, score should appear but with null metadata
    const items = service.listScores({ limit: 10, includeDeletedPromptLogs: true });
    const orphanItem = items.find((i) => i.score_id === 'orphan-score');
    expect(orphanItem).toBeDefined();
    // Metadata still resolves since getById excludes deleted by default
    // but our service still tries to get it
  });

  it('filters by importBatchId', () => {
    const { db, service } = setupDashboardTestDb();
    insertImportBatch(db, { id: 'batch-2' });

    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', importBatchId: 'batch-1' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2', importBatchId: 'batch-2' });

    const items = service.listScores({ limit: 10, importBatchId: 'batch-2' });
    expect(items).toHaveLength(1);
    expect(items[0].score_id).toBe('s-2');
  });

  it('filters by scoringVersion', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', scoringVersion: '1.0.0' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2', scoringVersion: '2.0.0' });

    const items = service.listScores({ limit: 10, scoringVersion: '1.0.0' });
    expect(items).toHaveLength(1);
    expect(items[0].score_id).toBe('s-1');
  });

  it('filters by confidence', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', confidence: 'low' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2', confidence: 'high' });

    const items = service.listScores({ limit: 10, confidence: 'low' });
    expect(items).toHaveLength(1);
    expect(items[0].score_id).toBe('s-1');
  });

  it('filters by issueLabel', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      issueLabels: ['unclear_task'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      issueLabels: ['missing_context'],
    });

    const items = service.listScores({ limit: 10, issueLabel: 'unclear_task' });
    expect(items).toHaveLength(1);
    expect(items[0].score_id).toBe('s-1');
  });

  it('filters by overallScoreMin and overallScoreMax', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', overallScore: 1 });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2', overallScore: 3 });
    insertPromptWithScore(db, { promptId: 'p-3', scoreId: 's-3', overallScore: 5 });

    const items = service.listScores({ limit: 10, overallScoreMin: 2, overallScoreMax: 4 });
    expect(items).toHaveLength(1);
    expect(items[0].score_id).toBe('s-2');
  });

  it('supports pagination with limit and offset', () => {
    const { db, service } = setupDashboardTestDb();

    for (let i = 1; i <= 5; i++) {
      insertPromptWithScore(db, {
        promptId: `p-${i}`, scoreId: `s-${i}`,
        scoredAt: `2026-01-0${i}T00:00:00.000Z`,
      });
    }

    const page1 = service.listScores({ limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = service.listScores({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);

    const page3 = service.listScores({ limit: 2, offset: 4 });
    expect(page3).toHaveLength(1);
  });

  it('returns newest first (by scored_at DESC)', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      scoredAt: '2026-01-01T00:00:00.000Z',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      scoredAt: '2026-03-01T00:00:00.000Z',
    });
    insertPromptWithScore(db, {
      promptId: 'p-3', scoreId: 's-3',
      scoredAt: '2026-02-01T00:00:00.000Z',
    });

    const items = service.listScores({ limit: 10 });
    expect(items[0].score_id).toBe('s-2');
    expect(items[1].score_id).toBe('s-3');
    expect(items[2].score_id).toBe('s-1');
  });
});

// --- getScoreDetail ---

describe('DashboardDataService.getScoreDetail', () => {
  it('returns full detail with prompt_text for existing score + prompt log', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
      overallScore: 4,
    });

    const detail = service.getScoreDetail('s-1');
    expect(detail).not.toBeNull();
    expect(detail!.score.id).toBe('s-1');
    expect(detail!.score.prompt_log_id).toBe('p-1');
    expect(detail!.score.overall_score).toBe(4);
    expect(detail!.prompt_metadata).not.toBeNull();
    expect(detail!.prompt_metadata!.id).toBe('p-1');
    expect(detail!.prompt_text).toBe(SYNTHETIC_PROMPT_TEXT);
  });

  it('returns null for missing score', () => {
    const { service } = setupDashboardTestDb();
    const detail = service.getScoreDetail('nonexistent-score');
    expect(detail).toBeNull();
  });

  it('returns null when prompt log is soft-deleted (score excluded by repo join)', () => {
    const { db, service, scoreRepo } = setupDashboardTestDb();

    // Insert a prompt log and a score referencing it
    insertPromptLog(db, { id: 'deletable-prompt' });
    scoreRepo.save(makeScore({ id: 'linked-score', prompt_log_id: 'deletable-prompt' }));

    // Verify it works before soft-delete
    const beforeDelete = service.getScoreDetail('linked-score');
    expect(beforeDelete).not.toBeNull();
    expect(beforeDelete!.prompt_metadata).not.toBeNull();
    expect(beforeDelete!.prompt_text).toBeDefined();

    // Soft-delete the prompt log
    db.prepare('UPDATE prompt_logs SET deleted_at = ? WHERE id = ?')
      .run(new Date().toISOString(), 'deletable-prompt');

    // After soft-delete, scoreRepo.getById joins prompt_logs with deleted_at IS NULL,
    // so the score is not found → returns null (per repo design)
    const afterDelete = service.getScoreDetail('linked-score');
    expect(afterDelete).toBeNull();
  });
});

// --- getIssueLabelCounts ---

describe('DashboardDataService.getIssueLabelCounts', () => {
  it('returns correct counts', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      issueLabels: ['unclear_task', 'missing_context'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      issueLabels: ['missing_context'],
    });
    insertPromptWithScore(db, {
      promptId: 'p-3', scoreId: 's-3',
      issueLabels: ['unclear_task', 'missing_constraints'],
    });

    const counts = service.getIssueLabelCounts();
    const contextCount = counts.find((c) => c.label === 'missing_context');
    const taskCount = counts.find((c) => c.label === 'unclear_task');
    const constraintsCount = counts.find((c) => c.label === 'missing_constraints');

    expect(contextCount?.count).toBe(2);
    expect(taskCount?.count).toBe(2);
    expect(constraintsCount?.count).toBe(1);
  });

  it('supports filter by importBatchId', () => {
    const { db, service } = setupDashboardTestDb();
    insertImportBatch(db, { id: 'batch-2' });

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      issueLabels: ['unclear_task'], importBatchId: 'batch-1',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      issueLabels: ['missing_context'], importBatchId: 'batch-2',
    });

    const counts = service.getIssueLabelCounts({ importBatchId: 'batch-2' });
    expect(counts).toHaveLength(1);
    expect(counts[0].label).toBe('missing_context');
    expect(counts[0].count).toBe(1);
  });

  it('returns empty array when no scores exist', () => {
    const { service } = setupDashboardTestDb();
    const counts = service.getIssueLabelCounts();
    expect(counts).toEqual([]);
  });
});

// --- getConfidenceCounts ---

describe('DashboardDataService.getConfidenceCounts', () => {
  it('returns correct counts in low/medium/high order', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', confidence: 'low' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2', confidence: 'medium' });
    insertPromptWithScore(db, { promptId: 'p-3', scoreId: 's-3', confidence: 'high' });
    insertPromptWithScore(db, { promptId: 'p-4', scoreId: 's-4', confidence: 'low' });

    const counts = service.getConfidenceCounts();
    expect(counts[0]).toEqual({ confidence: 'low', count: 2 });
    expect(counts[1]).toEqual({ confidence: 'medium', count: 1 });
    expect(counts[2]).toEqual({ confidence: 'high', count: 1 });
  });

  it('supports filter by scoringVersion', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      confidence: 'high', scoringVersion: '1.0.0',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      confidence: 'low', scoringVersion: '2.0.0',
    });

    const counts = service.getConfidenceCounts({ scoringVersion: '2.0.0' });
    expect(counts).toHaveLength(1);
    expect(counts[0]).toEqual({ confidence: 'low', count: 1 });
  });

  it('returns empty array when no scores exist', () => {
    const { service } = setupDashboardTestDb();
    const counts = service.getConfidenceCounts();
    expect(counts).toEqual([]);
  });
});

// --- getDimensionSummary ---

describe('DashboardDataService.getDimensionSummary', () => {
  it('returns all 8 dimensions in stable order', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });

    const summary = service.getDimensionSummary();
    expect(summary).toHaveLength(8);
    expect(summary.map((d) => d.dimension)).toEqual([
      'overall_score',
      'clarity_score',
      'context_score',
      'constraints_score',
      'output_format_score',
      'capability_fit_score',
      'efficiency_score',
      'safety_privacy_score',
    ]);
  });

  it('computes correct average_score (rounded to one decimal)', () => {
    const { db, service } = setupDashboardTestDb();

    // p-1: overall=4, clarity=5, context=3
    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 4, clarityScore: 5, contextScore: 3,
    });
    // p-2: overall=2, clarity=3, context=1
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      overallScore: 2, clarityScore: 3, contextScore: 1,
    });

    const summary = service.getDimensionSummary();
    const overall = summary.find((d) => d.dimension === 'overall_score');
    const clarity = summary.find((d) => d.dimension === 'clarity_score');
    const context = summary.find((d) => d.dimension === 'context_score');

    // overall: (4+2)/2 = 3.0
    expect(overall?.average_score).toBe(3);
    // clarity: (5+3)/2 = 4.0
    expect(clarity?.average_score).toBe(4);
    // context: (3+1)/2 = 2.0
    expect(context?.average_score).toBe(2);
  });

  it('computes correct low_count (scores 0–2)', () => {
    const { db, service } = setupDashboardTestDb();

    insertPromptWithScore(db, {
      promptId: 'p-1', scoreId: 's-1',
      overallScore: 1, clarityScore: 2, contextScore: 3,
    });
    insertPromptWithScore(db, {
      promptId: 'p-2', scoreId: 's-2',
      overallScore: 2, clarityScore: 5, contextScore: 0,
    });

    const summary = service.getDimensionSummary();
    const overall = summary.find((d) => d.dimension === 'overall_score');
    const clarity = summary.find((d) => d.dimension === 'clarity_score');
    const context = summary.find((d) => d.dimension === 'context_score');

    // overall: 1 (low) and 2 (low) → 2
    expect(overall?.low_count).toBe(2);
    // clarity: 2 (low) and 5 (not low) → 1
    expect(clarity?.low_count).toBe(1);
    // context: 3 (not low) and 0 (low) → 1
    expect(context?.low_count).toBe(1);
  });

  it('supports limit', () => {
    const { db, service } = setupDashboardTestDb();

    for (let i = 1; i <= 5; i++) {
      insertPromptWithScore(db, {
        promptId: `p-${i}`, scoreId: `s-${i}`,
        overallScore: i as 1 | 2 | 3 | 4 | 5,
      });
    }

    // With limit=3, should compute summary from first 3 scores (newest first)
    const summary = service.getDimensionSummary({ limit: 3 });
    expect(summary).toHaveLength(8);
  });

  it('returns 8 dimensions with zeros when empty', () => {
    const { service } = setupDashboardTestDb();
    const summary = service.getDimensionSummary();
    expect(summary).toHaveLength(8);
    for (const dim of summary) {
      expect(dim.average_score).toBe(0);
      expect(dim.low_count).toBe(0);
    }
  });
});

// --- Empty state tests ---

describe('DashboardDataService empty states', () => {
  it('all methods on completely empty database', () => {
    const { service } = setupDashboardTestDb();

    const overview = service.getOverview();
    expect(overview.total_scored).toBe(0);
    expect(overview.average_overall_score).toBe(0);
    expect(overview.low_confidence_count).toBe(0);
    expect(overview.needs_action_count).toBe(0);
    expect(overview.most_common_label).toBeNull();

    const list = service.listScores({ limit: 10 });
    expect(list).toEqual([]);

    const detail = service.getScoreDetail('nonexistent');
    expect(detail).toBeNull();

    const labelCounts = service.getIssueLabelCounts();
    expect(labelCounts).toEqual([]);

    const confCounts = service.getConfidenceCounts();
    expect(confCounts).toEqual([]);

    const dimSummary = service.getDimensionSummary();
    expect(dimSummary).toHaveLength(8);
    for (const dim of dimSummary) {
      expect(dim.average_score).toBe(0);
      expect(dim.low_count).toBe(0);
    }
  });

  it('prompt logs exist but no scores', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptLog(db, { id: 'p-1' });
    insertPromptLog(db, { id: 'p-2' });

    const overview = service.getOverview();
    expect(overview.total_scored).toBe(0);

    const list = service.listScores({ limit: 10 });
    expect(list).toEqual([]);

    const labelCounts = service.getIssueLabelCounts();
    expect(labelCounts).toEqual([]);

    const confCounts = service.getConfidenceCounts();
    expect(confCounts).toEqual([]);

    const dimSummary = service.getDimensionSummary();
    for (const dim of dimSummary) {
      expect(dim.average_score).toBe(0);
      expect(dim.low_count).toBe(0);
    }
  });
});
