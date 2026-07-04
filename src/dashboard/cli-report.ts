/**
 * cookedPrompts — Dashboard CLI Report
 *
 * Minimal CLI report module that formats dashboard data as plain text.
 * Exports testable format functions (no subprocess required for testing).
 *
 * PRIVACY:
 * - prompt_text appears ONLY in renderDashboardDetail output.
 * - Overview/list/aggregate output never includes prompt_text.
 * - No banned full-answer fields anywhere.
 * - Content-free error messages only.
 *
 * Local-first: no network, no cloud, no telemetry.
 */

import type { DashboardDataService } from './dashboard-data-service.js';
import type {
  DashboardOverview,
  DashboardScoreListItem,
  DashboardScoreDetail,
  IssueLabelCount,
  ConfidenceCount,
  ScoreDimensionSummary,
} from './types.js';
import { openSqliteConnection } from '../storage/sqlite/sqlite-connection.js';
import { createDashboardDataService } from './create-dashboard-service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CLI options for the dashboard report command. */
export interface DashboardCliReportOptions {
  limit?: number;
  offset?: number;
  scoringVersion?: string;
  importBatchId?: string;
  detailScoreId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a value for display. Null/undefined becomes "-". */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  return String(value);
}

/** Join a section title with its body content. */
export function joinSection(title: string, body: string): string {
  return `--- ${title} ---\n${body}`;
}

/**
 * Format rows as a simple aligned text table.
 * Each row is an array of [label, value] pairs rendered with padding.
 */
export function formatRows(
  rows: ReadonlyArray<readonly [string, string]>,
): string {
  if (rows.length === 0) return '';

  let maxLabel = 0;
  for (const [label] of rows) {
    if (label.length > maxLabel) maxLabel = label.length;
  }

  const lines: string[] = [];
  for (const [label, value] of rows) {
    lines.push(`${label.padEnd(maxLabel)}  ${value}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Report Rendering
// ---------------------------------------------------------------------------

/**
 * Render the full dashboard report as plain text.
 * NO prompt_text anywhere in this output.
 */
export function renderDashboardReport(
  service: DashboardDataService,
  options?: DashboardCliReportOptions,
): string {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const filters = {
    importBatchId: options?.importBatchId,
    scoringVersion: options?.scoringVersion,
  };

  const overview: DashboardOverview = service.getOverview(filters);
  const labelCounts: IssueLabelCount[] = service.getIssueLabelCounts(filters);
  const confidenceCounts: ConfidenceCount[] = service.getConfidenceCounts(filters);
  const dimensions: ScoreDimensionSummary[] = service.getDimensionSummary(filters);
  const scores: DashboardScoreListItem[] = service.listScores({
    limit,
    offset,
    importBatchId: options?.importBatchId,
    scoringVersion: options?.scoringVersion,
  });

  const sections: string[] = [];

  // Header
  sections.push('cookedPrompts Dashboard Report');
  sections.push('==============================');
  sections.push('');

  // Overview
  const overviewRows: Array<readonly [string, string]> = [
    ['Total scored:', String(overview.total_scored)],
    ['Average overall:', String(overview.average_overall_score)],
    ['Low confidence:', String(overview.low_confidence_count)],
    ['Needs action:', String(overview.needs_action_count)],
    ['Most common label:', formatValue(overview.most_common_label)],
  ];
  sections.push(joinSection('Overview', formatRows(overviewRows)));
  sections.push('');

  // Issue Labels
  let labelBody: string;
  if (labelCounts.length === 0) {
    labelBody = 'No issue labels.';
  } else {
    const labelRows: Array<readonly [string, string]> = labelCounts.map(
      (lc) => [lc.label, String(lc.count)] as const,
    );
    labelBody = formatRows(labelRows);
  }
  sections.push(joinSection('Issue Labels', labelBody));
  sections.push('');

  // Confidence
  let confBody: string;
  if (confidenceCounts.length === 0) {
    confBody = 'No confidence data.';
  } else {
    const confRows: Array<readonly [string, string]> = confidenceCounts.map(
      (cc) => [cc.confidence, String(cc.count)] as const,
    );
    confBody = formatRows(confRows);
  }
  sections.push(joinSection('Confidence', confBody));
  sections.push('');

  // Dimensions
  let dimBody: string;
  if (dimensions.length === 0) {
    dimBody = 'No dimension data.';
  } else {
    const dimRows: Array<readonly [string, string]> = dimensions.map(
      (d) => [d.dimension, `avg: ${d.average_score}  low: ${d.low_count}`] as const,
    );
    dimBody = formatRows(dimRows);
  }
  sections.push(joinSection('Dimensions', dimBody));
  sections.push('');

  // Scored Prompts
  const listHeader = `Scored Prompts (limit: ${limit}, offset: ${offset})`;
  let listBody: string;
  if (scores.length === 0) {
    listBody = 'No scored prompts.';
  } else {
    const lines: string[] = [];
    for (const s of scores) {
      const ts = formatValue(s.timestamp);
      const model = formatValue(s.model_used);
      const labels = s.issue_labels.length > 0 ? s.issue_labels.join(',') : '-';
      lines.push(
        `${s.score_id}  ${ts}  ${model}  overall:${s.overall_score}  conf:${s.confidence}  labels:[${labels}]  v:${s.scoring_version}`,
      );
    }
    listBody = lines.join('\n');
  }
  sections.push(joinSection(listHeader, listBody));

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Detail Rendering
// ---------------------------------------------------------------------------

/**
 * Render detail for one score including prompt_text.
 * Returns "Score detail not found." if score not found.
 */
export function renderDashboardDetail(
  service: DashboardDataService,
  scoreId: string,
): string {
  const detail: DashboardScoreDetail | null = service.getScoreDetail(scoreId);

  if (!detail) {
    return 'Score detail not found.';
  }

  const { score, prompt_metadata, prompt_text } = detail;

  const sections: string[] = [];

  // Header
  sections.push(`cookedPrompts Score Detail: ${score.id}`);
  sections.push('======================================');
  sections.push('');

  // Score fields
  const scoreRows: Array<readonly [string, string]> = [
    ['Score ID:', score.id],
    ['Prompt Log ID:', score.prompt_log_id],
    ['Overall:', String(score.overall_score)],
    ['Clarity:', String(score.clarity_score)],
    ['Context:', String(score.context_score)],
    ['Constraints:', String(score.constraints_score)],
    ['Output Format:', String(score.output_format_score)],
    ['Capability Fit:', String(score.capability_fit_score)],
    ['Efficiency:', String(score.efficiency_score)],
    ['Safety/Privacy:', String(score.safety_privacy_score)],
    ['Confidence:', score.confidence],
    ['Issue Labels:', score.issue_labels.length > 0 ? score.issue_labels.join(', ') : '-'],
    ['Scoring Version:', score.scoring_version],
    ['Scored At:', score.scored_at],
  ];
  sections.push(formatRows(scoreRows));
  sections.push('');

  // Explanations
  let explBody: string;
  if (score.explanations.length === 0) {
    explBody = 'No explanations.';
  } else {
    explBody = score.explanations
      .map((e, i) => `${i + 1}. ${e}`)
      .join('\n');
  }
  sections.push(joinSection('Explanations', explBody));
  sections.push('');

  // Prompt Metadata
  let metaBody: string;
  if (!prompt_metadata) {
    metaBody = 'Prompt log not found.';
  } else {
    const metaRows: Array<readonly [string, string]> = [
      ['Timestamp:', prompt_metadata.timestamp],
      ['Source:', prompt_metadata.source],
      ['Provider:', prompt_metadata.provider],
      ['Model:', prompt_metadata.model_used],
      ['Input Tokens:', formatValue(prompt_metadata.input_tokens)],
      ['Output Tokens:', formatValue(prompt_metadata.output_tokens)],
      ['Total Tokens:', formatValue(prompt_metadata.total_tokens)],
      ['Estimated Cost:', formatValue(prompt_metadata.estimated_cost)],
      ['Latency (ms):', formatValue(prompt_metadata.latency_ms)],
      ['Tags:', prompt_metadata.tags.length > 0 ? prompt_metadata.tags.join(', ') : '-'],
    ];
    metaBody = formatRows(metaRows);
  }
  sections.push(joinSection('Prompt Metadata', metaBody));
  sections.push('');

  // Prompt Text (ONLY appears in detail)
  let textBody: string;
  if (!prompt_text) {
    textBody = 'Prompt text not available.';
  } else {
    textBody = prompt_text;
  }
  sections.push(joinSection('Prompt Text', textBody));

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

/** Parsed CLI arguments. */
export interface ParsedDashboardCliArgs {
  databasePath: string | null;
  options: DashboardCliReportOptions;
  help: boolean;
}

/**
 * Parse CLI arguments for the dashboard report command.
 * First non-flag argument is treated as the database path.
 */
export function parseDashboardCliArgs(argv: string[]): ParsedDashboardCliArgs {
  const result: ParsedDashboardCliArgs = {
    databasePath: null,
    options: {},
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
      continue;
    }

    if (arg === '--limit' && i + 1 < argv.length) {
      const n = parseInt(argv[i + 1], 10);
      if (!Number.isNaN(n)) result.options.limit = n;
      i += 2;
      continue;
    }

    if (arg === '--offset' && i + 1 < argv.length) {
      const n = parseInt(argv[i + 1], 10);
      if (!Number.isNaN(n)) result.options.offset = n;
      i += 2;
      continue;
    }

    if (arg === '--batch' && i + 1 < argv.length) {
      result.options.importBatchId = argv[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--version' && i + 1 < argv.length) {
      result.options.scoringVersion = argv[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--detail' && i + 1 < argv.length) {
      result.options.detailScoreId = argv[i + 1];
      i += 2;
      continue;
    }

    // First non-flag argument is the database path
    if (!arg.startsWith('--') && !arg.startsWith('-') && result.databasePath === null) {
      result.databasePath = arg;
    }

    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

/** Render CLI help text. */
export function renderDashboardCliHelp(): string {
  return [
    'Usage: dashboard [database_path] [options]',
    '',
    'Options:',
    '  --limit <n>       Number of scores to display (default: 20)',
    '  --offset <n>      Offset for pagination (default: 0)',
    '  --batch <id>      Filter by import batch ID',
    '  --version <v>     Filter by scoring version',
    '  --detail <id>     Show detail for a specific score ID',
    '  --help            Show this help message',
    '',
    'Examples:',
    '  dashboard ./prompts.db',
    '  dashboard ./prompts.db --limit 10 --offset 5',
    '  dashboard ./prompts.db --detail score-abc123',
    '  dashboard ./prompts.db --batch batch-001 --version 1.0.0',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CLI Runner
// ---------------------------------------------------------------------------

/**
 * Run the dashboard CLI report.
 * Opens DB, creates service, prints report, closes DB.
 * Does NOT run migrations. Does NOT call process.exit.
 * Returns 0 on success, 1 on error.
 */
export function runDashboardCliReport(argv?: string[]): number {
  const args = parseDashboardCliArgs(argv ?? []);

  if (args.help) {
    console.log(renderDashboardCliHelp());
    return 0;
  }

  if (!args.databasePath) {
    console.error('Error: database path is required.');
    return 1;
  }

  let db;
  try {
    db = openSqliteConnection({ databasePath: args.databasePath });
  } catch {
    console.error('Error: could not open database.');
    return 1;
  }

  try {
    const service = createDashboardDataService(db);

    if (args.options.detailScoreId) {
      const output = renderDashboardDetail(service, args.options.detailScoreId);
      console.log(output);
    } else {
      const output = renderDashboardReport(service, args.options);
      console.log(output);
    }

    return 0;
  } catch {
    console.error('Error: could not generate report.');
    return 1;
  } finally {
    try {
      db.close();
    } catch {
      // Ignore close errors
    }
  }
}
