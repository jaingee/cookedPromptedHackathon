import { describe, expect, it, vi } from 'vitest';

import {
  DashboardUiCliError,
  formatDashboardUiUsage,
  parseDashboardUiArgs,
  runDashboardUiCli,
  type DashboardUiCliDependencies,
} from '../../src/cli/dashboard-ui.js';

function makeWriters() {
  const stdoutCalls: string[] = [];
  const stderrCalls: string[] = [];
  return {
    stdoutCalls,
    stderrCalls,
    stdout: (text: string) => {
      stdoutCalls.push(text);
    },
    stderr: (text: string) => {
      stderrCalls.push(text);
    },
  };
}

function makeDeps(
  overrides: Partial<DashboardUiCliDependencies> = {},
): DashboardUiCliDependencies & { writers: ReturnType<typeof makeWriters> } {
  const writers = makeWriters();
  const resolvedWriters = overrides.writers ?? {
    stdout: writers.stdout,
    stderr: writers.stderr,
  };
  return {
    startServer: overrides.startServer ?? (async () => ({
      url: 'http://127.0.0.1:4173',
      close: async () => undefined,
    })),
    writers: Object.assign(writers, resolvedWriters),
  } as DashboardUiCliDependencies & { writers: ReturnType<typeof makeWriters> };
}

describe('parseDashboardUiArgs', () => {
  it('parses a required database path', () => {
    expect(parseDashboardUiArgs(['./local.db'])).toEqual({
      databasePath: './local.db',
      port: 4173,
      help: false,
    });
  });

  it('parses a database path with --port', () => {
    expect(parseDashboardUiArgs(['./local.db', '--port', '9001'])).toEqual({
      databasePath: './local.db',
      port: 9001,
      help: false,
    });
  });

  it('returns help without validating other args', () => {
    expect(parseDashboardUiArgs(['--help', '--bad'])).toEqual({
      databasePath: null,
      port: 4173,
      help: true,
    });
  });

  it('throws invalid_args for missing --port value', () => {
    expect(() => parseDashboardUiArgs(['./local.db', '--port'])).toThrow(DashboardUiCliError);
  });

  it('throws invalid_args for unknown flags', () => {
    expect(() => parseDashboardUiArgs(['./local.db', '--bad'])).toThrow(DashboardUiCliError);
  });

  it('throws invalid_args for extra positional arguments', () => {
    expect(() => parseDashboardUiArgs(['./one.db', './two.db'])).toThrow(DashboardUiCliError);
  });
});

describe('formatDashboardUiUsage', () => {
  it('mentions the dashboard command and loopback note', () => {
    const usage = formatDashboardUiUsage();
    expect(usage).toContain('npm run dashboard:ui');
    expect(usage).toContain('127.0.0.1');
    expect(usage).toContain('--port');
    expect(usage).toContain('Prompt text appears only on the local prompt detail page.');
  });
});

describe('runDashboardUiCli', () => {
  it('prints help to stdout and does not start the server', async () => {
    const startSpy = vi.fn();
    const deps = makeDeps({ startServer: startSpy as any });

    const code = await runDashboardUiCli(['--help'], deps);

    expect(code).toBe(0);
    expect(deps.writers.stdoutCalls.join('')).toContain('npm run dashboard:ui');
    expect(deps.writers.stderrCalls).toHaveLength(0);
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('fails cleanly when database path is missing', async () => {
    const deps = makeDeps();

    const code = await runDashboardUiCli([], deps);

    expect(code).toBe(1);
    expect(deps.writers.stderrCalls.join('')).toBe('Invalid arguments. Run with --help for usage.\n');
    expect(deps.writers.stdoutCalls).toHaveLength(0);
  });

  it('starts the server with the parsed port and prints the safe URL', async () => {
    const startSpy = vi.fn(async () => ({
      url: 'http://127.0.0.1:9001',
      close: async () => undefined,
    }));
    const deps = makeDeps({ startServer: startSpy });

    const code = await runDashboardUiCli(['./local.db', '--port', '9001'], deps);

    expect(code).toBe(0);
    expect(startSpy).toHaveBeenCalledWith({
      databasePath: './local.db',
      port: 9001,
    });
    expect(deps.writers.stdoutCalls.join('')).toBe('Dashboard UI running at http://127.0.0.1:9001\n');
    expect(deps.writers.stderrCalls).toHaveLength(0);
  });

  it('maps startup failures to a content-free error', async () => {
    const deps = makeDeps({
      startServer: async () => {
        throw new Error('EADDRINUSE /private/path/secret.db');
      },
    });

    const code = await runDashboardUiCli(['./local.db'], deps);

    expect(code).toBe(1);
    expect(deps.writers.stderrCalls.join('')).toBe('Dashboard UI failed to start.\n');
    expect(deps.writers.stderrCalls.join('')).not.toContain('/private/path/secret.db');
  });
});
