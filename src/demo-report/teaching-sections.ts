/**
 * cookedPrompts - Demo Report Teaching Sections
 *
 * Deterministic coaching sections for model waste and safety/privacy lessons.
 * No I/O, no network, no raw secret values, no raw warning text.
 */

import type { BatchSummary, PromptResult } from '../integration-demo/types.js';
import type { ReportSection, RiskCategoryCount } from './types.js';
import { buildRedactedExcerpt } from './redaction.js';
import { humanizeIssueLabel } from './coaching-copy.js';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

const PLACEHOLDER_CATEGORY_LABELS: Record<string, string> = {
  '[REDACTED_SECRET]': 'Secret-like material',
  '[REDACTED_PASSWORD]': 'Passwords',
  '[REDACTED_TOKEN]': 'Tokens',
  '[REDACTED_INTERNAL_HOST]': 'Internal hosts',
  '[REDACTED_CUSTOMER_DATA]': 'Customer data',
  '[REDACTED_PERSONAL_DATA]': 'Personal data',
};

const PLACEHOLDER_SEVERITIES: Record<string, RiskCategoryCount['severity']> = {
  '[REDACTED_SECRET]': 'critical',
  '[REDACTED_PASSWORD]': 'high',
  '[REDACTED_TOKEN]': 'high',
  '[REDACTED_INTERNAL_HOST]': 'medium',
  '[REDACTED_CUSTOMER_DATA]': 'medium',
  '[REDACTED_PERSONAL_DATA]': 'low',
};

interface PlaceholderAggregate {
  placeholder: string;
  count: number;
  category: string;
  severity: RiskCategoryCount['severity'];
}

export function buildModelWasteSection(summary: BatchSummary): ReportSection | null {
  const issueCounts = summary.issue_label_counts;
  const overkillCount =
    (issueCounts.overpowered_model ?? 0) + (issueCounts.wrong_model_class ?? 0);
  const underfitCount =
    (issueCounts.needs_search ?? 0) + (issueCounts.needs_tool_use ?? 0);

  if (overkillCount === 0 && underfitCount === 0) {
    return null;
  }

  const modelEntries = Object.entries(summary.model_class_distribution)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  const totalModels = modelEntries.reduce((sum, [, count]) => sum + count, 0);
  const dominantEntry = modelEntries[0];
  const dominantModelNote =
    dominantEntry && modelEntries.length > 1 && totalModels > 0
      ? (() => {
          const dominantPct = Math.round((dominantEntry[1] / totalModels) * 100);
          if (dominantPct >= 70) {
            return `Most model recommendations point to ${dominantEntry[0]} (${dominantPct}%), so check whether that default is doing too much work.`;
          }
          return undefined;
        })()
      : undefined;

  const teachingPoints = [
    overkillCount > 0
      ? 'Some prompts asked for more model power than the task needed.'
      : 'The batch did not show a strong overkill pattern, but model fit still matters.',
    underfitCount > 0
      ? 'Some prompts needed search or tools instead of a stronger model.'
      : 'Grounded tasks should still ask for search or tool use when facts or workflows matter.',
    'Match model power to task risk, uncertainty, and required reasoning depth.',
  ];

  if (dominantModelNote) {
    teachingPoints.push(dominantModelNote);
  }

  const exampleHints = buildModelWasteHints(issueCounts, modelEntries);
  const coachingSummary =
    overkillCount > 0 && underfitCount > 0
      ? 'This batch has both overkill and underfit signals, which usually means model choice is being guessed instead of matched to the task.'
      : overkillCount > 0
        ? 'Several prompts used more model power than they needed; trim the default upward drift.'
        : 'Several prompts likely needed more grounding, search, or tool use than the current setup gave them.';

  return {
    kind: 'model_waste',
    heading: 'Model Waste / Overkill',
    summary: 'Model choice should follow the task, not habit.',
    overkill_count: overkillCount,
    underfit_count: underfitCount,
    teaching_points: teachingPoints,
    example_hints: exampleHints.length > 0 ? exampleHints : undefined,
    coaching_summary: coachingSummary,
  };
}

export function buildSafetyPrivacyLessonsSection(
  summary: BatchSummary,
  promptResults: PromptResult[],
): ReportSection | null {
  const safety = summary.safety_summary;
  const placeholderTotals = aggregatePlaceholderCounts(promptResults);
  const placeholderTotal = placeholderTotals.reduce((sum, entry) => sum + entry.count, 0);

  if (safety.prompts_with_warnings === 0 && placeholderTotal === 0) {
    return null;
  }

  const riskCategoryCounts = buildRiskCategoryCounts(safety.severity_counts, placeholderTotals);
  const lessonItems = buildLessonItems(safety.prompts_with_warnings, riskCategoryCounts);
  const placeholderExamples = placeholderTotals
    .slice(0, 4)
    .map((entry) => `${entry.placeholder} x${entry.count}`);

  return {
    kind: 'safety_privacy_lessons',
    heading: 'Safety & Privacy Lessons',
    summary:
      safety.prompts_with_warnings > 0 || placeholderTotal > 0
        ? 'Clean the sensitive parts before you reuse or share the prompt.'
        : 'No extra safety lessons were needed for this batch.',
    risk_category_counts: riskCategoryCounts.length > 0 ? riskCategoryCounts : undefined,
    lesson_items: lessonItems.length > 0 ? lessonItems : undefined,
    placeholder_examples: placeholderExamples.length > 0 ? placeholderExamples : undefined,
    redacted_prompt_hint:
      'If redaction still leaves sensitive context, keep the prompt local or rewrite it before sharing.',
    coaching_summary: buildSafetyCoachingSummary(safety.prompts_with_warnings, placeholderTotal),
  };
}

function buildModelWasteHints(
  issueCounts: Record<string, number>,
  modelEntries: Array<[string, number]>,
): string[] {
  const hints: string[] = [];

  const overpoweredCount = issueCounts.overpowered_model ?? 0;
  const wrongModelCount = issueCounts.wrong_model_class ?? 0;
  const needsSearchCount = issueCounts.needs_search ?? 0;
  const needsToolCount = issueCounts.needs_tool_use ?? 0;

  if (overpoweredCount > 0) {
    hints.push(
      `${humanizeIssueLabel('overpowered_model')} appeared ${overpoweredCount} time${overpoweredCount === 1 ? '' : 's'}; smaller models may be enough for some of these jobs.`,
    );
  }

  if (wrongModelCount > 0) {
    hints.push(
      `${humanizeIssueLabel('wrong_model_class')} appeared ${wrongModelCount} time${wrongModelCount === 1 ? '' : 's'}; the task may need a different capability class.`,
    );
  }

  if (needsSearchCount > 0) {
    hints.push(
      `${humanizeIssueLabel('needs_search')} showed up ${needsSearchCount} time${needsSearchCount === 1 ? '' : 's'}; grounded work should ask for search instead of guesswork.`,
    );
  }

  if (needsToolCount > 0) {
    hints.push(
      `${humanizeIssueLabel('needs_tool_use')} showed up ${needsToolCount} time${needsToolCount === 1 ? '' : 's'}; workflow tasks should ask for tools or checks.`,
    );
  }

  if (modelEntries.length > 1) {
    const [dominantClass, dominantCount] = modelEntries[0];
    const total = modelEntries.reduce((sum, [, count]) => sum + count, 0);
    const dominantPct = total > 0 ? Math.round((dominantCount / total) * 100) : 0;
    hints.push(
      `Model recommendations lean toward ${dominantClass} (${dominantPct}%), so check whether that default is doing too much of the work.`,
    );
  }

  return hints;
}

function buildRiskCategoryCounts(
  severityCounts: Record<string, number>,
  placeholderTotals: PlaceholderAggregate[],
): RiskCategoryCount[] {
  const counts: RiskCategoryCount[] = [];

  for (const severity of SEVERITY_ORDER) {
    const count = severityCounts[severity] ?? 0;
    if (count > 0) {
      counts.push({
        category: `${capitalize(severity)} safety warnings`,
        count,
        severity,
      });
    }
  }

  for (const entry of placeholderTotals) {
    counts.push({
      category: entry.category,
      count: entry.count,
      severity: entry.severity,
    });
  }

  return counts.sort(compareRiskEntries);
}

function buildLessonItems(
  warningCount: number,
  riskCategoryCounts: RiskCategoryCount[],
): string[] {
  const items: string[] = [];

  for (const entry of riskCategoryCounts.slice(0, 3)) {
    const placeholderMatch = PLACEHOLDER_CATEGORY_LABELS_REVERSE[entry.category];
    if (placeholderMatch) {
      items.push(
        `${entry.count} prompt${entry.count === 1 ? '' : 's'} included ${entry.category.toLowerCase()}; mask this as ${placeholderMatch} before reuse.`,
      );
      continue;
    }

    items.push(
      `${entry.count} prompt${entry.count === 1 ? '' : 's'} were flagged as ${entry.category.toLowerCase()}; keep them local until they are cleaned up.`,
    );
  }

  if (warningCount > 0) {
    items.push(
      `${warningCount} prompt${warningCount === 1 ? '' : 's'} had safety warnings; remove sensitive context before sharing outside the batch.`,
    );
  }

  return items;
}

function buildSafetyCoachingSummary(
  warningCount: number,
  placeholderTotal: number,
): string {
  if (placeholderTotal > 0 && warningCount > 0) {
    return 'This batch shows both safety warnings and redaction-worthy prompt content, so the safest habit is to clean prompts before reuse or sharing.';
  }

  if (placeholderTotal > 0) {
    return 'Sensitive prompt content showed up locally, which means the next habit is to redact before reuse.';
  }

  return 'Safety warnings appeared in the batch, so keep those prompts local until the risky context is removed.';
}

function aggregatePlaceholderCounts(
  promptResults: PromptResult[],
): PlaceholderAggregate[] {
  const counts: Record<string, number> = {};

  for (const result of promptResults) {
    const promptText = typeof result.prompt_text === 'string' ? result.prompt_text.trim() : '';
    if (!promptText) {
      continue;
    }

    const redaction = buildRedactedExcerpt(promptText);
    for (const [placeholder, count] of Object.entries(redaction.placeholder_counts)) {
      if (count > 0) {
        counts[placeholder] = (counts[placeholder] ?? 0) + count;
      }
    }
  }

  return Object.entries(counts)
    .map(([placeholder, count]) => ({
      placeholder,
      count,
      category: PLACEHOLDER_CATEGORY_LABELS[placeholder] ?? placeholder,
      severity: PLACEHOLDER_SEVERITIES[placeholder] ?? 'low',
    }))
    .sort(comparePlaceholderEntries);
}

function comparePlaceholderEntries(
  a: PlaceholderAggregate,
  b: PlaceholderAggregate,
): number {
  return compareRiskLikeEntries(a.severity, a.count, a.category, b.severity, b.count, b.category);
}

function compareRiskEntries(
  a: RiskCategoryCount,
  b: RiskCategoryCount,
): number {
  return compareRiskLikeEntries(a.severity, a.count, a.category, b.severity, b.count, b.category);
}

function compareRiskLikeEntries(
  aSeverity: RiskCategoryCount['severity'],
  aCount: number,
  aCategory: string,
  bSeverity: RiskCategoryCount['severity'],
  bCount: number,
  bCategory: string,
): number {
  const severityDelta = severityRank(bSeverity) - severityRank(aSeverity);
  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (bCount !== aCount) {
    return bCount - aCount;
  }

  return aCategory.localeCompare(bCategory);
}

function severityRank(severity: RiskCategoryCount['severity']): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

const PLACEHOLDER_CATEGORY_LABELS_REVERSE: Record<string, string> = {
  'Secret-like material': '[REDACTED_SECRET]',
  Passwords: '[REDACTED_PASSWORD]',
  Tokens: '[REDACTED_TOKEN]',
  'Internal hosts': '[REDACTED_INTERNAL_HOST]',
  'Customer data': '[REDACTED_CUSTOMER_DATA]',
  'Personal data': '[REDACTED_PERSONAL_DATA]',
};
