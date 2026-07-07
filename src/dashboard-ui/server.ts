/**
 * cookedPrompts — Dashboard UI Server
 *
 * Local-only loopback server for the dashboard UI.
 */

import http from 'node:http';
import fs from 'node:fs';
import { openSqliteConnection } from '../storage/sqlite/index.js';
import { createDashboardDataService } from '../dashboard/index.js';
import { createDashboardUiAdapter, type DashboardUiAdapter } from './adapter.js';
import { renderDashboardUiDocument } from './layout.js';
import { matchDashboardUiRoute } from './routes.js';
import type { DashboardUiServerHandle, DashboardUiServerOptions } from './types.js';

export const DEFAULT_DASHBOARD_UI_PORT = 4173;
const LOOPBACK_HOST = '127.0.0.1';

function validateServerOptions(options: DashboardUiServerOptions): Required<DashboardUiServerOptions> {
  if (
    options === undefined ||
    options === null ||
    typeof options.databasePath !== 'string' ||
    options.databasePath.trim() === ''
  ) {
    throw new Error('Dashboard UI databasePath is required');
  }

  if (!fs.existsSync(options.databasePath)) {
    throw new Error('Dashboard UI databasePath does not exist');
  }

  const port = options.port ?? DEFAULT_DASHBOARD_UI_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Dashboard UI port is invalid');
  }

  return {
    databasePath: options.databasePath,
    port,
  };
}

function parsePageNumber(raw: string | null): { page: number; notice: string | null } {
  if (raw === null) {
    return { page: 1, notice: null };
  }

  if (!/^\d+$/.test(raw)) {
    return {
      page: 1,
      notice: 'The requested page was invalid, so the prompt list reset to page 1.',
    };
  }

  const page = Number.parseInt(raw, 10);
  if (!Number.isInteger(page) || page < 1) {
    return {
      page: 1,
      notice: 'The requested page was invalid, so the prompt list reset to page 1.',
    };
  }

  return { page, notice: null };
}

function renderPage(
  adapter: DashboardUiAdapter,
  pathname: string,
  searchParams: URLSearchParams,
): { statusCode: number; html: string } {
  try {
    const route = matchDashboardUiRoute(pathname);
    const page =
      route.kind === 'overview'
        ? { statusCode: route.statusCode, model: adapter.buildOverviewPage() }
        : route.kind === 'prompt_list'
          ? {
              statusCode: route.statusCode,
              model: adapter.buildPromptListPage(parsePageNumber(searchParams.get('page'))),
            }
          : route.kind === 'prompt_detail' && route.scoreId
            ? adapter.buildPromptDetailPage(route.scoreId)
            : { statusCode: route.statusCode, model: adapter.buildNotFoundPage() };

    return {
      statusCode: page.statusCode,
      html: renderDashboardUiDocument(page.model),
    };
  } catch {
    return {
      statusCode: 500,
      html: renderDashboardUiDocument(adapter.buildNotFoundPage()),
    };
  }
}

export async function startDashboardUiServer(
  options: DashboardUiServerOptions,
): Promise<DashboardUiServerHandle> {
  const validated = validateServerOptions(options);
  const db = openSqliteConnection({ databasePath: validated.databasePath });
  const service = createDashboardDataService(db);
  const adapter = createDashboardUiAdapter(service, validated.databasePath);

  try {
    service.getOverview();
  } catch (error) {
    try {
      db.close();
    } catch {
      // ignore close failures during startup validation
    }
    throw error;
  }

  const server = http.createServer((request, response) => {
    const requestUrl = request.url ?? '/';
    const parsedUrl = new URL(requestUrl, `http://${LOOPBACK_HOST}`);
    const page = renderPage(adapter, parsedUrl.pathname, parsedUrl.searchParams);

    response.statusCode = page.statusCode;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(page.html);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(validated.port, LOOPBACK_HOST, () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    try {
      db.close();
    } catch {
      // ignore close failures during startup rollback
    }
    throw error;
  }

  const address = server.address();
  const port =
    typeof address === 'object' && address !== null
      ? address.port
      : validated.port;

  return {
    url: `http://${LOOPBACK_HOST}:${port}`,
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          try {
            db.close();
          } catch {
            // ignore close errors
          }
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
