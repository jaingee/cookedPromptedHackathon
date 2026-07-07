/**
 * cookedPrompts — Dashboard UI CLI
 *
 * Local-only CLI entry point for starting the browser dashboard shell.
 * No cloud. No telemetry. No provider calls.
 */

import { fileURLToPath } from 'node:url';
import { startDashboardUiServer, DEFAULT_DASHBOARD_UI_PORT } from '../dashboard-ui/index.js';
import type { DashboardUiServerHandle } from '../dashboard-ui/index.js';

export interface DashboardUiCliOptions {
  databasePath: string | null;
  port: number;
  help: boolean;
}

export type DashboardUiCliErrorCategory =
  | 'invalid_args'
  | 'startup_failed'
  | 'unexpected_error';

export class DashboardUiCliError extends Error {
  readonly category: DashboardUiCliErrorCategory;

  constructor(category: DashboardUiCliErrorCategory) {
    super(getDashboardUiCliMessage(category));
    this.category = category;
  }
}

const ERROR_MESSAGES: Record<DashboardUiCliErrorCategory, string> = {
  invalid_args: 'Invalid arguments. Run with --help for usage.',
  startup_failed: 'Dashboard UI failed to start.',
  unexpected_error: 'An unexpected error occurred.',
};

function getDashboardUiCliMessage(category: DashboardUiCliErrorCategory): string {
  return ERROR_MESSAGES[category];
}

export function mapDashboardUiError(error: unknown): string {
  if (error instanceof DashboardUiCliError) {
    return ERROR_MESSAGES[error.category];
  }
  return ERROR_MESSAGES.unexpected_error;
}

export function parseDashboardUiArgs(argv: string[]): DashboardUiCliOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    return {
      databasePath: null,
      port: DEFAULT_DASHBOARD_UI_PORT,
      help: true,
    };
  }

  const options: DashboardUiCliOptions = {
    databasePath: null,
    port: DEFAULT_DASHBOARD_UI_PORT,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const token = argv[i];

    if (token === '--port') {
      const raw = argv[i + 1];
      if (raw === undefined || raw.startsWith('-')) {
        throw new DashboardUiCliError('invalid_args');
      }
      const port = Number.parseInt(raw, 10);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new DashboardUiCliError('invalid_args');
      }
      options.port = port;
      i += 2;
      continue;
    }

    if (!token.startsWith('-') && options.databasePath === null) {
      options.databasePath = token;
      i += 1;
      continue;
    }

    throw new DashboardUiCliError('invalid_args');
  }

  return options;
}

export function formatDashboardUiUsage(): string {
  return [
    'Usage: npm run dashboard:ui -- <database_path> [--port <n>]',
    '',
    'Flags:',
    '  --port <n>   Port to bind on loopback only (default: 4173)',
    '  --help, -h   Show this help and exit',
    '',
    'Notes:',
    '  The dashboard binds to 127.0.0.1 only.',
    '  Overview and prompt-list pages do not expose prompt text.',
    '  Prompt text appears only on the local prompt detail page.',
  ].join('\n');
}

export interface DashboardUiCliWriters {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface DashboardUiCliDependencies {
  startServer: (options: { databasePath: string; port?: number }) => Promise<DashboardUiServerHandle>;
  writers: DashboardUiCliWriters;
}

function defaultDependencies(): DashboardUiCliDependencies {
  return {
    startServer: startDashboardUiServer,
    writers: {
      stdout: (text: string) => process.stdout.write(text),
      stderr: (text: string) => process.stderr.write(text),
    },
  };
}

export async function runDashboardUiCli(
  argv: string[],
  deps?: Partial<DashboardUiCliDependencies>,
): Promise<number> {
  const defaults = defaultDependencies();
  const resolved: DashboardUiCliDependencies = {
    startServer: deps?.startServer ?? defaults.startServer,
    writers: deps?.writers ?? defaults.writers,
  };

  try {
    const options = parseDashboardUiArgs(argv);

    if (options.help) {
      resolved.writers.stdout(formatDashboardUiUsage() + '\n');
      return 0;
    }

    if (!options.databasePath) {
      throw new DashboardUiCliError('invalid_args');
    }

    let handle: DashboardUiServerHandle;
    try {
      handle = await resolved.startServer({
        databasePath: options.databasePath,
        port: options.port,
      });
    } catch {
      throw new DashboardUiCliError('startup_failed');
    }

    resolved.writers.stdout(`Dashboard UI running at ${handle.url}\n`);
    return 0;
  } catch (error) {
    resolved.writers.stderr(mapDashboardUiError(error) + '\n');
    return error instanceof DashboardUiCliError ? 1 : 1;
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  void runDashboardUiCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
