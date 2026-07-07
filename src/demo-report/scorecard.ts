/**
 * cookedPrompts - Demo Report Score Helpers
 *
 * Deterministic helpers for 0-5 to 0-100 conversion and score bands.
 */

import type { CategoryScore100, ScoreBand } from './types.js';
import { DIMENSION_COACHING_NOTES, humanizeDimension } from './coaching-copy.js';

const CATEGORY_ORDER = [
  'clarity',
  'context',
  'constraints',
  'output_format',
  'capability_fit',
  'efficiency',
  'safety_privacy',
] as const;

export function toScore100(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }

  return Math.round(score * 20);
}

export function getScoreBand(score100: number | null | undefined): ScoreBand | null {
  if (score100 === null || score100 === undefined || Number.isNaN(score100)) {
    return null;
  }

  if (score100 <= 49) return 'Poor';
  if (score100 <= 69) return 'Okay';
  if (score100 <= 84) return 'Good';
  return 'Excellent';
}

export function getScoreBandInterpretation(scoreBand: ScoreBand | null): string {
  switch (scoreBand) {
    case 'Poor':
      return 'Your prompts are making the model work harder than it should.';
    case 'Okay':
      return 'You have workable habits, but they leak quality in repeatable ways.';
    case 'Good':
      return 'Your prompt habits are solid. A few cleaner patterns would lift results fast.';
    case 'Excellent':
      return 'Your prompts are doing the quiet professional thing: clear, efficient, and easy to follow.';
    default:
      return 'Not enough score data to rate this batch yet.';
  }
}

export function buildCategoryScores100(
  dimensionAverages: Record<string, number | null>,
): CategoryScore100[] {
  return CATEGORY_ORDER.map((key) => {
    const score100 = toScore100(dimensionAverages[key]);
    return {
      category: getCategoryLabel(key),
      score_100: score100,
      score_band: getScoreBand(score100),
      coaching_note:
        score100 !== null && score100 < 70
          ? DIMENSION_COACHING_NOTES[key]
          : undefined,
    };
  });
}

function getCategoryLabel(key: string): string {
  if (key === 'context') return 'Context';
  if (key === 'capability_fit') return 'Model Fit';
  return humanizeDimension(key).replace(' & Background', '');
}
