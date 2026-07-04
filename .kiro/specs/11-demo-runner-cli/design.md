# Design Document

## Overview

11-demo-runner-cli is a thin terminal wrapper around the existing public APIs from 09-integration-demo-flow (`runIntegrationDemo`) and 10-demo-report-renderer (`renderDemoReport`, `renderReportMarkdown`).

It does not duplicate any scoring, safety, import, recommendation, rewrite/template, or report-rendering logic. The CLI adds only:

- Argument parsing from `process.argv`
- Input mode selection (demo vs. file)
- Pipeline invocation via public API
- Report rendering via public API
- Output routing (stdout or file)
- Error boundary with content-free error messages
- Process exit codes

## Components and Interfaces

### CLI Entry Module (`src/cli/demo-runner.ts`)

Single-file CLI entry point. Contains `main()` async function, error boundary registration, and process exit logic.

### Argument Parser

```typescript
function parseCliArgs(argv: string[]): CliOptions
```

Pure function. Accepts `process.argv.slice(2)`. Returns parsed options or throws a categorized error for invalid input.

### Input Builder

```typescript
function buildDemoInput(options: CliOptions): DemoInput
```

Maps `CliOptions` to the `DemoInput` type expected by `runIntegrationDemo`.

### Output Writer

```typescript
function writeOutput(
  markdown: string,
  options: CliOptions,
  writers?: { stdout: (s: string) => void; writeFile: (path: string, content: string) => void }
): string | undefined
```

Routes markdown to stdout or file. Returns the written file path if applicable. Handles collision-safe naming. Accepts injectable writers for testing.

### Error Boundary

```typescript
function mapToContentFreeError(error: unknown, stage: string): string
```

Maps any thrown error to one of the 7 content-free error categories. Never forwards raw `.message` content.

## Data Models

### CliOptions

```typescript
type CliMode = 'demo' | 'file';
type OutputMode = 'stdout' | 'file';

interface CliOptions {
  mode: CliMode;
  file_path?: string;
  source_type?: 'jsonl' | 'csv';
  output_mode: OutputMode;
  output_path?: string;
  include_prompt_text: boolean;
  help: boolean;
}
```

### Error Categories

```typescript
type CliErrorCategory =
  | 'invalid_args'
  | 'unsupported_source_type'
  | 'file_not_readable'
  | 'pipeline_failed'
  | 'report_generation_failed'
  | 'file_write_failed'
  | 'unexpected_error';
```

### Input/Output Mapping

| From | To |
|------|-----|
| `CliOptions { mode: 'demo' }` | `DemoInput { mode: 'demo' }` |
| `CliOptions { mode: 'file', file_path, source_type }` | `DemoInput { mode: 'file', file_path, source_type }` |
| `UnifiedDemoOutput` | `renderDemoReport(output, { include_markdown: true })` → `DemoReport` |
| `DemoReport.markdown` | stdout string or file content |

## Architecture

### Components

1. **CLI entry module** — `src/cli/demo-runner.ts` — top-level async main with error boundary
2. **Argument parser** — `parseCliArgs(argv)` — manual `process.argv` parsing, returns `CliOptions`
3. **Input builder** — `buildDemoInput(options)` — maps `CliOptions` to `DemoInput`
4. **Pipeline runner** — calls `runIntegrationDemo(input)`
5. **Report renderer adapter** — calls `renderDemoReport(output, renderOptions)`
6. **Output writer** — routes markdown to stdout or file with collision-safe naming
7. **Error boundary** — catches all errors, maps to content-free categories, writes to stderr

### Flow Diagram

```
process.argv
  → parseCliArgs(argv)
  → if help: printUsage() → exit 0
  → buildDemoInput(options)
  → runIntegrationDemo(input)
  → renderDemoReport(output, { include_markdown: true })
  → report.markdown
  → writeOutput(markdown, options)
      → stdout (default)
      → file (if --out or --save)
  → exit 0

On error at any stage:
  → mapToContentFreeError(error, stage)
  → process.stderr.write(message)
  → exit 1
```

## Execution Strategy

### Option A — TypeScript source executed by a runner (tsx / ts-node)

- **Status**: Not currently available. Neither `tsx` nor `ts-node` exist in package.json.
- **Implication**: Would require adding a new devDependency.
- **Requirements position**: "Avoid adding new runtime or CLI-framework dependencies unless explicitly approved."
- **Verdict**: Deferred. Viable but not approved for V1. May be reconsidered in V2 if developer iteration speed becomes a concern.

### Option B — Compile dedicated CLI to JavaScript with tsc

- **Status**: Current `tsconfig.json` has `"noEmit": true`. No `dist/` or `build/` output exists.
- **Implication**: Would require either:
  - A separate `tsconfig.cli.json` with `"noEmit": false` and `"outDir": "./dist"`, or
  - Changing the main tsconfig (not recommended — breaks existing typecheck-only workflow).
- **Script**: `"demo": "tsc -p tsconfig.cli.json && node dist/cli/demo-runner.js"`
- **Verdict**: **Selected for V1.** No new dependencies. Adds build complexity but preserves no-new-packages discipline. Acceptable trade-off for a CLI that runs infrequently.

### Option C — JavaScript wrapper calling compiled output

- **Status**: No compiled output exists. Same problem as Option B — requires a build step first.
- **Verdict**: Strictly worse than Option B (extra indirection with no benefit). Not recommended.

### Design Recommendation

**V1 will use Option B: dedicated CLI build via `tsconfig.cli.json`.**

This avoids adding any dependency. It preserves the no-new-packages discipline established in requirements.

The implementation pass will:
- Add `tsconfig.cli.json` with `"noEmit": false`, `"outDir": "./dist"`, including `src/cli/**` and its transitive imports.
- Add package scripts:
  - `"build:cli": "tsc -p tsconfig.cli.json"`
  - `"demo": "npm run build:cli && node dist/cli/demo-runner.js"`
  - `"demo:save": "npm run build:cli && node dist/cli/demo-runner.js --save"`
- Current `tsconfig.json` remains unchanged (typecheck-only with `noEmit: true`).
- Add `dist/` to `.gitignore`.

Option A (tsx) is deferred. It may be reconsidered in V2 if developer iteration speed becomes a concern, but V1 does not need it.

## Public CLI Behavior

### Default demo mode

```
npm run demo
```

- Runs built-in demo dataset (~20 synthetic prompts)
- Prints markdown report to stdout
- Exits 0 on success

### File mode

```
npm run demo -- --file ./prompts.jsonl
npm run demo -- --file ./prompts.csv
```

- Infers `source_type` from extension (case-insensitive)
- Unsupported extension → content-free error to stderr, exit 1
- File not found/readable → content-free error to stderr, exit 1
- No raw row content or prompt_text printed on failure

### File output

```
npm run demo -- --out ./report.md
npm run demo:save
```

- stdout is default unless `--out` or `--save` is provided
- `--save` writes to `./cooked-report.md`
- `--out <path>` writes to specified path
- If both provided, `--out` wins
- No silent overwrite — timestamp suffix if target exists
- Writes UTF-8 markdown only
- File confirmation path printed to stderr

### Help

```
npm run demo -- --help
```

- Prints usage summary to stdout
- Exits 0
- Does not run pipeline
- Does not mention unsupported features as if implemented

## Data Contracts

```typescript
type CliMode = 'demo' | 'file';

type OutputMode = 'stdout' | 'file';

interface CliOptions {
  mode: CliMode;
  file_path?: string;
  source_type?: 'jsonl' | 'csv';
  output_mode: OutputMode;
  output_path?: string;
  include_prompt_text: boolean;
  help: boolean;
}
```

### Mapping to DemoInput

| CliOptions field | DemoInput field |
|-----------------|----------------|
| `mode: 'demo'` | `{ mode: 'demo' }` |
| `mode: 'file'` + `file_path` + `source_type` | `{ mode: 'file', file_path, source_type }` |

### Mapping to RenderOptions

| CliOptions field | RenderOptions field |
|-----------------|---------------------|
| (always) | `{ include_markdown: true }` |
| `include_prompt_text` | Ignored — renderer always excludes in V1 |

## Argument Parsing Design

Manual `process.argv` parsing. No framework.

### Supported flags

| Flag | Type | Behavior |
|------|------|----------|
| `--file <path>` | value | Set file mode with given path |
| `--out <path>` | value | Write output to given file path |
| `--save` | boolean | Write output to `./cooked-report.md` |
| `--include-prompt-text` | boolean | Accepted, ignored (V1 privacy) |
| `--help`, `-h` | boolean | Print usage, exit 0 |

### Rules

- `--help` / `-h` takes priority: print usage and exit 0 regardless of other flags
- Unknown flag → content-free error + usage hint to stderr, exit 1
- `--file` or `--out` without following value → content-free error + usage hint, exit 1
- `--include-prompt-text` accepted silently (no error, no effect)
- No positional arguments in V1

### Parse algorithm

```
1. Slice process.argv from index 2
2. Iterate tokens:
   - if "--help" or "-h": set help = true
   - if "--file": consume next token as file_path, set mode = 'file'
   - if "--out": consume next token as output_path, set output_mode = 'file'
   - if "--save": set output_mode = 'file', output_path = './cooked-report.md'
   - if "--include-prompt-text": set include_prompt_text = true
   - else: unrecognized flag error
3. Return CliOptions
```

## Source Type Inference

```
extension = path.extname(file_path).toLowerCase()

if extension === '.jsonl' → source_type = 'jsonl'
if extension === '.csv'   → source_type = 'csv'
otherwise → content-free error, exit 1
```

- Case-insensitive comparison
- No file content inspection
- No MIME type detection

## Output Design

### Stdout

- Markdown report string only (from `report.markdown`)
- Trailing newline
- No progress, status, or diagnostic text
- Suppressed when `--out` or `--save` is active

### Stderr

- Content-free error messages on failure
- File-write confirmation (path only) on success
- Usage hint on invalid arguments

### File output

- UTF-8 encoded markdown only
- No intermediate pipeline JSON
- No debug dumps
- No prompt_text, banned fields, or secrets

### Collision-safe naming

```
If target path exists:
  base = filename without extension
  ext = file extension (or empty)
  timestamp = UTC format YYYYMMDD-HHmmss
  new_path = base + "-" + timestamp + ext

Example: cooked-report.md → cooked-report-20260705-013000.md
Example: report → report-20260705-013000
```

## Error Handling

### Content-free error categories

| Category | stderr message |
|----------|---------------|
| `invalid_args` | "Invalid arguments. Run with --help for usage." |
| `unsupported_source_type` | "Unsupported file type. Only .jsonl and .csv are supported." |
| `file_not_readable` | "File not readable." |
| `pipeline_failed` | "Pipeline execution failed." |
| `report_generation_failed` | "Report generation failed." |
| `file_write_failed` | "File write failed." |
| `unexpected_error` | "An unexpected error occurred." |

### Error boundary design

```typescript
async function main(): Promise<void> {
  // ... CLI logic
}

process.on('uncaughtException', () => {
  process.stderr.write('An unexpected error occurred.\n');
  process.exit(1);
});

process.on('unhandledRejection', () => {
  process.stderr.write('An unexpected error occurred.\n');
  process.exit(1);
});

main().catch(() => {
  process.stderr.write('An unexpected error occurred.\n');
  process.exit(1);
});
```

### Never print

- Stack traces
- Raw exception `.message` (may contain file paths, prompt content)
- prompt_text
- Row content from imported files
- Matched secrets
- Safety warning messages
- File contents on read errors

## Correctness Properties

### Property 1: Determinism

Given the same input arguments and demo dataset, the CLI produces identical stdout output across runs (with injectable `now` for timestamps).

### Property 2: Privacy preservation

The CLI output (stdout, stderr, files) never contains prompt_text, banned fields, matched secrets, safety warning messages, template_body, or stack traces.

### Property 3: Exit code correctness

Exit 0 if and only if the pipeline completes and output is written successfully. Exit 1 for any error.

### Property 4: No overwrite

File output never overwrites an existing file — collision-safe naming is always applied when target exists.

### Property 5: Help purity

`--help` never triggers pipeline execution, regardless of other flags present.

### Property 6: Output isolation

When `--out` or `--save` is active, stdout receives no report content. When neither is active, no file is written.

### Property 7: No network

Zero network requests during any CLI execution path (testable via fetch spy).

## Privacy Design

Privacy is mostly inherited from the 09-integration-demo-flow and 10-demo-report-renderer modules, which already enforce:

- No prompt_text in report output (V1 rule)
- No banned full-answer fields
- No matched secret substrings
- No safety warning messages in report sections
- No template_body in output
- Deterministic, local-only processing

The CLI must additionally ensure:

- **stderr** never contains prompt text, secrets, or sensitive content
- **File paths** in confirmation messages do not inadvertently reveal sensitive directory names (use relative paths)
- **Error messages** are mapped to fixed content-free strings, never forwarding raw exception messages
- `--include-prompt-text` is accepted but the renderer ignores it (V1 privacy default)
- No network calls, telemetry, or provider API invocations

## Testing Strategy

### Unit tests (pure functions, no process exit)

| Test area | What to verify |
|-----------|----------------|
| `parseCliArgs` default | Returns demo mode, stdout output |
| `parseCliArgs` file mode | Infers jsonl/csv from extension |
| `parseCliArgs` unsupported ext | Throws/returns error for `.txt` |
| `parseCliArgs` missing values | Error for `--file` without path |
| `parseCliArgs` unknown flags | Error for `--verbose` |
| `parseCliArgs` help | Returns help: true |
| `buildDemoInput` | Maps CliOptions to DemoInput correctly |
| Output writer stdout | Writes markdown to injected writer |
| Output writer file | Writes UTF-8 to injected fs writer |
| Collision-safe naming | Generates timestamp suffix correctly |
| Error mapping | Maps Error instances to content-free categories |

### Integration tests (CLI runner function with injected I/O)

| Test area | What to verify |
|-----------|----------------|
| Full demo run | Stdout contains markdown title, 8 sections |
| No extra status text | Stdout has only markdown |
| Privacy sentinels | No prompt_text, banned fields, secrets in output |
| Pipeline failure | Content-free error to stderr, no stack trace |
| Render failure | Content-free error to stderr |
| File write | Creates file with markdown content |
| No overwrite | Existing file → timestamped filename |
| No network | fetch spy confirms 0 calls |

### Execution test approach

- Factor all CLI logic into pure/testable functions
- Inject `stdout` writer (e.g., a string accumulator) for unit tests
- Inject `fs.writeFileSync` equivalent for file output tests
- Use `vi.spyOn(process, 'exit')` for exit code verification
- Minimal child-process integration test only if execution strategy is confirmed

## Security and Privacy Considerations

- Local filesystem only
- No network calls
- No telemetry
- No provider calls
- No auth/login/billing
- Input files are read-only (never written back)
- Output file writes only on explicit `--out` / `--save` flag
- No stack traces in any output
- Content-free errors only
- Relative paths in confirmation messages

## Non-goals

- PDF/DOCX export
- Full export workflow
- Web application
- Dashboard UI
- Browser extension
- VS Code/Kiro extension
- Cloud sync
- Auth/login/billing
- Telemetry
- Provider API calls
- LLM-generated narrative
- Interactive TUI / rich terminal formatting
- Config files
- Scheduled runs / cron
- Folder watching
- Team/multi-user mode
- Streaming output

## Resolved Design Decisions

1. **Execution strategy**: V1 uses Option B — dedicated CLI build via `tsconfig.cli.json`. No new dependencies. Current `tsconfig.json` unchanged. Implementation adds `tsconfig.cli.json`, `build:cli` script, and `dist/` output.
2. **Default save path**: `./cooked-report.md` in V1. Simpler, no extra directory creation, collision-safe timestamp suffix handles existing files.
3. **File confirmation path**: Relative path in stderr confirmation. Safer for privacy, avoids exposing full local directory structure.
4. **Invalid file path error**: Generic "File not readable." only. Do not echo the path — it may contain sensitive folder names. Keeps errors content-free.
5. **`--save` in V1**: Included. Low complexity, useful for the demo story, same file-write safety rules as `--out`.

## Design Recommendation

Design is ready for task planning. No blockers remain.

Implementation plan:

1. **Task 0**: Create CLI build strategy — add `tsconfig.cli.json`, `build:cli` script, `dist/` gitignore entry. No new dependencies.
2. **Task 1–N**: Implement CLI logic (arg parser, runner, output writer, error boundary, tests).
3. Keep all CLI logic in `src/cli/demo-runner.ts` as a single module.
4. Include `--save` in V1 (low complexity, useful for the demo story).
5. Use `./cooked-report.md` as default save path.
6. Use relative paths in file confirmation messages.
7. Use generic error messages without echoing file paths.

The CLI is intentionally boring. It adds no analysis logic, no new abstractions, and no architectural novelty. It packages existing work for terminal use.
