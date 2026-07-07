/**
 * cookedPrompts — Dashboard UI Types
 *
 * Public runtime contracts for the local dashboard UI shell.
 * Local-first only. No network dependencies. No prompt_text in shell types.
 */

export type DashboardUiActiveRoute =
  | 'overview'
  | 'prompts'
  | 'prompt_detail'
  | 'not_found';

export interface DashboardUiShellContext {
  app_title: string;
  database_label: string;
  active_route: DashboardUiActiveRoute;
  total_scored: number;
  has_scores: boolean;
  local_only: true;
}

export interface DashboardUiMetricCard {
  label: string;
  value: string;
  detail?: string;
}

export interface DashboardUiOverviewSummaryItem {
  label: string;
  value: string;
  detail?: string;
}

export interface DashboardUiLabeledValue {
  label: string;
  value: string;
}

export interface DashboardUiPromptListItem {
  score_id: string;
  detail_href: string;
  score_summary: string;
  confidence: string;
  model_label: string;
  source_label: string;
  timestamp_label: string;
  top_issue_labels: string[];
  safety_status: string;
  model_fit_status: string;
}

export interface DashboardUiPagination {
  current_page: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
  previous_href: string | null;
  next_href: string | null;
}

export interface DashboardUiPromptDetailModel {
  score_id: string;
  back_href: string;
  overall_score_summary: string;
  confidence: string;
  safety_status: string;
  model_fit_status: string;
  prompt_text_heading: string;
  prompt_text_note: string;
  prompt_text: string;
  score_breakdown: DashboardUiLabeledValue[];
  metadata: DashboardUiLabeledValue[];
  issue_labels: string[];
  explanations: string[];
}

export interface DashboardUiPageModel {
  shell: DashboardUiShellContext;
  page_title: string;
  eyebrow: string;
  heading: string;
  intro: string;
  metric_cards: DashboardUiMetricCard[];
  summary_sections: Array<{
    title: string;
    empty_message: string;
    items: DashboardUiOverviewSummaryItem[];
  }>;
  prompt_list: DashboardUiPromptListItem[];
  prompt_detail: DashboardUiPromptDetailModel | null;
  pagination: DashboardUiPagination | null;
  route_notice: string | null;
}

export interface DashboardUiServerOptions {
  databasePath: string;
  port?: number;
}

export interface DashboardUiServerHandle {
  url: string;
  close(): Promise<void>;
}
