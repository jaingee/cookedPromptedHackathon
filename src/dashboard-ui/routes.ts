/**
 * cookedPrompts — Dashboard UI Routes
 *
 * Deterministic route matching for the dashboard UI.
 */

import type { DashboardUiActiveRoute } from './types.js';

export interface DashboardUiRoute {
  activeRoute: DashboardUiActiveRoute;
  statusCode: number;
  kind: 'overview' | 'prompt_list' | 'prompt_detail' | 'not_found';
  scoreId?: string;
}

export function matchDashboardUiRoute(pathname: string): DashboardUiRoute {
  if (pathname === '/') {
    return {
      activeRoute: 'overview',
      statusCode: 200,
      kind: 'overview',
    };
  }

  if (pathname === '/prompts') {
    return {
      activeRoute: 'prompts',
      statusCode: 200,
      kind: 'prompt_list',
    };
  }

  if (
    pathname.startsWith('/prompts/') &&
    pathname.length > '/prompts/'.length &&
    !pathname.slice('/prompts/'.length).includes('/')
  ) {
    const scoreId = decodeURIComponent(pathname.slice('/prompts/'.length));
    return {
      activeRoute: 'prompt_detail',
      statusCode: 200,
      kind: 'prompt_detail',
      scoreId,
    };
  }

  return {
    activeRoute: 'not_found',
    statusCode: 404,
    kind: 'not_found',
  };
}
