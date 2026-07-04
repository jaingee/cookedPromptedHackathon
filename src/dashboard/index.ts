/**
 * cookedPrompts — Dashboard Module Boundary
 *
 * Public exports for the local dashboard data service layer.
 * Local-first: no network, no cloud, no telemetry, no LLM judge.
 */

export type {
  DashboardOverview,
  DashboardScoreListItem,
  DashboardScoreDetail,
  DashboardPromptMetadata,
  DashboardFilterOptions,
  IssueLabelCount,
  ConfidenceCount,
  ScoreDimensionSummary,
} from './types.js';

export { DashboardDataService } from './dashboard-data-service.js';
export { createDashboardDataService } from './create-dashboard-service.js';

export type { DashboardCliReportOptions } from './cli-report.js';
export {
  renderDashboardReport,
  renderDashboardDetail,
  parseDashboardCliArgs,
  renderDashboardCliHelp,
  runDashboardCliReport,
} from './cli-report.js';
