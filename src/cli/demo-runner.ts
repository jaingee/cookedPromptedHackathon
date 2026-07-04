/**
 * cookedPrompts — Demo Runner CLI
 *
 * Thin terminal wrapper around runIntegrationDemo + renderDemoReport.
 * Local-only. No network. No telemetry. No provider calls.
 * No prompt_text output. No banned fields. No secrets. No stack traces.
 */

import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { runIntegrationDemo } from '../integration-demo/index.js';
import { renderDemoReport } from '../demo-report/index.js';
import type { UnifiedDemoOutput } from '../integration-demo/types.js';
import type { DemoReport } from '../demo-report/types.js';
import type { DemoInput } from '../integration-demo/types.js';

// --- Types ---

export type CliMode = 'demo' | 'file';
export type OutputMode = 'stdout' | 'file';
export type SourceType = 'jsonl' | 'csv';

export interface CliOptions {
  mode: CliMode;
  file_path?: string;
  source_type?: SourceType;
  output_mode: OutputMode;
  output_path?: string;
  include_prompt_text: boolean;
  help: boolean;
}

export type CliErrorCategory =
  | 'invalid_args'
  | 'unsupported_source_type'
  | 'file_not_readable'
  | 'pipeline_failed'
  | 'report_generation_failed'
  | 'file_write_failed'
  | 'unexpected_error';

// --- Error helpers ---

/** Content-free CLI error with a known category. */
export class CliError extends Error {
  readonly category: CliErrorCategory;
  constructor(category: CliErrorCategory) {
    super(getContentFreeMessage(category));
    this.category = category;
  }
}

/** Fixed content-free messages per error category. Never contains sensitive data. */
const ERROR_MESSAGES: Record<CliErrorCategory, string> = {
  invalid_args: 'Invalid arguments. Run with --help for usage.',
  unsupported_source_type: 'Unsupported file type. Only .jsonl and .csv are supported.',
  file_not_readable: 'File not readable.',
  pipeline_failed: 'Pipeline execution failed.',
  report_generation_failed: 'Report generation failed.',
  file_write_failed: 'File write failed.',
  unexpected_error: 'An unexpected error occurred.',
};

/** Get the fixed content-free message for a category. */
function getContentFreeMessage(category: CliErrorCategory): string {
  return ERROR_MESSAGES[category];
}

/**
 * Map any error to a content-free message string.
 * Never forwards raw .message, stack traces, file paths, or sensitive data.
 */
export function mapToContentFreeError(error: unknown, _stage: string): string {
  if (error instanceof CliError) {
    return ERROR_MESSAGES[error.category];
  }
  return ERROR_MESSAGES.unexpected_error;
}

// --- Source type inference ---

/**
 * Infer source type from file extension. Case-insensitive.
 * Throws CliError(unsupported_source_type) for unsupported extensions.
 */
export function inferSourceType(filePath: string): SourceType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jsonl') return 'jsonl';
  if (ext === '.csv') return 'csv';
  throw new CliError('unsupported_source_type');
}

// --- Argument parsing ---

/** Known flags that accept a value (next token). */
const VALUE_FLAGS = new Set(['--file', '--out']);

/** Known boolean flags. */
const BOOLEAN_FLAGS = new Set(['--save', '--include-prompt-text', '--help', '-h']);

/**
 * Parse CLI arguments from process.argv.slice(2).
 * Manual parsing only — no framework.
 * Throws CliError(invalid_args) for unknown flags or missing values.
 * Help flag takes priority: if --help/-h is anywhere in argv, returns
 * help: true without validating other flags (per Requirement 12).
 */
export function parseCliArgs(argv: string[]): CliOptions {
  // Help priority: if --help or -h appears anywhere, return immediately
  if (argv.includes('--help') || argv.includes('-h')) {
    return {
      mode: 'demo',
      output_mode: 'stdout',
      include_prompt_text: false,
      help: true,
    };
  }

  const options: CliOptions = {
    mode: 'demo',
    output_mode: 'stdout',
    include_prompt_text: false,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const token = argv[i];

    if (token === '--file') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new CliError('invalid_args');
      }
      options.mode = 'file';
      options.file_path = value;
      options.source_type = inferSourceType(value);
      i += 2;
      continue;
    }

    if (token === '--out') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new CliError('invalid_args');
      }
      options.output_mode = 'file';
      options.output_path = value;
      i += 2;
      continue;
    }

    if (token === '--save') {
      options.output_mode = 'file';
      // --out takes precedence if both present; set default only if no --out yet
      if (!options.output_path) {
        options.output_path = './cooked-report.md';
      }
      i++;
      continue;
    }

    if (token === '--include-prompt-text') {
      options.include_prompt_text = true;
      i++;
      continue;
    }

    // Unknown flag or positional argument
    if (!VALUE_FLAGS.has(token) && !BOOLEAN_FLAGS.has(token)) {
      throw new CliError('invalid_args');
    }

    i++;
  }

  return options;
}

// --- Build DemoInput ---

/**
 * Map CliOptions to DemoInput for runIntegrationDemo.
 * Does not read files or mutate options.
 */
export function buildDemoInput(options: CliOptions): DemoInput {
  if (options.mode === 'demo') {
    return { mode: 'demo' };
  }

  if (!options.file_path || !options.source_type) {
    throw new CliError('invalid_args');
  }

  return {
    mode: 'file',
    file_path: options.file_path,
    source_type: options.source_type,
  };
}

// --- Help text ---

/**
 * Format usage text for --help output.
 * Does not mention unsupported features.
 */
export function formatUsage(): string {
  return [
    'Usage: npm run demo [-- <flags>]',
    '',
    'Flags:',
    '  --file <path>          Run pipeline against a JSONL or CSV file',
    '  --out <path>           Save markdown report to specified file',
    '  --save                 Save markdown report to ./cooked-report.md',
    '  --include-prompt-text  Accepted (no effect in V1)',
    '  --help, -h             Show this help and exit',
    '',
  ].join('\n');
}

// --- Output writer types ---

/** Injectable I/O for testable output routing. */
export interface CliWriters {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  writeFile: (filePath: string, content: string, encoding: 'utf8') => void;
  exists: (filePath: string) => boolean;
  isDirectoryWritable: (dirPath: string) => boolean;
  now?: () => Date;
  cwd?: () => string;
}

// --- Output helpers ---

/** Ensure markdown ends with a trailing newline. */
export function ensureTrailingNewline(markdown: string): string {
  if (markdown.endsWith('\n')) return markdown;
  return markdown + '\n';
}

/**
 * Resolve a collision-safe file path.
 * If target exists, appends UTC timestamp `-YYYYMMDD-HHmmss` before extension.
 * If timestamped target also exists, adds numeric suffix.
 */
export function resolveCollisionSafePath(
  targetPath: string,
  exists: (filePath: string) => boolean,
  now: () => Date,
): string {
  if (!exists(targetPath)) return targetPath;

  const ext = path.extname(targetPath);
  const base = ext ? targetPath.slice(0, -ext.length) : targetPath;

  const d = now();
  const ts = [
    String(d.getUTCFullYear()),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
    '-',
    String(d.getUTCHours()).padStart(2, '0'),
    String(d.getUTCMinutes()).padStart(2, '0'),
    String(d.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  const candidate = `${base}-${ts}${ext}`;
  if (!exists(candidate)) return candidate;

  // Numeric suffix fallback
  for (let i = 1; i < 1000; i++) {
    const numbered = `${base}-${ts}-${i}${ext}`;
    if (!exists(numbered)) return numbered;
  }

  // Should not happen in practice
  return candidate;
}

/**
 * Validate that the output directory exists and is writable.
 * Throws CliError('file_write_failed') if not.
 * Does not include directory path in error message.
 */
export function validateOutputDirectory(
  outputPath: string,
  isDirectoryWritable: (dirPath: string) => boolean,
): void {
  const dir = path.dirname(outputPath) || '.';
  if (!isDirectoryWritable(dir)) {
    throw new CliError('file_write_failed');
  }
}

/**
 * Format a file path as relative for stderr confirmation.
 * Does not leak absolute directory structure.
 */
export function formatRelativePathForConfirmation(
  filePath: string,
  cwd: string,
): string {
  const rel = path.relative(cwd, filePath);
  // If relative path starts with '..' many levels or is absolute, use as-is
  // but prefer relative for privacy
  return rel || filePath;
}

/**
 * Write output to stdout or file based on CliOptions.
 * Returns the written file path (relative) if file mode, undefined if stdout mode.
 *
 * Does not inspect or modify markdown content.
 * Does not write raw pipeline data, debug output, or banned fields.
 */
export function writeOutput(
  markdown: string,
  options: CliOptions,
  writers: CliWriters,
): string | undefined {
  const content = ensureTrailingNewline(markdown);

  if (options.output_mode === 'stdout') {
    writers.stdout(content);
    return undefined;
  }

  // File mode
  const outputPath = options.output_path ?? './cooked-report.md';
  const nowFn = writers.now ?? (() => new Date());
  const cwdFn = writers.cwd ?? (() => process.cwd());

  // Validate directory
  validateOutputDirectory(outputPath, writers.isDirectoryWritable);

  // Resolve collision-safe path
  const finalPath = resolveCollisionSafePath(outputPath, writers.exists, nowFn);

  // Write UTF-8 markdown only
  writers.writeFile(finalPath, content, 'utf8');

  // Confirmation to stderr (relative path only)
  const relativePath = formatRelativePathForConfirmation(finalPath, cwdFn());
  writers.stderr(`Report written to ${relativePath}\n`);

  return relativePath;
}

// --- CLI Dependencies ---

export interface CliDependencies {
  runPipeline: (input: DemoInput) => Promise<UnifiedDemoOutput>;
  renderReport: (output: UnifiedDemoOutput, options: { include_markdown: true }) => DemoReport;
  writers: CliWriters;
}

// --- Default Writers ---

export function createDefaultWriters(): CliWriters {
  return {
    stdout: (text: string) => { process.stdout.write(text); },
    stderr: (text: string) => { process.stderr.write(text); },
    writeFile: (filePath: string, content: string, encoding: 'utf8') => fs.writeFileSync(filePath, content, encoding),
    exists: (filePath: string) => fs.existsSync(filePath),
    isDirectoryWritable: (dirPath: string) => {
      try {
        fs.accessSync(dirPath, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    },
    now: () => new Date(),
    cwd: () => process.cwd(),
  };
}

// --- runCli ---

export async function runCli(argv: string[], deps?: Partial<CliDependencies>): Promise<number> {
  const pipeline = deps?.runPipeline ?? runIntegrationDemo;
  const renderer = deps?.renderReport ?? renderDemoReport;
  const writers = deps?.writers ?? createDefaultWriters();

  // Stage 1: Parse args and build input
  let options: CliOptions;
  let input: DemoInput;
  try {
    options = parseCliArgs(argv);

    // Help priority
    if (options.help) {
      writers.stdout(formatUsage());
      return 0;
    }

    input = buildDemoInput(options);
  } catch (error: unknown) {
    const msg = mapToContentFreeError(error, 'parse');
    writers.stderr(msg + '\n');
    return 1;
  }

  // Stage 2: Run pipeline
  let output: UnifiedDemoOutput;
  try {
    output = await pipeline(input);
  } catch {
    writers.stderr('Pipeline execution failed.\n');
    return 1;
  }

  // Stage 3: Render report
  let markdown: string;
  try {
    const report = renderer(output, { include_markdown: true });
    if (!report.markdown || typeof report.markdown !== 'string') {
      writers.stderr('Report generation failed.\n');
      return 1;
    }
    markdown = report.markdown;
  } catch {
    writers.stderr('Report generation failed.\n');
    return 1;
  }

  // Stage 4: Write output
  try {
    writeOutput(markdown, options, writers);
    return 0;
  } catch {
    writers.stderr('File write failed.\n');
    return 1;
  }
}

// --- Main ---

/**
 * Main CLI entry point.
 * Delegates to runCli with real process.argv.
 */
export async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  process.exitCode = code;
}

// --- Process fatal error handler ---

/**
 * Handle a fatal process error. Used by uncaughtException/unhandledRejection handlers.
 * Writes content-free error to stderr and calls exit with code 1.
 */
export function handleProcessFatalError(
  stderr: (text: string) => void,
  exit: (code: number) => void,
): void {
  stderr('An unexpected error occurred.\n');
  exit(1);
}

// --- Direct execution guard ---
// Only run main() when this file is executed directly (not imported in tests).

const isDirectExecution = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1];
    if (!entryFile) return false;
    return path.resolve(thisFile) === path.resolve(entryFile);
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  process.on('uncaughtException', () => {
    handleProcessFatalError(
      (t) => process.stderr.write(t),
      (c) => process.exit(c),
    );
  });

  process.on('unhandledRejection', () => {
    handleProcessFatalError(
      (t) => process.stderr.write(t),
      (c) => process.exit(c),
    );
  });

  main().catch(() => {
    handleProcessFatalError(
      (t) => process.stderr.write(t),
      (c) => process.exit(c),
    );
  });
}
