/**
 * cookedPrompts — Demo Report Section Builders
 *
 * Pure deterministic builder functions for each report section.
 * Each returns a ReportSection. No I/O, no mutation, no raw prompt_text.
 *
 * Sorting rules:
 * - Dimensions: ascending by score, null last
 * - Issues: frequency desc, alpha tiebreaker
 * - Model classes: frequency desc, alpha tiebreaker
 * - Templates: frequency desc, name alpha tiebreaker
 * - Actions: priority asc
 */

import type { ReportSection, CoachingAction } from './types.js';
import type {
  BatchSummary,
  PipelineMetadata,
  PromptResult,
} from '../integration-demo/types.js';
import {
  ISSUE_LABEL_COACHING_NOTES,
  DIMENSION_COACHING_NOTES,
  GENERAL_ENCOURAGEMENT_ACTIONS,
  humanizeDimension,
  humanizeIssueLabel,
} from './coaching-copy.js';
import {
  buildPromptExamplesSection,
  buildPromptHighlightsSections,
} from './prompt-examples.js';
import {
  buildModelWasteSection,
  buildSafetyPrivacyLessonsSection,
} from './teaching-sections.js';
import {
  buildCategoryScores100,
  getScoreBand,
  getScoreBandInterpretation,
  toScore100,
} from './scorecard.js';

/**
 * 1. Batch Verdict — total, success rate, score band, and quick coaching read.
 */
export function buildBatchVerdict(
  summary: BatchSummary,
  metadata: PipelineMetadata,
): ReportSection {
  const successPct =
    summary.total_prompts > 0
      ? Math.round((summary.succeeded / summary.total_prompts) * 100)
      : 0;
  const overallScore100 = toScore100(summary.average_overall_score);
  const scoreBand = getScoreBand(overallScore100);
  const commonIssue = summary.most_common_labels[0];

  return {
    kind: 'batch_verdict',
    heading: 'Batch Verdict',
    summary:
      summary.total_prompts === 0
        ? 'No prompts analyzed yet, so there is no batch verdict to grade.'
        : `${getScoreBandInterpretation(scoreBand)} ${
            commonIssue
              ? `Main drag on results: ${humanizeIssueLabel(commonIssue)}.`
              : 'No single issue pattern dominated this batch.'
          }`,
    overall_score_100: overallScore100,
    score_band: scoreBand,
    metrics: [
      { label: 'Total prompts', value: summary.total_prompts },
      { label: 'Succeeded', value: summary.succeeded },
      { label: 'Failed', value: summary.failed },
      { label: 'Success rate', value: successPct, unit: '%' },
      { label: 'Duration', value: metadata.total_duration_ms, unit: 'ms' },
    ],
    coaching_notes:
      summary.total_prompts > 0
        ? [
            `This verdict is based on aggregate local scoring across ${summary.total_prompts} prompt${summary.total_prompts === 1 ? '' : 's'}.`,
          ]
        : undefined,
  };
}

/**
 * 2. Prompt Habit Score — overall batch score in Lighthouse-style 0-100 form.
 */
export function buildPromptHabitScore(summary: BatchSummary): ReportSection {
  const overallScore100 = toScore100(summary.average_overall_score);
  const scoreBand = getScoreBand(overallScore100);

  if (overallScore100 === null) {
    return {
      kind: 'prompt_habit_score',
      heading: 'Prompt Habit Score',
      summary: 'Not enough scored prompts to calculate a habit score yet.',
      overall_score_100: null,
      score_band: null,
    };
  }

  return {
    kind: 'prompt_habit_score',
    heading: 'Prompt Habit Score',
    summary: getScoreBandInterpretation(scoreBand),
    overall_score_100: overallScore100,
    score_band: scoreBand,
  };
}

/**
 * 3. Category Scorecard — fixed category list using 0-100 score conversion.
 */
export function buildCategoryScorecard(summary: BatchSummary): ReportSection {
  const categoryScores = buildCategoryScores100(summary.dimension_averages);
  const coaching_notes = categoryScores
    .filter((entry) => entry.score_100 !== null && entry.score_100 < 70)
    .slice(0, 2)
    .map((entry) => entry.coaching_note)
    .filter((note): note is string => note !== undefined);

  return {
    kind: 'category_scorecard',
    heading: 'Category Scorecard',
    summary: 'Fixed-category scoring so you can spot weak habits quickly.',
    category_scores_100: categoryScores,
    coaching_notes: coaching_notes.length > 0 ? coaching_notes : undefined,
  };
}

/**
 * 4. What Kept Hurting Results — top N issues by frequency with coaching notes.
 */
export function buildIssuePatterns(
  summary: BatchSummary,
  maxIssues: number,
): ReportSection {
  const counts = summary.issue_label_counts;
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return {
      kind: 'issue_patterns',
      heading: 'What Kept Hurting Results',
      summary: 'No recurring issues detected. Your prompts are clean.',
    };
  }

  // Sort: frequency desc, alpha tiebreaker
  const sorted = entries
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxIssues);

  const items = sorted.map(
    ([label, count]) => `${humanizeIssueLabel(label)} (×${count})`,
  );

  const coaching_notes = sorted
    .map(([label]) => ISSUE_LABEL_COACHING_NOTES[label])
    .filter((note): note is string => note !== undefined);

  const section: ReportSection = {
    kind: 'issue_patterns',
    heading: 'What Kept Hurting Results',
    summary: `Found ${sorted.length} recurring issue pattern${sorted.length === 1 ? '' : 's'}.`,
    items,
  };

  if (coaching_notes.length > 0) {
    section.coaching_notes = coaching_notes;
  }

  return section;
}

/**
 * 5. Safety / Privacy — warnings count, severity breakdown, do_not_send_external.
 */
/**
 * 4. Prompt Examples â€” redacted local examples from the weakest prompts.
 */
export function buildPromptExamples(
  promptResults: PromptResult[],
  maxPromptExamples: number,
): ReportSection | null {
  return buildPromptExamplesSection(promptResults, maxPromptExamples);
}

/**
 * 4. Coaching highlights â€” Roast of the Batch and One Good Prompt Worth Copying.
 */
export function buildPromptHighlights(
  promptResults: PromptResult[],
): ReportSection[] {
  const highlights = buildPromptHighlightsSections(promptResults);
  const sections: ReportSection[] = [];

  if (highlights.roast_of_the_batch) {
    sections.push(highlights.roast_of_the_batch);
  }

  if (highlights.copy_worthy_prompt) {
    sections.push(highlights.copy_worthy_prompt);
  }

  return sections;
}

/**
 * 5. Safety / Privacy â€” warnings count, severity breakdown, do_not_send_external.
 */
export function buildSafetyPrivacy(summary: BatchSummary): ReportSection {
  const safety = summary.safety_summary;

  if (safety.prompts_with_warnings === 0) {
    return {
      kind: 'safety_privacy',
      heading: 'Safety & Privacy',
      summary:
        'No safety warnings were detected by the local scan.',
      metrics: [
        { label: 'Prompts with warnings', value: 0 },
        { label: 'Do not send externally', value: 0 },
      ],
    };
  }

  // Severity breakdown sorted: critical → high → medium → low
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const severityCounts = safety.severity_counts;
  const severityItems: string[] = [];

  for (const sev of severityOrder) {
    if (severityCounts[sev] && severityCounts[sev] > 0) {
      severityItems.push(`${capitalize(sev)} warnings: ${severityCounts[sev]}`);
    }
  }

  // Include any unknown severity levels sorted alphabetically
  const knownSet = new Set(severityOrder);
  const unknownSeverities = Object.entries(severityCounts)
    .filter(([key, val]) => !knownSet.has(key) && val > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, val] of unknownSeverities) {
    severityItems.push(`${capitalize(key)} warnings: ${val}`);
  }

  return {
    kind: 'safety_privacy',
    heading: 'Safety & Privacy',
    summary: `${safety.prompts_with_warnings} prompt${safety.prompts_with_warnings === 1 ? '' : 's'} flagged with safety warnings.`,
    metrics: [
      { label: 'Prompts with warnings', value: safety.prompts_with_warnings },
      { label: 'Do not send externally', value: safety.do_not_send_external_count },
    ],
    items: severityItems.length > 0 ? severityItems : undefined,
    coaching_notes:
      safety.do_not_send_external_count > 0
        ? ['Some prompts should not be sent to external models. Review and redact before routing.']
        : undefined,
  };
}

/**
 * 6. Model Recommendations — class distribution sorted by frequency.
 */
/**
 * 5a. Model Waste / Overkill â€” overpowered model and underfit model fit signals.
 */
export function buildModelWaste(summary: BatchSummary): ReportSection | null {
  return buildModelWasteSection(summary);
}

/**
 * 5b. Safety & Privacy Lessons â€” action-oriented redaction and sharing guidance.
 */
export function buildSafetyPrivacyLessons(
  summary: BatchSummary,
  promptResults: PromptResult[],
): ReportSection | null {
  return buildSafetyPrivacyLessonsSection(summary, promptResults);
}

export function buildModelRecommendations(summary: BatchSummary): ReportSection {
  const dist = summary.model_class_distribution;
  const entries = Object.entries(dist);

  if (entries.length === 0) {
    return {
      kind: 'model_recommendations',
      heading: 'Model Recommendations',
      summary: 'No model recommendations available.',
    };
  }

  // Sort: frequency desc, alpha tiebreaker
  const sorted = entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const total = sorted.reduce((sum, [, count]) => sum + count, 0);
  const items = sorted.map(
    ([cls, count]) => `${cls}: ${count} (${Math.round((count / total) * 100)}%)`,
  );

  // Dominant class coaching note when >70%
  const coaching_notes: string[] = [];
  if (total > 0) {
    const [dominantClass, dominantCount] = sorted[0];
    const dominantPct = (dominantCount / total) * 100;
    if (dominantPct > 70) {
      coaching_notes.push(
        `${Math.round(dominantPct)}% of your prompts map to "${dominantClass}". Consider diversifying your model usage for different task types.`,
      );
    }
  }

  const section: ReportSection = {
    kind: 'model_recommendations',
    heading: 'Model Recommendations',
    summary: `Model class distribution across ${total} recommendation${total === 1 ? '' : 's'}.`,
    items,
  };

  if (coaching_notes.length > 0) {
    section.coaching_notes = coaching_notes;
  }

  return section;
}

/**
 * 7. Rewrite / Template Coaching — severity distribution, top N templates.
 */
export function buildRewriteCoaching(
  promptResults: PromptResult[],
  maxTemplates: number,
): ReportSection {
  // Severity distribution from rewrite suggestions
  const severityDist: Record<string, number> = {};
  let rewriteCount = 0;

  // Template frequency from template suggestions
  const templateFreq: Record<string, number> = {};

  for (const result of promptResults) {
    if (result.rewrite_suggestion) {
      rewriteCount++;
      const sev = result.rewrite_suggestion.overall_severity ?? 'unknown';
      severityDist[sev] = (severityDist[sev] ?? 0) + 1;
    }
    if (result.template_suggestion) {
      const templates = result.template_suggestion.suggested_templates ?? [];
      for (const tmpl of templates) {
        const name = tmpl.template_name ?? 'unnamed';
        templateFreq[name] = (templateFreq[name] ?? 0) + 1;
      }
    }
  }

  if (rewriteCount === 0 && Object.keys(templateFreq).length === 0) {
    return {
      kind: 'rewrite_coaching',
      heading: 'Rewrite & Template Coaching',
      summary: 'Your prompts need minimal coaching. Nice work.',
    };
  }

  const items: string[] = [];

  // Severity distribution items
  if (rewriteCount > 0) {
    const sevEntries = Object.entries(severityDist).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    for (const [sev, count] of sevEntries) {
      items.push(`Rewrite severity "${sev}": ${count}`);
    }
  }

  // Top N templates by frequency
  const templateEntries = Object.entries(templateFreq)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxTemplates);

  for (const [name, count] of templateEntries) {
    items.push(`Template "${name}": suggested ${count} time${count === 1 ? '' : 's'}`);
  }

  return {
    kind: 'rewrite_coaching',
    heading: 'Rewrite & Template Coaching',
    summary: `${rewriteCount} prompt${rewriteCount === 1 ? '' : 's'} received rewrite suggestions.`,
    items: items.length > 0 ? items : undefined,
  };
}

/**
 * 8. Top Fixes Checklist — 3–5 prioritized actions.
 * Priority order: safety → issues → dimensions → model fit.
 * Pads to min 3 with general encouragement.
 */
export function buildNextActions(
  summary: BatchSummary,
  promptResults: PromptResult[],
  maxActions: number,
): ReportSection {
  const actions: CoachingAction[] = [];
  let priority = 1;

  // Safety actions (priority 1)
  if (summary.safety_summary.do_not_send_external_count > 0) {
    actions.push({
      priority: priority++,
      action: `Review ${summary.safety_summary.do_not_send_external_count} prompt${summary.safety_summary.do_not_send_external_count === 1 ? '' : 's'} flagged as unsafe for external routing.`,
      source: 'safety',
    });
  }
  if (summary.safety_summary.prompts_with_warnings > 0 && actions.length === 0) {
    actions.push({
      priority: priority++,
      action: `Investigate ${summary.safety_summary.prompts_with_warnings} prompt${summary.safety_summary.prompts_with_warnings === 1 ? '' : 's'} with safety warnings.`,
      source: 'safety',
    });
  }

  // Issue actions (priority 2+)
  const topIssues = Object.entries(summary.issue_label_counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 2);

  for (const [label, count] of topIssues) {
    if (actions.length >= maxActions) break;
    const note = ISSUE_LABEL_COACHING_NOTES[label];
    actions.push({
      priority: priority++,
      action: note
        ? `Fix "${humanizeIssueLabel(label)}" (appeared ${count}×): ${note}`
        : `Address "${humanizeIssueLabel(label)}" issue (appeared ${count}×).`,
      source: 'issue',
    });
  }

  // Dimension actions
  const dimEntries = Object.entries(summary.dimension_averages)
    .filter(([, val]) => val !== null && val < 3.0)
    .sort((a, b) => {
      const aVal = a[1] as number;
      const bVal = b[1] as number;
      if (aVal !== bVal) return aVal - bVal;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 1);

  for (const [dim] of dimEntries) {
    if (actions.length >= maxActions) break;
    const note = DIMENSION_COACHING_NOTES[dim];
    actions.push({
      priority: priority++,
      action: note
        ? `Improve ${humanizeDimension(dim)}: ${note}`
        : `Work on your ${humanizeDimension(dim)} scores.`,
      source: 'dimension',
    });
  }

  // Model fit actions
  const modelEntries = Object.entries(summary.model_class_distribution)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

  if (modelEntries.length > 0) {
    const total = modelEntries.reduce((sum, [, count]) => sum + count, 0);
    const [dominantClass, dominantCount] = modelEntries[0];
    const dominantPct = total > 0 ? (dominantCount / total) * 100 : 0;
    if (dominantPct > 70 && actions.length < maxActions) {
      actions.push({
        priority: priority++,
        action: `Diversify model usage — ${Math.round(dominantPct)}% of prompts route to "${dominantClass}".`,
        source: 'model',
      });
    }
  }

  // Pad to min 3 with general encouragement
  let encourageIdx = 0;
  while (actions.length < 3 && encourageIdx < GENERAL_ENCOURAGEMENT_ACTIONS.length) {
    actions.push({
      priority: priority++,
      action: GENERAL_ENCOURAGEMENT_ACTIONS[encourageIdx],
      source: 'encouragement',
    });
    encourageIdx++;
  }

  // Cap at maxActions
  const finalActions = actions.slice(0, maxActions);

  const items = finalActions.map(
    (a) => {
      const prefix = formatActionSource(a.source);
      return prefix ? `${prefix} ${a.action}` : a.action;
    },
  );

  return {
    kind: 'next_actions',
    heading: 'Top Fixes Checklist',
    summary: `${finalActions.length} prioritized action${finalActions.length === 1 ? '' : 's'} to improve your prompt habits.`,
    items,
  };
}

/** Map action source to a clean human-readable prefix. */
function formatActionSource(source: string): string {
  switch (source) {
    case 'safety': return 'Safety:';
    case 'issue': return 'Issue:';
    case 'dimension': return 'Prompt health:';
    case 'model': return 'Model fit:';
    case 'encouragement': return '';
    default: return '';
  }
}

/**
 * 9. Limitations — static local-only note.
 */
export function buildLimitations(): ReportSection {
  return {
    kind: 'limitations',
    heading: 'Limitations',
    summary:
      'This report reviews aggregate prompt habits using local rule-based analysis. It is coaching guidance, not a comprehensive human review.',
    coaching_notes: [
      'Scores are heuristic-based and may not capture all nuances of your workflow.',
      'Model recommendations reflect general capability classes, not specific provider benchmarks.',
      'This report stays local and deterministic. The full 12D report is complete and ready for use.',
    ],
  };
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
