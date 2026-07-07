/**
 * cookedPrompts — Dashboard UI Adapter
 *
 * Thin adapter from DashboardDataService to safe browser view models.
 * Overview and list views remain prompt-text free.
 */

import path from 'node:path';

import type {
  ConfidenceCount,
  DashboardDataService,
  DashboardScoreDetail,
  DashboardScoreListItem,
  IssueLabelCount,
  ScoreDimensionSummary,
} from '../dashboard/index.js';
import {
  PROMPT_EXCERPT_WITHHELD,
  redactPromptForReport,
} from '../demo-report/redaction.js';
import type {
  DashboardUiActiveRoute,
  DashboardUiLabeledValue,
  DashboardUiMetricCard,
  DashboardUiOverviewSummaryItem,
  DashboardUiPageModel,
  DashboardUiPagination,
  DashboardUiPromptDetailModel,
  DashboardUiPromptListItem,
  DashboardUiShellContext,
} from './types.js';

export interface DashboardUiAdapter {
  buildShellContext(activeRoute: DashboardUiActiveRoute): DashboardUiShellContext;
  buildOverviewPage(): DashboardUiPageModel;
  buildPromptListPage(options?: { page?: number; notice?: string | null }): DashboardUiPageModel;
  buildPromptDetailPage(scoreId: string): { statusCode: number; model: DashboardUiPageModel };
  buildNotFoundPage(): DashboardUiPageModel;
}

const APP_TITLE = 'cookedPrompts Dashboard';
const PROMPT_LIST_PAGE_SIZE = 10;

function toScore100(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null;
  }
  return Math.round(score * 20);
}

function getScoreBand(score100: number | null | undefined): string | null {
  if (score100 === null || score100 === undefined || !Number.isFinite(score100)) {
    return null;
  }
  if (score100 <= 49) return 'Poor';
  if (score100 <= 69) return 'Okay';
  if (score100 <= 84) return 'Good';
  return 'Excellent';
}

function getDatabaseLabel(databasePath: string): string {
  const trimmed = databasePath.trim();
  const label = path.basename(trimmed);
  return label === '' ? 'database' : label;
}

function humanizeLabel(label: string): string {
  return label
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Timestamp unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Timestamp unavailable';
  return parsed.toISOString().slice(0, 10);
}

function formatOptionalNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unavailable';
  }
  return String(value);
}

function formatOptionalCost(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unavailable';
  }
  return `$${value.toFixed(4)}`;
}

function formatScoringVersion(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value : 'Unavailable';
}

function getModelFitStatus(issueLabels: string[]): string {
  const issueSet = new Set(issueLabels);

  if (issueSet.has('wrong_model_class')) {
    return 'Wrong model class';
  }
  if (issueSet.has('overpowered_model')) {
    return 'Model overkill';
  }
  if (issueSet.has('needs_search') || issueSet.has('needs_tool_use')) {
    return 'Needs tools or search';
  }
  return 'Model fit okay';
}

function getSafetyStatus(issueLabels: string[]): string {
  const issueSet = new Set(issueLabels);
  if (issueSet.has('privacy_risk') || issueSet.has('possible_secret')) {
    return 'Safety check';
  }
  return 'No safety flags';
}

function buildPromptTextForDetail(promptText: string | null): string {
  if (!promptText || promptText.trim() === '') {
    return 'Prompt text not available.';
  }

  const redacted = redactPromptForReport(promptText);
  const normalized = redacted.redacted_prompt.trim();

  return normalized === '' ? PROMPT_EXCERPT_WITHHELD : normalized;
}

function buildMetricCards(overview: ReturnType<DashboardDataService['getOverview']>): DashboardUiMetricCard[] {
  const averageScore100 = toScore100(overview.average_overall_score);
  const averageBand = getScoreBand(averageScore100);

  return [
    {
      label: 'Prompt habit score',
      value: averageScore100 !== null ? `${averageScore100} / 100` : 'N/A',
      detail: averageBand ?? 'No band available',
    },
    {
      label: 'Total scored prompts',
      value: String(overview.total_scored),
      detail: overview.total_scored > 0 ? 'Local scores available' : 'No scored prompts yet',
    },
    {
      label: 'Needs action',
      value: String(overview.needs_action_count),
      detail: 'Prompts at overall score 2 or below',
    },
    {
      label: 'Low confidence',
      value: String(overview.low_confidence_count),
      detail: 'Scoring results worth double-checking',
    },
  ];
}

function buildOverviewSections(
  overview: ReturnType<DashboardDataService['getOverview']>,
  issueCounts: IssueLabelCount[],
  confidenceCounts: ConfidenceCount[],
  dimensionSummary: ScoreDimensionSummary[],
): DashboardUiPageModel['summary_sections'] {
  const weakestDimensions = [...dimensionSummary]
    .sort((a, b) => {
      if (a.average_score !== b.average_score) return a.average_score - b.average_score;
      if (a.low_count !== b.low_count) return b.low_count - a.low_count;
      return a.dimension.localeCompare(b.dimension);
    })
    .slice(0, 4)
    .map((item): DashboardUiOverviewSummaryItem => ({
      label: humanizeLabel(item.dimension.replace(/_score$/, '')),
      value: `${toScore100(item.average_score) ?? 0} / 100`,
      detail: `${item.low_count} low-score prompt${item.low_count === 1 ? '' : 's'}`,
    }));

  const recurringIssues = issueCounts
    .slice(0, 5)
    .map((item): DashboardUiOverviewSummaryItem => ({
      label: humanizeLabel(item.label),
      value: String(item.count),
    }));

  const confidenceSummary = confidenceCounts.map((item): DashboardUiOverviewSummaryItem => ({
    label: humanizeLabel(item.confidence),
    value: String(item.count),
  }));

  const safetyIssue = issueCounts.find((item) => item.label === 'privacy_risk' || item.label === 'possible_secret');
  const mostCommonIssue = overview.most_common_label
    ? humanizeLabel(overview.most_common_label)
    : 'No recurring issue yet';

  return [
    {
      title: 'Recurring weaknesses',
      empty_message: 'No recurring weaknesses detected yet.',
      items: recurringIssues,
    },
    {
      title: 'Weakest dimensions',
      empty_message: 'Dimension summary becomes useful once scores exist.',
      items: weakestDimensions,
    },
    {
      title: 'Confidence summary',
      empty_message: 'No confidence data yet.',
      items: confidenceSummary,
    },
    {
      title: 'Safety and signal summary',
      empty_message: 'No safety summary yet.',
      items: [
        { label: 'Most common issue', value: mostCommonIssue },
        {
          label: 'Safety/privacy flags',
          value: safetyIssue ? String(safetyIssue.count) : '0',
          detail: safetyIssue ? 'Prompts with privacy-related issue labels' : 'No privacy-related issue labels detected',
        },
      ],
    },
  ];
}

function buildPromptListItems(scores: DashboardScoreListItem[]): DashboardUiPromptListItem[] {
  return scores.map((item) => {
    const score100 = toScore100(item.overall_score);
    const scoreBand = getScoreBand(score100) ?? 'Unscored';

    return {
      score_id: item.score_id,
      detail_href: `/prompts/${encodeURIComponent(item.score_id)}`,
      score_summary: score100 !== null ? `${score100} / 100 (${scoreBand})` : scoreBand,
      confidence: humanizeLabel(item.confidence),
      model_label: item.model_used ?? 'Model unavailable',
      source_label: item.source ?? 'Source unavailable',
      timestamp_label: formatTimestamp(item.timestamp),
      top_issue_labels: item.issue_labels.slice(0, 3).map(humanizeLabel),
      safety_status: getSafetyStatus(item.issue_labels),
      model_fit_status: getModelFitStatus(item.issue_labels),
    };
  });
}

function buildPromptDetailModel(detail: DashboardScoreDetail): DashboardUiPromptDetailModel {
  const overallScore100 = toScore100(detail.score.overall_score);
  const overallBand = getScoreBand(overallScore100) ?? 'Unscored';
  const metadata = detail.prompt_metadata;

  const scoreBreakdown: DashboardUiLabeledValue[] = [
    { label: 'Overall score', value: overallScore100 !== null ? `${overallScore100} / 100 (${overallBand})` : 'Unavailable' },
    { label: 'Clarity', value: `${toScore100(detail.score.clarity_score) ?? 0} / 100` },
    { label: 'Context', value: `${toScore100(detail.score.context_score) ?? 0} / 100` },
    { label: 'Constraints', value: `${toScore100(detail.score.constraints_score) ?? 0} / 100` },
    { label: 'Output format', value: `${toScore100(detail.score.output_format_score) ?? 0} / 100` },
    { label: 'Model fit', value: `${toScore100(detail.score.capability_fit_score) ?? 0} / 100` },
    { label: 'Efficiency', value: `${toScore100(detail.score.efficiency_score) ?? 0} / 100` },
    { label: 'Safety & privacy', value: `${toScore100(detail.score.safety_privacy_score) ?? 0} / 100` },
  ];

  const detailMetadata: DashboardUiLabeledValue[] = [
    { label: 'Prompt log ID', value: detail.score.prompt_log_id },
    { label: 'Source', value: metadata?.source ?? 'Unavailable' },
    { label: 'Provider', value: metadata?.provider ?? 'Unavailable' },
    { label: 'Model', value: metadata?.model_used ?? 'Unavailable' },
    { label: 'Timestamp', value: formatTimestamp(metadata?.timestamp ?? null) },
    { label: 'Scoring version', value: formatScoringVersion(detail.score.scoring_version) },
    { label: 'Scored at', value: formatTimestamp(detail.score.scored_at) },
    { label: 'Input tokens', value: formatOptionalNumber(metadata?.input_tokens) },
    { label: 'Output tokens', value: formatOptionalNumber(metadata?.output_tokens) },
    { label: 'Total tokens', value: formatOptionalNumber(metadata?.total_tokens) },
    { label: 'Estimated cost', value: formatOptionalCost(metadata?.estimated_cost) },
    { label: 'Latency (ms)', value: formatOptionalNumber(metadata?.latency_ms) },
    {
      label: 'Tags',
      value: metadata && metadata.tags.length > 0 ? metadata.tags.join(', ') : 'None',
    },
  ];

  return {
    score_id: detail.score.id,
    back_href: '/prompts',
    overall_score_summary:
      overallScore100 !== null ? `${overallScore100} / 100 (${overallBand})` : 'Unavailable',
    confidence: humanizeLabel(detail.score.confidence),
    safety_status: getSafetyStatus(detail.score.issue_labels),
    model_fit_status: getModelFitStatus(detail.score.issue_labels),
    prompt_text_heading: 'Local prompt text',
    prompt_text_note: 'Prompt text appears only on this detail page and is masked with the local redaction rules before display.',
    prompt_text: buildPromptTextForDetail(detail.prompt_text),
    score_breakdown: scoreBreakdown,
    metadata: detailMetadata,
    issue_labels: detail.score.issue_labels.map(humanizeLabel),
    explanations: detail.score.explanations,
  };
}

function buildPagination(totalScored: number, currentPage: number): DashboardUiPagination {
  const totalPages = Math.max(1, Math.ceil(totalScored / PROMPT_LIST_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  return {
    current_page: safePage,
    total_pages: totalPages,
    has_previous_page: safePage > 1,
    has_next_page: safePage < totalPages,
    previous_href: safePage > 1 ? `/prompts?page=${safePage - 1}` : null,
    next_href: safePage < totalPages ? `/prompts?page=${safePage + 1}` : null,
  };
}

export function createDashboardUiAdapter(
  service: DashboardDataService,
  databasePath: string,
): DashboardUiAdapter {
  const databaseLabel = getDatabaseLabel(databasePath);

  return {
    buildShellContext(activeRoute: DashboardUiActiveRoute): DashboardUiShellContext {
      const overview = service.getOverview();
      return {
        app_title: APP_TITLE,
        database_label: databaseLabel,
        active_route: activeRoute,
        total_scored: overview.total_scored,
        has_scores: overview.total_scored > 0,
        local_only: true,
      };
    },

    buildOverviewPage(): DashboardUiPageModel {
      const overview = service.getOverview();
      const issueCounts = service.getIssueLabelCounts();
      const confidenceCounts = service.getConfidenceCounts();
      const dimensionSummary = service.getDimensionSummary();

      return {
        shell: this.buildShellContext('overview'),
        page_title: 'Overview',
        eyebrow: 'Overview',
        heading: 'Prompt health overview',
        intro: 'This page stays on safe local aggregates so you can spot weak habits without exposing prompt text.',
        metric_cards: buildMetricCards(overview),
        summary_sections: buildOverviewSections(overview, issueCounts, confidenceCounts, dimensionSummary),
        prompt_list: [],
        prompt_detail: null,
        pagination: null,
        route_notice: null,
      };
    },

    buildPromptListPage(options?: { page?: number; notice?: string | null }): DashboardUiPageModel {
      const overview = service.getOverview();
      const pagination = buildPagination(overview.total_scored, options?.page ?? 1);
      const scores = service.listScores({
        limit: PROMPT_LIST_PAGE_SIZE,
        offset: (pagination.current_page - 1) * PROMPT_LIST_PAGE_SIZE,
      });

      return {
        shell: this.buildShellContext('prompts'),
        page_title: 'Prompts',
        eyebrow: 'Scored prompt list',
        heading: 'Prompts to review next',
        intro: 'This list shows safe prompt metadata only. Prompt text stays out of the list and appears only on the local detail page.',
        metric_cards: [
          {
            label: 'Showing',
            value: `${scores.length}`,
            detail: `Page ${pagination.current_page} of ${pagination.total_pages}`,
          },
          {
            label: 'Total scored prompts',
            value: String(overview.total_scored),
            detail: 'Across the local database',
          },
        ],
        summary_sections: [],
        prompt_list: buildPromptListItems(scores),
        prompt_detail: null,
        pagination,
        route_notice: options?.notice ?? null,
      };
    },

    buildPromptDetailPage(scoreId: string): { statusCode: number; model: DashboardUiPageModel } {
      const detail = service.getScoreDetail(scoreId);
      if (!detail) {
        return {
          statusCode: 404,
          model: {
            shell: this.buildShellContext('prompt_detail'),
            page_title: 'Prompt detail',
            eyebrow: 'Prompt detail',
            heading: 'Prompt detail not found',
            intro: 'No local prompt detail matched this score ID.',
            metric_cards: [],
            summary_sections: [],
            prompt_list: [],
            prompt_detail: null,
            pagination: null,
            route_notice: null,
          },
        };
      }

      return {
        statusCode: 200,
        model: {
          shell: this.buildShellContext('prompt_detail'),
          page_title: 'Prompt detail',
          eyebrow: 'Prompt detail',
          heading: `Prompt detail for ${detail.score.id}`,
          intro: 'This detail view stays local-only. Overview and list pages still keep prompt text out of sight.',
          metric_cards: [
            {
              label: 'Prompt habit score',
              value: buildPromptDetailModel(detail).overall_score_summary,
              detail: 'Detail-only local coaching view',
            },
            {
              label: 'Confidence',
              value: humanizeLabel(detail.score.confidence),
              detail: getModelFitStatus(detail.score.issue_labels),
            },
            {
              label: 'Safety',
              value: getSafetyStatus(detail.score.issue_labels),
              detail: 'Raw warning text stays out of the dashboard',
            },
          ],
          summary_sections: [],
          prompt_list: [],
          prompt_detail: buildPromptDetailModel(detail),
          pagination: null,
          route_notice: null,
        },
      };
    },

    buildNotFoundPage(): DashboardUiPageModel {
      return {
        shell: this.buildShellContext('not_found'),
        page_title: 'Not found',
        eyebrow: 'Not found',
        heading: 'Page not found',
        intro: 'The requested dashboard page is not available.',
        metric_cards: [],
        summary_sections: [],
        prompt_list: [],
        prompt_detail: null,
        pagination: null,
        route_notice: null,
      };
    },
  };
}
