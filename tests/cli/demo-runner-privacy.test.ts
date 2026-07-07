import { describe, it, expect, vi } from 'vitest';
import {
  runCli,
  handleProcessFatalError,
  CliError,
} from '../../src/cli/demo-runner.js';
import type { CliDependencies, CliWriters } from '../../src/cli/demo-runner.js';

// --- Test helpers ---

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
    isDirectory: () => true,
    mkdir: () => {},
    now: () => new Date('2026-07-05T01:00:00.000Z'),
    cwd: () => '/project',
    stdoutCalls,
    stderrCalls,
    writtenFiles,
    ...overrides,
  };
}

function makeFakeDeps(overrides: Partial<CliDependencies> = {}): CliDependencies & { writers: ReturnType<typeof makeWriters> } {
  const writers = makeWriters();
  const base: CliDependencies & { writers: ReturnType<typeof makeWriters> } = {
    runPipeline: async () => ({
      prompt_results: [],
      batch_summary: {
        total_prompts: 0, succeeded: 0, failed: 0,
        average_overall_score: null, dimension_averages: {},
        issue_label_counts: {}, most_common_labels: [],
        safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 },
        model_class_distribution: {},
      },
      metadata: {
        orchestrator_version: 'test', engines_used: {},
        pipeline_started_at: '2026-01-01T00:00:00.000Z',
        pipeline_completed_at: '2026-01-01T00:00:01.000Z',
        total_duration_ms: 1000, input_source: 'test',
      },
    }),
    renderReport: () => ({
      title: 'Test', summary: 'Test summary', sections: [],
      generated_at: '2026-01-01', renderer_version: 'test',
      markdown: '# Safe Report\n\nNo sensitive data.\n',
    }),
    buildBundle: () => ({
      generated_at: '2026-01-01',
      builder_version: 'exports-v1',
      artifacts: [
        { kind: 'coaching_report' as const, filename: 'coaching-report.md' as const, content: '# Safe Report\n', media_type: 'text/markdown' as const },
        { kind: 'memory' as const, filename: 'memory.md' as const, content: '# Safe Memory\n', media_type: 'text/markdown' as const },
        { kind: 'workflow' as const, filename: 'workflow.md' as const, content: '# Safe Workflow\n', media_type: 'text/markdown' as const },
      ],
    }),
    writers,
  };
  if (overrides.runPipeline) base.runPipeline = overrides.runPipeline as typeof base.runPipeline;
  if (overrides.renderReport) base.renderReport = overrides.renderReport as typeof base.renderReport;
  if (overrides.buildBundle) base.buildBundle = overrides.buildBundle as typeof base.buildBundle;
  if (overrides.writers) base.writers = overrides.writers as typeof base.writers;
  return base;
}

// --- Sentinels ---

const BANNED_FIELD_SENTINELS = [
  'prompt_text',
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
  'template_body',
];
const OPENAI_SECRET_SENTINEL = ['sk', 'test-SECRET123'].join('-');

const SECRET_SENTINELS = [
  OPENAI_SECRET_SENTINEL,
  'ghp_SECRET123',
  'AKIASECRET123',
  'password=SECRET123',
  '/Users/private/secret-file.ts',
  'C:\\Users\\private\\secret-file.ts',
];

const SAFETY_SENTINELS = [
  'RAW_SAFETY_WARNING_SHOULD_NOT_LEAK',
];

const ROW_SENTINELS = [
  'RAW_ROW_CONTENT_SHOULD_NOT_LEAK',
  'RAW_FILE_CONTENT_SHOULD_NOT_LEAK',
];

const STACK_SENTINELS = [
  'at SecretFunction',
  'secret-stack.ts',
];

const ALL_SENTINELS = [
  ...BANNED_FIELD_SENTINELS,
  ...SECRET_SENTINELS,
  ...SAFETY_SENTINELS,
  ...ROW_SENTINELS,
  ...STACK_SENTINELS,
];

// --- 8.1 Privacy sentinel tests ---

describe('8.1 Privacy sentinel tests', () => {
  describe.each(ALL_SENTINELS)('sentinel: %s', (sentinel) => {
    it('pipeline error containing sentinel does not leak to stderr', async () => {
      const deps = makeFakeDeps({
        runPipeline: async () => { throw new Error(sentinel); },
      });
      await runCli([], deps);
      const stderr = deps.writers.stderrCalls.join('');
      expect(stderr).not.toContain(sentinel);
    });

    it('renderer error containing sentinel does not leak to stderr', async () => {
      const deps = makeFakeDeps({
        renderReport: () => { throw new Error(sentinel); },
      });
      await runCli([], deps);
      const stderr = deps.writers.stderrCalls.join('');
      expect(stderr).not.toContain(sentinel);
    });

    it('writer error containing sentinel does not leak to stderr', async () => {
      const writers = makeWriters({ writeFile: () => { throw new Error(sentinel); } });
      const deps: CliDependencies = {
        runPipeline: makeFakeDeps().runPipeline,
        renderReport: makeFakeDeps().renderReport,
        buildBundle: makeFakeDeps().buildBundle,
        writers,
      };
      await runCli(['--save'], deps);
      const stderr = writers.stderrCalls.join('');
      expect(stderr).not.toContain(sentinel);
    });
  });

  it('fake pipeline output with extra sensitive fields does not leak when renderer returns safe markdown', async () => {
    const deps = makeFakeDeps({
      runPipeline: async () => ({
        prompt_results: [],
        batch_summary: {
          total_prompts: 0, succeeded: 0, failed: 0,
          average_overall_score: null, dimension_averages: {},
          issue_label_counts: {}, most_common_labels: [],
          safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 },
          model_class_distribution: {},
        },
        metadata: {
          orchestrator_version: 'test', engines_used: {},
          pipeline_started_at: '', pipeline_completed_at: '',
          total_duration_ms: 0, input_source: 'test',
        },
        // Simulate sensitive fields that might exist on raw pipeline output
        _internal_prompt_text: OPENAI_SECRET_SENTINEL,
        _internal_secret: 'ghp_SECRET123',
      } as any),
    });
    const code = await runCli([], deps);
    expect(code).toBe(0);
    const allOutput = deps.writers.stdoutCalls.join('') + deps.writers.stderrCalls.join('');
    expect(allOutput).not.toContain(OPENAI_SECRET_SENTINEL);
    expect(allOutput).not.toContain('ghp_SECRET123');
  });

  it('exact banned field names on fake pipeline output do not appear in any CLI output', async () => {
    const deps = makeFakeDeps({
      runPipeline: async () => ({
        prompt_results: [],
        batch_summary: {
          total_prompts: 0, succeeded: 0, failed: 0,
          average_overall_score: null, dimension_averages: {},
          issue_label_counts: {}, most_common_labels: [],
          safety_summary: { prompts_with_warnings: 0, severity_counts: {}, do_not_send_external_count: 0 },
          model_class_distribution: {},
        },
        metadata: {
          orchestrator_version: 'test', engines_used: {},
          pipeline_started_at: '', pipeline_completed_at: '',
          total_duration_ms: 0, input_source: 'test',
        },
        // All exact banned fields injected via type cast
        prompt_text: 'LEAKED_PROMPT_TEXT',
        assistant_message: 'LEAKED_ASSISTANT',
        response: 'LEAKED_RESPONSE',
        completion: 'LEAKED_COMPLETION',
        model_answer: 'LEAKED_MODEL_ANSWER',
        output_text: 'LEAKED_OUTPUT_TEXT',
        generated_text: 'LEAKED_GENERATED_TEXT',
        template_body: 'LEAKED_TEMPLATE_BODY',
      } as any),
    });
    const code = await runCli([], deps);
    expect(code).toBe(0);
    const stdout = deps.writers.stdoutCalls.join('');
    const stderr = deps.writers.stderrCalls.join('');
    const allOutput = stdout + stderr;

    // None of the exact banned field values should appear
    expect(allOutput).not.toContain('LEAKED_PROMPT_TEXT');
    expect(allOutput).not.toContain('LEAKED_ASSISTANT');
    expect(allOutput).not.toContain('LEAKED_RESPONSE');
    expect(allOutput).not.toContain('LEAKED_COMPLETION');
    expect(allOutput).not.toContain('LEAKED_MODEL_ANSWER');
    expect(allOutput).not.toContain('LEAKED_OUTPUT_TEXT');
    expect(allOutput).not.toContain('LEAKED_GENERATED_TEXT');
    expect(allOutput).not.toContain('LEAKED_TEMPLATE_BODY');
  });
});

// --- 8.2 Error hardening tests ---

describe('8.2 Error hardening tests', () => {
  it('invalid args: exit 1, fixed message, stdout empty, no stack trace', async () => {
    const deps = makeFakeDeps();
    const code = await runCli(['--bad'], deps);
    expect(code).toBe(1);
    expect(deps.writers.stderrCalls.join('')).toBe('Invalid arguments. Run with --help for usage.\n');
    expect(deps.writers.stdoutCalls).toHaveLength(0);
  });

  it('unsupported extension: exit 1, fixed message, no path echo', async () => {
    const deps = makeFakeDeps();
    const code = await runCli(['--file', '/sensitive/path/data.txt'], deps);
    expect(code).toBe(1);
    const stderr = deps.writers.stderrCalls.join('');
    expect(stderr).toContain('Unsupported file type.');
    expect(stderr).not.toContain('/sensitive/path');
    expect(stderr).not.toContain('data.txt');
  });

  it('file not writable: exit 1, fixed message, no directory path echo', async () => {
    const writers = makeWriters({ isDirectoryWritable: () => false });
    const deps: CliDependencies = {
      runPipeline: makeFakeDeps().runPipeline,
      renderReport: makeFakeDeps().renderReport,
      buildBundle: makeFakeDeps().buildBundle,
      writers,
    };
    const code = await runCli(['--out', '/secret/internal/report.md'], deps);
    expect(code).toBe(1);
    const stderr = writers.stderrCalls.join('');
    expect(stderr).toContain('File write failed.');
    expect(stderr).not.toContain('/secret/internal');
  });

  it('pipeline failure: exit 1, fixed message, no raw error, no stack', async () => {
    const deps = makeFakeDeps({
      runPipeline: async () => { throw new Error('INTERNAL: at SecretFunction (secret-stack.ts:42)'); },
    });
    const code = await runCli([], deps);
    expect(code).toBe(1);
    const stderr = deps.writers.stderrCalls.join('');
    expect(stderr).toBe('Pipeline execution failed.\n');
    expect(stderr).not.toContain('INTERNAL');
    expect(stderr).not.toContain('SecretFunction');
  });

  it('render failure: exit 1, fixed message, no raw error', async () => {
    const deps = makeFakeDeps({
      renderReport: () => { throw new Error('RENDER_SECRET at /path/file.ts'); },
    });
    const code = await runCli([], deps);
    expect(code).toBe(1);
    const stderr = deps.writers.stderrCalls.join('');
    expect(stderr).toBe('Report generation failed.\n');
    expect(stderr).not.toContain('RENDER_SECRET');
  });

  it('writer failure: exit 1, fixed message, no raw error', async () => {
    const writers = makeWriters({ writeFile: () => { throw new Error('ENOSPC: disk full'); } });
    const deps: CliDependencies = {
      runPipeline: makeFakeDeps().runPipeline,
      renderReport: makeFakeDeps().renderReport,
      buildBundle: makeFakeDeps().buildBundle,
      writers,
    };
    const code = await runCli(['--save'], deps);
    expect(code).toBe(1);
    const stderr = writers.stderrCalls.join('');
    expect(stderr).toBe('File write failed.\n');
    expect(stderr).not.toContain('ENOSPC');
  });

  it('help: exit 0, stdout usage, stderr empty, no pipeline/render/file', async () => {
    const pipelineSpy = vi.fn();
    const renderSpy = vi.fn();
    const deps = makeFakeDeps({ runPipeline: pipelineSpy, renderReport: renderSpy });
    const code = await runCli(['--help'], deps);
    expect(code).toBe(0);
    expect(deps.writers.stdoutCalls.join('')).toContain('--help');
    expect(deps.writers.stderrCalls).toHaveLength(0);
    expect(deps.writers.writtenFiles).toHaveLength(0);
    expect(pipelineSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });
});

// --- 8.3 Property tests for privacy and network isolation ---

describe('8.3 Property: privacy preservation and no network', () => {
  const errorStages = [
    { name: 'pipeline', makeDeps: () => makeFakeDeps({ runPipeline: async () => { throw new Error('LEAK_TEST'); } }) },
    { name: 'renderer', makeDeps: () => makeFakeDeps({ renderReport: () => { throw new Error('LEAK_TEST'); } }) },
    { name: 'writer', makeDeps: () => {
      const writers = makeWriters({ writeFile: () => { throw new Error('LEAK_TEST'); } });
      return { runPipeline: makeFakeDeps().runPipeline, renderReport: makeFakeDeps().renderReport, buildBundle: makeFakeDeps().buildBundle, writers } as CliDependencies & { writers: ReturnType<typeof makeWriters> };
    }},
  ];

  describe.each(errorStages)('stage: $name', ({ makeDeps }) => {
    it('does not leak raw error message "LEAK_TEST" to stderr', async () => {
      const deps = makeDeps();
      const argv = deps.writers ? ['--save'] : [];
      await runCli(argv.length ? argv : [], deps);
      const stderr = (deps as any).writers.stderrCalls.join('');
      expect(stderr).not.toContain('LEAK_TEST');
    });
  });

  describe('no network (fetch spy)', () => {
    const scenarios = [
      { name: 'help', argv: ['--help'] },
      { name: 'demo success', argv: [] },
      { name: 'save success', argv: ['--save'] },
      { name: 'pipeline failure', argv: [], pipelineOverride: async () => { throw new Error('fail'); } },
    ];

    for (const scenario of scenarios) {
      it(`no fetch calls during: ${scenario.name}`, async () => {
        const originalFetch = globalThis.fetch;
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy as any;
        try {
          const deps = scenario.pipelineOverride
            ? makeFakeDeps({ runPipeline: scenario.pipelineOverride as any })
            : makeFakeDeps();
          await runCli(scenario.argv, deps);
          expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    }
  });
});

// --- 8.4 Property tests for exit code and output isolation ---

describe('8.4 Property: exit code and output isolation', () => {
  const cases = [
    {
      name: 'success to stdout',
      argv: [] as string[],
      expectedCode: 0,
      expectStdout: true,
      expectStderr: false,
      expectFile: false,
    },
    {
      name: 'success to --save',
      argv: ['--save'],
      expectedCode: 0,
      expectStdout: false,
      expectStderr: true, // confirmation
      expectFile: true,
    },
    {
      name: 'success to --out',
      argv: ['--out', './custom.md'],
      expectedCode: 0,
      expectStdout: false,
      expectStderr: true, // confirmation
      expectFile: true,
    },
    {
      name: 'help',
      argv: ['--help'],
      expectedCode: 0,
      expectStdout: true, // usage
      expectStderr: false,
      expectFile: false,
    },
    {
      name: 'invalid args',
      argv: ['--bad'],
      expectedCode: 1,
      expectStdout: false,
      expectStderr: true,
      expectFile: false,
    },
    {
      name: 'unsupported type',
      argv: ['--file', './x.txt'],
      expectedCode: 1,
      expectStdout: false,
      expectStderr: true,
      expectFile: false,
    },
  ];

  describe.each(cases)('$name', ({ argv, expectedCode, expectStdout, expectStderr, expectFile }) => {
    it(`exit code is ${expectedCode}`, async () => {
      const deps = makeFakeDeps();
      const code = await runCli(argv, deps);
      expect(code).toBe(expectedCode);
    });

    it(`stdout ${expectStdout ? 'has content' : 'is empty'}`, async () => {
      const deps = makeFakeDeps();
      await runCli(argv, deps);
      if (expectStdout) {
        expect(deps.writers.stdoutCalls.length).toBeGreaterThan(0);
      } else {
        expect(deps.writers.stdoutCalls).toHaveLength(0);
      }
    });

    it(`stderr ${expectStderr ? 'has content' : 'is empty'}`, async () => {
      const deps = makeFakeDeps();
      await runCli(argv, deps);
      if (expectStderr) {
        expect(deps.writers.stderrCalls.length).toBeGreaterThan(0);
      } else {
        expect(deps.writers.stderrCalls).toHaveLength(0);
      }
    });

    it(`files ${expectFile ? 'written' : 'not written'}`, async () => {
      const deps = makeFakeDeps();
      await runCli(argv, deps);
      if (expectFile) {
        expect(deps.writers.writtenFiles.length).toBeGreaterThan(0);
      } else {
        expect(deps.writers.writtenFiles).toHaveLength(0);
      }
    });
  });

  it('pipeline failure does not write report to stdout or file', async () => {
    const deps = makeFakeDeps({ runPipeline: async () => { throw new Error('fail'); } });
    await runCli([], deps);
    expect(deps.writers.stdoutCalls.join('')).not.toContain('# Safe Report');
    expect(deps.writers.writtenFiles).toHaveLength(0);
  });

  it('render failure does not write report to stdout or file', async () => {
    const deps = makeFakeDeps({ renderReport: () => { throw new Error('fail'); } });
    await runCli([], deps);
    expect(deps.writers.stdoutCalls.join('')).not.toContain('# Safe Report');
    expect(deps.writers.writtenFiles).toHaveLength(0);
  });
});

// --- 8.5 Process handler tests ---

describe('8.5 handleProcessFatalError', () => {
  it('writes exactly "An unexpected error occurred.\\n" to stderr', () => {
    const stderrCalls: string[] = [];
    const exitCalls: number[] = [];
    handleProcessFatalError(
      (t) => stderrCalls.push(t),
      (c) => exitCalls.push(c),
    );
    expect(stderrCalls.join('')).toBe('An unexpected error occurred.\n');
  });

  it('calls exit with code 1', () => {
    const exitCalls: number[] = [];
    handleProcessFatalError(
      () => {},
      (c) => exitCalls.push(c),
    );
    expect(exitCalls).toEqual([1]);
  });

  it('does not include raw error message or stack trace', () => {
    const stderrCalls: string[] = [];
    handleProcessFatalError(
      (t) => stderrCalls.push(t),
      () => {},
    );
    const output = stderrCalls.join('');
    expect(output).not.toContain('at ');
    expect(output).not.toContain('.ts:');
    expect(output).toBe('An unexpected error occurred.\n');
  });
});
