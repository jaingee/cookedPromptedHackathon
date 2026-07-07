/**
 * cookedPrompts — Dashboard UI Module Boundary
 *
 * Public exports for the local dashboard UI shell runtime.
 */

export type {
  DashboardUiActiveRoute,
  DashboardUiShellContext,
  DashboardUiServerOptions,
  DashboardUiServerHandle,
} from './types.js';

export type { DashboardUiAdapter } from './adapter.js';

export { createDashboardUiAdapter } from './adapter.js';
export { DEFAULT_DASHBOARD_UI_PORT, startDashboardUiServer } from './server.js';

