import { describe, it, expect, vi } from 'vitest';
import {
  parseCliArgs,
  inferSourceType,
  buildDemoInput,
  formatUsage,
  mapToContentFreeError,
  CliError,
  ensureTrailingNewline,
  resolveCollisionSafePath,
  validateOutputDirectory,
  formatRelativePathForConfirmation,
  writeOutput,
  runCli,
  createDefaultWriters,
} from '../../src/cli/demo-runner.js';
import type { CliOptions, CliWriters, CliDependencies } from '../../src/cli/demo-runner.js';

describe('parseCliArgs', () => {
  it('default no args returns demo/stdout/help false/include_prompt_text false', () => {
    const opts = parseCliArgs([]);
    expect(opts.mode).toBe('demo');
    expect(opts.output_mode).toBe('stdout');
    expect(opts.help).toBe(false);
    expect(opts.include_prompt_text).toBe(false);
    expect(opts.file_path).toBeUndefined();
    expect(opts.output_path).toBeUndefined();
  });

  it('--file ./x.jsonl returns file mode with source_type jsonl', () => {
    const opts = parseCliArgs(['--file', './x.jsonl']);
    expect(opts.mode).toBe('file');
    expect(opts.file_path).toBe('./x.jsonl');
    expect(opts.source_type).toBe('jsonl');
  });

  it('--file ./x.csv returns file mode with source_type csv', () => {
    const opts = parseCliArgs(['--file', './x.csv']);
    expect(opts.mode).toBe('file');
    expect(opts.file_path).toBe('./x.csv');
    expect(opts.source_type).toBe('csv');
  });

  it('uppercase extensions work: .JSONL', () => {
    const opts = parseCliArgs(['--file', './data.JSONL']);
    expect(opts.source_type).toBe('jsonl');
  });

  it('uppercase extensions work: .CSV', () => {
    const opts = parseCliArgs(['--file', './data.CSV']);
    expect(opts.source_type).toBe('csv');
  });

  it('--out ./report.md sets output_mode file and output_path', () => {
    const opts = parseCliArgs(['--out', './report.md']);
    expect(opts.output_mode).toBe('file');
    expect(opts.output_path).toBe('./report.md');
  });

  it('--save sets output_path ./cooked-report.md', () => {
    const opts = parseCliArgs(['--save']);
    expect(opts.output_mode).toBe('file');
    expect(opts.output_path).toBe('./cooked-report.md');
  });

  it('both --save and --out ./custom.md results in ./custom.md', () => {
    const opts1 = parseCliArgs(['--save', '--out', './custom.md']);
    expect(opts1.output_path).toBe('./custom.md');

    const opts2 = parseCliArgs(['--out', './custom.md', '--save']);
    expect(opts2.output_path).toBe('./custom.md');
  });

  it('--include-prompt-text is accepted and sets include_prompt_text true', () => {
    const opts = parseCliArgs(['--include-prompt-text']);
    expect(opts.include_prompt_text).toBe(true);
  });

  it('--help sets help true', () => {
    const opts = parseCliArgs(['--help']);
    expect(opts.help).toBe(true);
  });

  it('-h sets help true', () => {
    const opts = parseCliArgs(['-h']);
    expect(opts.help).toBe(true);
  });

  it('unknown flag throws categorized invalid_args', () => {
    expect(() => parseCliArgs(['--verbose'])).toThrow(CliError);
    try {
      parseCliArgs(['--verbose']);
    } catch (e) {
      expect((e as CliError).category).toBe('invalid_args');
    }
  });

  it('missing --file value throws categorized invalid_args', () => {
    expect(() => parseCliArgs(['--file'])).toThrow(CliError);
    try {
      parseCliArgs(['--file']);
    } catch (e) {
      expect((e as CliError).category).toBe('invalid_args');
    }
  });

  it('missing --out value throws categorized invalid_args', () => {
    expect(() => parseCliArgs(['--out'])).toThrow(CliError);
    try {
      parseCliArgs(['--out']);
    } catch (e) {
      expect((e as CliError).category).toBe('invalid_args');
    }
  });

  it('positional arg throws categorized invalid_args', () => {
    expect(() => parseCliArgs(['somefile.jsonl'])).toThrow(CliError);
    try {
      parseCliArgs(['somefile.jsonl']);
    } catch (e) {
      expect((e as CliError).category).toBe('invalid_args');
    }
  });

  it('--file with unsupported extension throws unsupported_source_type', () => {
    expect(() => parseCliArgs(['--file', './data.txt'])).toThrow(CliError);
    try {
      parseCliArgs(['--file', './data.txt']);
    } catch (e) {
      expect((e as CliError).category).toBe('unsupported_source_type');
    }
  });

  describe('help priority (Requirement 12)', () => {
    it('--help --bad does not throw and returns help true', () => {
      const opts = parseCliArgs(['--help', '--bad']);
      expect(opts.help).toBe(true);
      expect(opts.mode).toBe('demo');
      expect(opts.output_mode).toBe('stdout');
    });

    it('--bad --help does not throw and returns help true', () => {
      const opts = parseCliArgs(['--bad', '--help']);
      expect(opts.help).toBe(true);
      expect(opts.mode).toBe('demo');
    });

    it('--file --help does not throw and returns help true', () => {
      const opts = parseCliArgs(['--file', '--help']);
      expect(opts.help).toBe(true);
      expect(opts.file_path).toBeUndefined();
    });

    it('--out --help does not throw and returns help true', () => {
      const opts = parseCliArgs(['--out', '--help']);
      expect(opts.help).toBe(true);
      expect(opts.output_path).toBeUndefined();
    });

    it('-h --bad does not throw and returns help true', () => {
      const opts = parseCliArgs(['-h', '--bad']);
      expect(opts.help).toBe(true);
      expect(opts.mode).toBe('demo');
    });

    it('--help with valid flags does not process them', () => {
      const opts = parseCliArgs(['--help', '--file', './data.jsonl', '--save']);
      expect(opts.help).toBe(true);
      expect(opts.file_path).toBeUndefined();
      expect(opts.output_path).toBeUndefined();
      expect(opts.mode).toBe('demo');
      expect(opts.output_mode).toBe('stdout');
    });
  });
});

describe('inferSourceType', () => {
  it('.jsonl returns jsonl', () => {
    expect(inferSourceType('./prompts.jsonl')).toBe('jsonl');
  });

  it('.csv returns csv', () => {
    expect(inferSourceType('./prompts.csv')).toBe('csv');
  });

  it('.JSONL returns jsonl (case-insensitive)', () => {
    expect(inferSourceType('./DATA.JSONL')).toBe('jsonl');
  });

  it('.CSV returns csv (case-insensitive)', () => {
    expect(inferSourceType('./DATA.CSV')).toBe('csv');
  });

  it('unsupported .txt throws categorized unsupported_source_type', () => {
    expect(() => inferSourceType('./file.txt')).toThrow(CliError);
    try {
      inferSourceType('./file.txt');
    } catch (e) {
      expect((e as CliError).category).toBe('unsupported_source_type');
    }
  });

  it('no extension throws categorized unsupported_source_type', () => {
    expect(() => inferSourceType('./noext')).toThrow(CliError);
    try {
      inferSourceType('./noext');
    } catch (e) {
      expect((e as CliError).category).toBe('unsupported_source_type');
    }
  });
});

describe('buildDemoInput', () => {
  it('demo mode maps to { mode: "demo" }', () => {
    const opts: CliOptions = {
      mode: 'demo',
      output_mode: 'stdout',
      include_prompt_text: false,
      help: false,
    };
    const input = buildDemoInput(opts);
    expect(input).toEqual({ mode: 'demo' });
  });

  it('file mode maps to { mode: "file", file_path, source_type }', () => {
    const opts: CliOptions = {
      mode: 'file',
      file_path: './prompts.jsonl',
      source_type: 'jsonl',
      output_mode: 'stdout',
      include_prompt_text: false,
      help: false,
    };
    const input = buildDemoInput(opts);
    expect(input).toEqual({ mode: 'file', file_path: './prompts.jsonl', source_type: 'jsonl' });
  });

  it('missing file fields throw categorized invalid_args', () => {
    const opts: CliOptions = {
      mode: 'file',
      output_mode: 'stdout',
      include_prompt_text: false,
      help: false,
    };
    expect(() => buildDemoInput(opts)).toThrow(CliError);
    try {
      buildDemoInput(opts);
    } catch (e) {
      expect((e as CliError).category).toBe('invalid_args');
    }
  });

  it('does not mutate input options', () => {
    const opts: CliOptions = {
      mode: 'demo',
      output_mode: 'stdout',
      include_prompt_text: false,
      help: false,
    };
    const snapshot = JSON.stringify(opts);
    buildDemoInput(opts);
    expect(JSON.stringify(opts)).toBe(snapshot);
  });
});

describe('formatUsage', () => {
  it('contains all required flags', () => {
    const usage = formatUsage();
    expect(usage).toContain('--file');
    expect(usage).toContain('--out');
    expect(usage).toContain('--save');
    expect(usage).toContain('--include-prompt-text');
    expect(usage).toContain('--help');
    expect(usage).toContain('-h');
  });

  it('each flag appears on its own line', () => {
    const usage = formatUsage();
    const lines = usage.split('\n');
    const flagLines = lines.filter((l) => l.trim().startsWith('--') || l.trim().startsWith('-h'));
    expect(flagLines.length).toBeGreaterThanOrEqual(5);
  });

  it('does not mention unsupported features', () => {
    const usage = formatUsage();
    expect(usage.toLowerCase()).not.toContain('pdf');
    expect(usage.toLowerCase()).not.toContain('docx');
    expect(usage.toLowerCase()).not.toContain('cloud');
    expect(usage.toLowerCase()).not.toContain('provider');
    expect(usage.toLowerCase()).not.toContain('browser extension');
  });
});

describe('mapToContentFreeError', () => {
  it('invalid_args returns exact fixed message', () => {
    const err = new CliError('invalid_args');
    expect(mapToContentFreeError(err, 'parse')).toBe('Invalid arguments. Run with --help for usage.');
  });

  it('unsupported_source_type returns exact fixed message', () => {
    const err = new CliError('unsupported_source_type');
    expect(mapToContentFreeError(err, 'parse')).toBe('Unsupported file type. Only .jsonl and .csv are supported.');
  });

  it('file_not_readable returns exact fixed message', () => {
    const err = new CliError('file_not_readable');
    expect(mapToContentFreeError(err, 'read')).toBe('File not readable.');
  });

  it('pipeline_failed returns exact fixed message', () => {
    const err = new CliError('pipeline_failed');
    expect(mapToContentFreeError(err, 'pipeline')).toBe('Pipeline execution failed.');
  });

  it('report_generation_failed returns exact fixed message', () => {
    const err = new CliError('report_generation_failed');
    expect(mapToContentFreeError(err, 'render')).toBe('Report generation failed.');
  });

  it('file_write_failed returns exact fixed message', () => {
    const err = new CliError('file_write_failed');
    expect(mapToContentFreeError(err, 'write')).toBe('File write failed.');
  });

  it('unexpected_error returns exact fixed message', () => {
    const err = new CliError('unexpected_error');
    expect(mapToContentFreeError(err, 'unknown')).toBe('An unexpected error occurred.');
  });

  it('unknown Error returns "An unexpected error occurred."', () => {
    const err = new Error('some raw message with /path/to/secret');
    expect(mapToContentFreeError(err, 'unknown')).toBe('An unexpected error occurred.');
  });

  it('raw error message is not included', () => {
    const err = new Error('SENSITIVE_PATH/credentials.json: permission denied');
    const result = mapToContentFreeError(err, 'read');
    expect(result).not.toContain('SENSITIVE_PATH');
    expect(result).not.toContain('credentials');
    expect(result).not.toContain('permission denied');
  });

  it('stack-like text is not included', () => {
    const err = new Error('fail');
    err.stack = 'Error: fail\n    at Object.<anonymous> (/home/user/secret/file.ts:10:5)';
    const result = mapToContentFreeError(err, 'pipeline');
    expect(result).not.toContain('at Object');
    expect(result).not.toContain('/home/user');
    expect(result).not.toContain('file.ts');
  });
});

describe('import safety', () => {
  it('importing the module does not execute main or print output', async () => {
    // The module uses a direct-execution guard (fileURLToPath vs process.argv[1]),
    // so importing in vitest does not trigger main() or process.exit().
    // This test verifies the module is importable and exports expected symbols
    // without side effects. The guard prevents main() from running because
    // vitest's entry point differs from the module path.
    const mod = await import('../../src/cli/demo-runner.js');
    expect(mod.main).toBeDefined();
    expect(mod.parseCliArgs).toBeDefined();
    expect(mod.inferSourceType).toBeDefined();
    expect(mod.buildDemoInput).toBeDefined();
    expect(mod.formatUsage).toBeDefined();
    expect(mod.mapToContentFreeError).toBeDefined();
    expect(mod.CliError).toBeDefined();
  });

  it('all exported pure functions are callable without side effects', () => {
    // Verify that calling pure functions does not trigger stdout writes or exits
    const opts = parseCliArgs([]);
    expect(opts.mode).toBe('demo');

    const usage = formatUsage();
    expect(usage.length).toBeGreaterThan(0);

    const msg = mapToContentFreeError(new Error('test'), 'test');
    expect(msg).toBe('An unexpected error occurred.');
  });
});

// --- Wave 2: Output writer and file safety tests ---

function makeWriters(overrides: Partial<CliWriters> = {}): CliWriters & { stdoutCalls: string[]; stderrCalls: string[]; writtenFiles: Array<{ path: string; content: string }> } {
  const stdoutCalls: string[] = [];
  const stderrCalls: string[] = [];
  const writtenFiles: Array<{ path: string; content: string }> = [];
  return {
    stdout: (text: string) => stdoutCalls.push(text),
    stderr: (text: string) => stderrCalls.push(text),
    writeFile: (filePath: string, content: string) => writtenFiles.push({ path: filePath, content }),
    exists: () => false,
    isDirectoryWritable: () => true,
    now: () => new Date('2026-07-05T01:00:00.000Z'),
    cwd: () => '/project',
    stdoutCalls,
    stderrCalls,
    writtenFiles,
    ...overrides,
  };
}

describe('ensureTrailingNewline', () => {
  it('adds newline when missing', () => {
    expect(ensureTrailingNewline('hello')).toBe('hello\n');
  });

  it('preserves existing newline', () => {
    expect(ensureTrailingNewline('hello\n')).toBe('hello\n');
  });

  it('handles empty string', () => {
    expect(ensureTrailingNewline('')).toBe('\n');
  });
});

describe('resolveCollisionSafePath', () => {
  const fixedNow = () => new Date('2026-07-05T01:00:00.000Z');

  it('returns unchanged path when target does not exist', () => {
    const result = resolveCollisionSafePath('./report.md', () => false, fixedNow);
    expect(result).toBe('./report.md');
  });

  it('appends timestamp before .md when target exists', () => {
    const result = resolveCollisionSafePath(
      './cooked-report.md',
      (p) => p === './cooked-report.md',
      fixedNow,
    );
    expect(result).toBe('./cooked-report-20260705-010000.md');
  });

  it('appends timestamp to path without extension', () => {
    const result = resolveCollisionSafePath(
      './report',
      (p) => p === './report',
      fixedNow,
    );
    expect(result).toBe('./report-20260705-010000');
  });

  it('handles multi-dot names correctly', () => {
    const result = resolveCollisionSafePath(
      './archive.report.md',
      (p) => p === './archive.report.md',
      fixedNow,
    );
    // extname gives .md, so base is ./archive.report
    expect(result).toBe('./archive.report-20260705-010000.md');
  });

  it('uses UTC timestamp', () => {
    const utcNow = () => new Date('2026-12-31T23:59:59.000Z');
    const result = resolveCollisionSafePath(
      './r.md',
      (p) => p === './r.md',
      utcNow,
    );
    expect(result).toBe('./r-20261231-235959.md');
  });

  it('adds numeric suffix if timestamped path also exists', () => {
    const existing = new Set(['./r.md', './r-20260705-010000.md']);
    const result = resolveCollisionSafePath(
      './r.md',
      (p) => existing.has(p),
      fixedNow,
    );
    expect(result).toBe('./r-20260705-010000-1.md');
  });

  it('increments numeric suffix until unique', () => {
    const existing = new Set(['./r.md', './r-20260705-010000.md', './r-20260705-010000-1.md']);
    const result = resolveCollisionSafePath(
      './r.md',
      (p) => existing.has(p),
      fixedNow,
    );
    expect(result).toBe('./r-20260705-010000-2.md');
  });
});

describe('validateOutputDirectory', () => {
  it('accepts writable directory', () => {
    expect(() => validateOutputDirectory('./report.md', () => true)).not.toThrow();
  });

  it('throws file_write_failed if directory not writable', () => {
    expect(() => validateOutputDirectory('./bad/report.md', () => false)).toThrow(CliError);
    try {
      validateOutputDirectory('./bad/report.md', () => false);
    } catch (e) {
      expect((e as CliError).category).toBe('file_write_failed');
    }
  });

  it('does not include directory path in mapped error', () => {
    try {
      validateOutputDirectory('/secret/internal/path/report.md', () => false);
    } catch (e) {
      const msg = mapToContentFreeError(e, 'write');
      expect(msg).not.toContain('/secret');
      expect(msg).not.toContain('internal');
      expect(msg).toBe('File write failed.');
    }
  });
});

describe('formatRelativePathForConfirmation', () => {
  it('returns relative path', () => {
    const result = formatRelativePathForConfirmation('/project/report.md', '/project');
    expect(result).toBe('report.md');
  });

  it('handles subdirectory paths', () => {
    const result = formatRelativePathForConfirmation('/project/out/report.md', '/project');
    expect(result).toContain('out');
    expect(result).toContain('report.md');
    expect(result).not.toContain('/project');
  });
});

describe('writeOutput', () => {
  describe('stdout mode', () => {
    it('writes markdown to stdout', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      writeOutput('# Report', opts, w);
      expect(w.stdoutCalls.join('')).toContain('# Report');
    });

    it('ensures trailing newline', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      writeOutput('content', opts, w);
      expect(w.stdoutCalls.join('')).toBe('content\n');
    });

    it('does not write to stderr', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.stderrCalls).toHaveLength(0);
    });

    it('does not call writeFile', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles).toHaveLength(0);
    });

    it('returns undefined', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      const result = writeOutput('# Report\n', opts, w);
      expect(result).toBeUndefined();
    });
  });

  describe('file mode', () => {
    it('writes UTF-8 markdown to output_path', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report.md', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles).toHaveLength(1);
      expect(w.writtenFiles[0].content).toBe('# Report\n');
    });

    it('uses ./cooked-report.md fallback when output_path missing', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./cooked-report.md');
    });

    it('--out style custom path works', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './custom/out.md', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./custom/out.md');
    });

    it('collision-safe filename used if target exists', () => {
      const w = makeWriters({ exists: (p) => p === './report.md' });
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report.md', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./report-20260705-010000.md');
    });

    it('no-extension collision works', () => {
      const w = makeWriters({ exists: (p) => p === './report' });
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./report-20260705-010000');
    });

    it('writes confirmation to stderr only', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report.md', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.stderrCalls.length).toBeGreaterThan(0);
      expect(w.stderrCalls.join('')).toContain('report.md');
    });

    it('confirmation path is relative', () => {
      const w = makeWriters({ cwd: () => '/project' });
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: '/project/report.md', include_prompt_text: false, help: false };
      writeOutput('# Report\n', opts, w);
      expect(w.stderrCalls.join('')).toContain('report.md');
      expect(w.stderrCalls.join('')).not.toContain('/project/report.md');
    });

    it('stdout receives no report content in file mode', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report.md', include_prompt_text: false, help: false };
      writeOutput('# Secret Report Content\n', opts, w);
      expect(w.stdoutCalls).toHaveLength(0);
    });

    it('throws categorized file_write_failed if directory not writable', () => {
      const w = makeWriters({ isDirectoryWritable: () => false });
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './bad/report.md', include_prompt_text: false, help: false };
      expect(() => writeOutput('# Report\n', opts, w)).toThrow(CliError);
      try {
        writeOutput('# Report\n', opts, w);
      } catch (e) {
        expect((e as CliError).category).toBe('file_write_failed');
      }
    });

    it('does not mutate options', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './report.md', include_prompt_text: false, help: false };
      const snapshot = JSON.stringify(opts);
      writeOutput('# Report\n', opts, w);
      expect(JSON.stringify(opts)).toBe(snapshot);
    });
  });

  describe('output routing', () => {
    it('stdout mode writes stdout only', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'stdout', include_prompt_text: false, help: false };
      writeOutput('content\n', opts, w);
      expect(w.stdoutCalls.length).toBeGreaterThan(0);
      expect(w.writtenFiles).toHaveLength(0);
    });

    it('file mode writes file only', () => {
      const w = makeWriters();
      const opts: CliOptions = { mode: 'demo', output_mode: 'file', output_path: './r.md', include_prompt_text: false, help: false };
      writeOutput('content\n', opts, w);
      expect(w.stdoutCalls).toHaveLength(0);
      expect(w.writtenFiles.length).toBeGreaterThan(0);
    });

    it('--save parsed options write to ./cooked-report.md', () => {
      const w = makeWriters();
      const opts = parseCliArgs(['--save']);
      writeOutput('content\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./cooked-report.md');
    });

    it('--out parsed options write to custom path', () => {
      const w = makeWriters();
      const opts = parseCliArgs(['--out', './my-report.md']);
      writeOutput('content\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./my-report.md');
    });

    it('both --save and --out parsed options write to --out path', () => {
      const w = makeWriters();
      const opts = parseCliArgs(['--save', '--out', './custom.md']);
      writeOutput('content\n', opts, w);
      expect(w.writtenFiles[0].path).toBe('./custom.md');
    });
  });
});


// --- Wave 3: Pipeline and renderer integration tests ---

function makeFakeDeps(overrides: Partial<CliDependencies> = {}): CliDependencies & { writers: ReturnType<typeof makeWriters> } {
  const writers = makeWriters();
  const base = {
    runPipeline: async () => ({
      prompt_results: [],
      batch_summary: {
        total_prompts: 0,
        succeeded: 0,
        failed: 0,
        average_overall_score: null,
        dimension_averages: {},
        issue_label_counts: {},
        most_common_labels: [],
        safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 },
        model_class_distribution: {},
      },
      metadata: {
        orchestrator_version: 'test',
        engines_used: {},
        pipeline_started_at: '2026-01-01T00:00:00.000Z',
        pipeline_completed_at: '2026-01-01T00:00:01.000Z',
        total_duration_ms: 1000,
        input_source: 'test',
      },
    }),
    renderReport: () => ({
      title: 'Test',
      summary: 'Test summary',
      sections: [],
      generated_at: '2026-01-01',
      renderer_version: 'test',
      markdown: '# Test Report\n\nContent here.\n',
    }),
    writers,
  };
  if (overrides.runPipeline) base.runPipeline = overrides.runPipeline as typeof base.runPipeline;
  if (overrides.renderReport) base.renderReport = overrides.renderReport as typeof base.renderReport;
  return base;
}

describe('runCli (Wave 3 integration)', () => {
  describe('help', () => {
    it('--help returns 0 and writes usage to stdout', async () => {
      const deps = makeFakeDeps();
      const code = await runCli(['--help'], deps);
      expect(code).toBe(0);
      expect(deps.writers.stdoutCalls.join('')).toContain('--file');
      expect(deps.writers.stdoutCalls.join('')).toContain('--help');
    });

    it('--help does not call pipeline', async () => {
      const pipelineSpy = vi.fn();
      const deps = makeFakeDeps({ runPipeline: pipelineSpy });
      await runCli(['--help'], deps);
      expect(pipelineSpy).not.toHaveBeenCalled();
    });

    it('--help with bad flags returns 0 and pipeline not called', async () => {
      const pipelineSpy = vi.fn();
      const deps = makeFakeDeps({ runPipeline: pipelineSpy });
      const code = await runCli(['--bad', '--help'], deps);
      expect(code).toBe(0);
      expect(pipelineSpy).not.toHaveBeenCalled();
    });
  });

  describe('demo mode', () => {
    it('no args calls pipeline with { mode: "demo" } and writes markdown to stdout', async () => {
      const pipelineSpy = vi.fn().mockResolvedValue({
        prompt_results: [],
        batch_summary: { total_prompts: 0, succeeded: 0, failed: 0, average_overall_score: null, dimension_averages: {}, issue_label_counts: {}, most_common_labels: [], safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 }, model_class_distribution: {} },
        metadata: { orchestrator_version: 'test', engines_used: {}, pipeline_started_at: '', pipeline_completed_at: '', total_duration_ms: 0, input_source: 'test' },
      });
      const deps = makeFakeDeps({ runPipeline: pipelineSpy });
      const code = await runCli([], deps);
      expect(code).toBe(0);
      expect(pipelineSpy).toHaveBeenCalledWith({ mode: 'demo' });
      expect(deps.writers.stdoutCalls.join('')).toContain('# Test Report');
    });
  });

  describe('file mode', () => {
    it('--file ./p.jsonl calls pipeline with correct input', async () => {
      const pipelineSpy = vi.fn().mockResolvedValue({
        prompt_results: [],
        batch_summary: { total_prompts: 0, succeeded: 0, failed: 0, average_overall_score: null, dimension_averages: {}, issue_label_counts: {}, most_common_labels: [], safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 }, model_class_distribution: {} },
        metadata: { orchestrator_version: 'test', engines_used: {}, pipeline_started_at: '', pipeline_completed_at: '', total_duration_ms: 0, input_source: 'test' },
      });
      const deps = makeFakeDeps({ runPipeline: pipelineSpy });
      const code = await runCli(['--file', './p.jsonl'], deps);
      expect(code).toBe(0);
      expect(pipelineSpy).toHaveBeenCalledWith({ mode: 'file', file_path: './p.jsonl', source_type: 'jsonl' });
    });

    it('--file ./p.csv calls pipeline with correct input', async () => {
      const pipelineSpy = vi.fn().mockResolvedValue({
        prompt_results: [],
        batch_summary: { total_prompts: 0, succeeded: 0, failed: 0, average_overall_score: null, dimension_averages: {}, issue_label_counts: {}, most_common_labels: [], safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 }, model_class_distribution: {} },
        metadata: { orchestrator_version: 'test', engines_used: {}, pipeline_started_at: '', pipeline_completed_at: '', total_duration_ms: 0, input_source: 'test' },
      });
      const deps = makeFakeDeps({ runPipeline: pipelineSpy });
      const code = await runCli(['--file', './p.csv'], deps);
      expect(code).toBe(0);
      expect(pipelineSpy).toHaveBeenCalledWith({ mode: 'file', file_path: './p.csv', source_type: 'csv' });
    });
  });

  describe('save mode', () => {
    it('--save writes to file through writers', async () => {
      const deps = makeFakeDeps();
      const code = await runCli(['--save'], deps);
      expect(code).toBe(0);
      expect(deps.writers.writtenFiles.length).toBeGreaterThan(0);
      expect(deps.writers.writtenFiles[0].content).toContain('# Test Report');
    });

    it('--save does not write markdown to stdout', async () => {
      const deps = makeFakeDeps();
      await runCli(['--save'], deps);
      const stdout = deps.writers.stdoutCalls.join('');
      expect(stdout).not.toContain('# Test Report');
      expect(stdout).not.toContain('Content here');
    });

    it('--save writes confirmation to stderr', async () => {
      const deps = makeFakeDeps();
      await runCli(['--save'], deps);
      const stderr = deps.writers.stderrCalls.join('');
      expect(stderr).toContain('Report written to');
    });
  });

  describe('out mode', () => {
    it('--out ./x.md writes to specified path', async () => {
      const deps = makeFakeDeps();
      const code = await runCli(['--out', './x.md'], deps);
      expect(code).toBe(0);
      expect(deps.writers.writtenFiles[0].path).toBe('./x.md');
    });
  });

  describe('error handling', () => {
    it('invalid args returns 1 with content-free error on stderr', async () => {
      const deps = makeFakeDeps();
      const code = await runCli(['--bad'], deps);
      expect(code).toBe(1);
      expect(deps.writers.stderrCalls.join('')).toContain('Invalid arguments.');
    });

    it('unsupported file type returns 1 with correct message', async () => {
      const deps = makeFakeDeps();
      const code = await runCli(['--file', './x.txt'], deps);
      expect(code).toBe(1);
      expect(deps.writers.stderrCalls.join('')).toContain('Unsupported file type.');
    });

    it('pipeline throws returns 1 with pipeline error', async () => {
      const deps = makeFakeDeps({
        runPipeline: async () => { throw new Error('some internal error'); },
      });
      const code = await runCli([], deps);
      expect(code).toBe(1);
      expect(deps.writers.stderrCalls.join('')).toContain('Pipeline execution failed.');
      expect(deps.writers.stderrCalls.join('')).not.toContain('some internal error');
    });

    it('renderer throws returns 1 with report error', async () => {
      const deps = makeFakeDeps({
        renderReport: () => { throw new Error('render explosion'); },
      });
      const code = await runCli([], deps);
      expect(code).toBe(1);
      expect(deps.writers.stderrCalls.join('')).toContain('Report generation failed.');
      expect(deps.writers.stderrCalls.join('')).not.toContain('render explosion');
    });

    it('renderer returns no markdown returns 1', async () => {
      const deps = makeFakeDeps({
        renderReport: () => ({
          title: 'Test',
          summary: 'Test summary',
          sections: [],
          generated_at: '2026-01-01',
          renderer_version: 'test',
          markdown: undefined,
        }),
      });
      const code = await runCli([], deps);
      expect(code).toBe(1);
      expect(deps.writers.stderrCalls.join('')).toContain('Report generation failed.');
    });

    it('writer throws returns 1 with file write error', async () => {
      const writers = makeWriters({ writeFile: () => { throw new Error('disk full'); } });
      const deps: CliDependencies = {
        runPipeline: makeFakeDeps().runPipeline,
        renderReport: makeFakeDeps().renderReport,
        writers,
      };
      const code = await runCli(['--save'], deps);
      expect(code).toBe(1);
      expect(writers.stderrCalls.join('')).toContain('File write failed.');
      expect(writers.stderrCalls.join('')).not.toContain('disk full');
    });

    it('writer throws does not output generic unexpected error', async () => {
      const writers = makeWriters({ writeFile: () => { throw new Error('permission denied'); } });
      const deps: CliDependencies = {
        runPipeline: makeFakeDeps().runPipeline,
        renderReport: makeFakeDeps().renderReport,
        writers,
      };
      const code = await runCli(['--save'], deps);
      expect(code).toBe(1);
      expect(writers.stderrCalls.join('')).toBe('File write failed.\n');
      expect(writers.stderrCalls.join('')).not.toContain('An unexpected error occurred.');
    });

    it('no stack traces in errors — raw thrown message not in stderr', async () => {
      const deps = makeFakeDeps({
        runPipeline: async () => { throw new Error('SENSITIVE_INTERNAL at /path/to/secret.ts:42'); },
      });
      await runCli([], deps);
      const stderr = deps.writers.stderrCalls.join('');
      expect(stderr).not.toContain('SENSITIVE_INTERNAL');
      expect(stderr).not.toContain('/path/to/secret.ts');
      expect(stderr).not.toContain('42');
    });
  });

  describe('output purity', () => {
    it('stdout contains only markdown — no extra text', async () => {
      const deps = makeFakeDeps();
      await runCli([], deps);
      const stdout = deps.writers.stdoutCalls.join('');
      // Should be exactly the report markdown + trailing newline
      expect(stdout).toBe('# Test Report\n\nContent here.\n');
    });
  });
});

describe('createDefaultWriters', () => {
  it('returns an object with all required CliWriters fields', () => {
    const writers = createDefaultWriters();
    expect(typeof writers.stdout).toBe('function');
    expect(typeof writers.stderr).toBe('function');
    expect(typeof writers.writeFile).toBe('function');
    expect(typeof writers.exists).toBe('function');
    expect(typeof writers.isDirectoryWritable).toBe('function');
    expect(typeof writers.now).toBe('function');
    expect(typeof writers.cwd).toBe('function');
  });

  it('now returns a Date', () => {
    const writers = createDefaultWriters();
    const result = writers.now!();
    expect(result).toBeInstanceOf(Date);
  });

  it('cwd returns a string', () => {
    const writers = createDefaultWriters();
    const result = writers.cwd!();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
