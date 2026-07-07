import { afterEach, describe, expect, it } from 'vitest';

import { startDashboardUiServer } from '../../src/dashboard-ui/index.js';
import {
  createDashboardUiDbFile,
  createDashboardUiDbFileWithManyScores,
  requestDashboardUi,
} from './dashboard-ui-test-helpers.js';
const DASHBOARD_SECRET = ['sk', 'test-secret-value'].join('-');

describe('startDashboardUiServer', () => {
  const cleanupTasks: Array<() => void> = [];

  afterEach(() => {
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      task?.();
    }
  });

  it('starts on loopback and returns a safe URL', async () => {
    const fixture = createDashboardUiDbFile();
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('renders real overview content at /', async () => {
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
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('cookedPrompts Dashboard');
    expect(response.body).toContain('Prompt health overview');
    expect(response.body).toContain('Prompt habit score');
    expect(response.body).toContain('Recurring weaknesses');
    expect(response.body).toContain('Confidence summary');
    expect(response.body).toContain('Safety and signal summary');
    expect(response.body).toContain('1 scored prompts ready for the dashboard.');
  });

  it('renders a real prompt list at /prompts', async () => {
    const fixture = createDashboardUiDbFile();
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/prompts');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Prompts to review next');
    expect(response.body).toContain('score-1');
    expect(response.body).toContain('60 / 100 (Okay)');
    expect(response.body).toContain('Medium confidence');
    expect(response.body).toContain('/prompts/score-1');
  });

  it('renders a real prompt detail page at /prompts/:scoreId', async () => {
    const fixture = createDashboardUiDbFile({
      promptText: `Prompt for local review. api_key=${DASHBOARD_SECRET} and email me at person@example.com`,
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
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Prompt detail for score-1');
    expect(response.body).toContain('Back to prompt list');
    expect(response.body).toContain('Local prompt text');
    expect(response.body).toContain('Score breakdown');
    expect(response.body).toContain('Prompt metadata');
    expect(response.body).toContain('[REDACTED_SECRET]');
    expect(response.body).toContain('[REDACTED_PERSONAL_DATA]');
    expect(response.body).not.toContain(DASHBOARD_SECRET);
    expect(response.body).not.toContain('person@example.com');
  });

  it('returns a safe not-found detail page for unknown score IDs', async () => {
    const fixture = createDashboardUiDbFile();
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/prompts/missing-score');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('Prompt detail not found');
    expect(response.body).toContain('No local prompt detail matched this score ID.');
    expect(response.body).not.toContain('SYNTHETIC_LOCAL_DETAIL_PROMPT_DO_NOT_LEAK');
  });

  it('supports deterministic pagination on /prompts', async () => {
    const fixture = createDashboardUiDbFileWithManyScores(12);
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/prompts?page=2');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Page 2 of 2');
    expect(response.body).toContain('score-2');
    expect(response.body).toContain('score-1');
    expect(response.body).not.toContain('score-12');
  });

  it('resets invalid page queries safely', async () => {
    const fixture = createDashboardUiDbFileWithManyScores(12);
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/prompts?page=abc');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('prompt list reset to page 1');
    expect(response.body).toContain('Page 1 of 2');
  });

  it('renders safe empty states for overview and prompt list', async () => {
    const fixture = createDashboardUiDbFile({ withScores: false });
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const overview = await requestDashboardUi(server.url, '/');
    const prompts = await requestDashboardUi(server.url, '/prompts');

    expect(overview.body).toContain('No scored prompts yet');
    expect(prompts.body).toContain('No scored prompts match this page yet.');
  });

  it('renders a deterministic not-found page for unknown routes', async () => {
    const fixture = createDashboardUiDbFile();
    cleanupTasks.push(fixture.cleanup);

    const server = await startDashboardUiServer({
      databasePath: fixture.databasePath,
      port: 0,
    });
    cleanupTasks.push(() => {
      void server.close();
    });

    const response = await requestDashboardUi(server.url, '/missing');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('Page not found');
    expect(response.body).toContain('The requested dashboard page is not available.');
  });
});
