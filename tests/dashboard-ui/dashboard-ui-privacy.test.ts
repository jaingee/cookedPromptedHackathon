import { afterEach, describe, expect, it, vi } from 'vitest';

import { startDashboardUiServer, createDashboardUiAdapter } from '../../src/dashboard-ui/index.js';
import { setupDashboardTestDb } from '../dashboard/dashboard-test-helpers.js';
import {
  createDashboardUiDbFile,
  requestDashboardUi,
  SYNTHETIC_PROMPT_TEXT,
} from './dashboard-ui-test-helpers.js';

const BANNED_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
  'template_body',
];
const DASHBOARD_SECRET = ['sk', 'test-secret-value'].join('-');

describe('dashboard UI privacy', () => {
  const cleanupTasks: Array<() => void> = [];

  afterEach(() => {
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      task?.();
    }
  });

  it('shell context does not contain prompt_text or banned answer fields', () => {
    const { service } = setupDashboardTestDb();
    const adapter = createDashboardUiAdapter(service, 'C:\\temp\\private\\test.db');
    const shell = adapter.buildShellContext('overview');
    const json = JSON.stringify(shell);

    expect(json).not.toContain('prompt_text');
    expect(json).not.toContain(SYNTHETIC_PROMPT_TEXT);
    for (const field of BANNED_FIELDS) {
      expect(json).not.toContain(field);
    }
  });

  it('does not leak prompt text or banned fields into shell HTML', async () => {
    const fixture = createDashboardUiDbFile({
      promptText: `Local review prompt with password=super-secret and api_key=${DASHBOARD_SECRET}`,
    });
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    for (const pathname of ['/', '/prompts', '/prompts?page=abc']) {
      const response = await requestDashboardUi(server.url, pathname);
      expect(response.body).not.toContain('prompt_text');
      expect(response.body).not.toContain(SYNTHETIC_PROMPT_TEXT);
      expect(response.body).not.toContain('super-secret');
      expect(response.body).not.toContain(DASHBOARD_SECRET);
      for (const field of BANNED_FIELDS) {
        expect(response.body).not.toContain(field);
      }
    }
  });

  it('keeps prompt text detail-only and masked on the detail route', async () => {
    const fixture = createDashboardUiDbFile({
      promptText: `Local review prompt with password=super-secret and api_key=${DASHBOARD_SECRET}`,
    });
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/prompts/score-1');
    expect(response.body).toContain('Local prompt text');
    expect(response.body).toContain('[REDACTED_PASSWORD]');
    expect(response.body).toContain('[REDACTED_SECRET]');
    expect(response.body).not.toContain('super-secret');
    expect(response.body).not.toContain(DASHBOARD_SECRET);
    for (const field of BANNED_FIELDS) {
      expect(response.body).not.toContain(field);
    }
  });

  it('shows only the database basename and never the full path', async () => {
    const fixture = createDashboardUiDbFile();
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/');
    expect(response.body).toContain('test.db');
    expect(response.body).not.toContain(fixture.databasePath);
  });

  it('does not call globalThis.fetch during startup or route rendering', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    try {
      const fixture = createDashboardUiDbFile();
      cleanupTasks.push(fixture.cleanup);

      const server = await startDashboardUiServer({
        databasePath: fixture.databasePath,
        port: 0,
      });
      cleanupTasks.push(() => {
        void server.close();
      });

      await requestDashboardUi(server.url, '/');
      await requestDashboardUi(server.url, '/prompts');

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
