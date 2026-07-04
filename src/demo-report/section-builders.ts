/**
 * cookedPrompts — Demo Report Section Builders
 *
 * Pure deterministic builder functions for each report section.
 * Each returns a ReportSection. No I/O, no mutation, no prompt_text.
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
} from './coaching-copy.js';

/**
 * 1. Batch Overview — total, succeeded, failed, %, avg score, duration.
 */
export function buildBatchOverview(
  summary: BatchSummary,
  metadata: PipelineMetadata,
): ReportSection {
  const successPct =
    summary.total_prompts > 0
      ? Math.round((summary.succeeded / summary.total_prompts) * 100)
      : 0;

  const avgScore =
    summary.average_overall_score !== null
      ? Math.round(summary.average_overall_score * 100) / 100
      : null;

  return {
    kind: 'batch_overview',
    heading: 'Batch Overview',
    summary:
      summary.total_prompts === 0
        ? 'No prompts analyzed.'
        : `Analyzed ${summary.total_prompts} prompts with a ${successPct}% success rate.`,
    metrics: [
      { label: 'Total prompts', value: summary.total_prompts },
      { label: 'Succeeded', value: summary.succeeded },
      { label: 'Failed', value: summary.failed },
      { label: 'Success rate', value: successPct, unit: '%' },
      { label: 'Average score', value: avgScore, unit: '/ 5' },
      { label: 'Duration', value: metadata.total_duration_ms, unit: 'ms' },
    ],
  };
}

/**
 * 2. Prompt Health — dimension averages ranked weakest→strongest.
 */
export function buildPromptHealth(summary: BatchSummary): ReportSection {
  const dims = summary.dimension_averages;
  const entries = Object.entries(dims);

  if (entries.length === 0) {
    return {
      kind: 'prompt_health',
      heading: 'Prompt Health',
      summary: 'Not enough data to assess prompt health.',
    };
  }

  // Sort: ascending by score, null last; alpha tiebreaker
  const sorted = entries.sort((a, b) => {
    if (a[1] === null && b[1] === null) return a[0].localeCompare(b[0]);
    if (a[1] === null) return 1;
    if (b[1] === null) return -1;
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0].localeCompare(b[0]);
  });

  const items = sorted.map(([dim, val]) => {
    const score = val !== null ? (Math.round(val * 100) / 100).toString() : 'N/A';
    return `${dim}: ${score} / 5`;
  });

  // Coaching for weakest 1–2 dimensions (non-null, score < 3.5)
  const weakDims = sorted
    .filter(([, val]) => val !== null && val < 3.5)
    .slice(0, 2);

  const coaching_notes: string[] = weakDims
    .map(([dim]) => DIMENSION_COACHING_NOTES[dim])
    .filter((note): note is string => note !== undefined);

  const section: ReportSection = {
    kind: 'prompt_health',
    heading: 'Prompt Health',
    summary: `Dimensions ranked from weakest to strongest.`,
    items,
  };

  if (coaching_notes.length > 0) {
    section.coaching_notes = coaching_notes;
  }

  return section;
}

/**
 * 3. Issue Patterns — top N issues by frequency with coaching notes.
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
      heading: 'Issue Patterns',
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
    ([label, count]) => `${label} (×${count})`,
  );

  const coaching_notes = sorted
    .map(([label]) => ISSUE_LABEL_COACHING_NOTES[label])
    .filter((note): note is string => note !== undefined);

  const section: ReportSection = {
    kind: 'issue_patterns',
    heading: 'Issue Patterns',
    summary: `Found ${sorted.length} recurring issue pattern${sorted.length === 1 ? '' : 's'}.`,
    items,
  };

  if (coaching_notes.length > 0) {
    section.coaching_notes = coaching_notes;
  }

  return section;
}

/**
 * 4. Safety / Privacy — warnings count, severity breakdown, do_not_send_external.
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
      severityItems.push(`${sev}: ${severityCounts[sev]}`);
    }
  }

  // Include any unknown severity levels sorted alphabetically
  const knownSet = new Set(severityOrder);
  const unknownSeverities = Object.entries(severityCounts)
    .filter(([key, val]) => !knownSet.has(key) && val > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, val] of unknownSeverities) {
    severityItems.push(`${key}: ${val}`);
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
 * 5. Model Recommendations — class distribution sorted by frequency.
 */
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
 * 6. Rewrite / Template Coaching — severity distribution, top N templates.
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
 * 7. Next Actions — 3–5 prioritized actions.
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
        ? `Fix "${label}" (appeared ${count}×): ${note}`
        : `Address "${label}" issue (appeared ${count}×).`,
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
        ? `Improve "${dim}" dimension: ${note}`
        : `Work on your "${dim}" scores.`,
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
    (a) => `[${a.source}] ${a.action}`,
  );

  return {
    kind: 'next_actions',
    heading: 'Next Actions',
    summary: `${finalActions.length} prioritized action${finalActions.length === 1 ? '' : 's'} to improve your prompt habits.`,
    items,
  };
}

/**
 * 8. Limitations — static local-only note.
 */
export function buildLimitations(): ReportSection {
  return {
    kind: 'limitations',
    heading: 'Limitations',
    summary:
      'This analysis is local-only and rule-based. No AI rewriting was performed. Verify recommendations against your specific use case.',
    coaching_notes: [
      'Scores are heuristic-based and may not capture all nuances of your workflow.',
      'Model recommendations reflect general capability classes, not specific provider benchmarks.',
    ],
  };
}
