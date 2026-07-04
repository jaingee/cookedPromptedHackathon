# Implementation Plan: Demo Runner CLI

## Overview

Implement a thin CLI wrapper (`src/cli/demo-runner.ts`) around the existing `runIntegrationDemo` and `renderDemoReport` public APIs. The CLI is built via a dedicated `tsconfig.cli.json` (Option B), adds no new dependencies, and routes markdown output to stdout or file with content-free error handling and full privacy compliance.

## Tasks

- [x] 1. Build and script foundation
  - [x] 1.1 Create `tsconfig.cli.json` and CLI scaffold
    - Create `tsconfig.cli.json` with `noEmit: false`, `outDir: "./dist"`, targeting ES2022, ESNext modules, including `src/cli/**/*.ts` and transitive source deps (`src/**/*.ts`)
    - Add `dist/` entry to `.gitignore`
    - Add package.json scripts: `"build:cli": "tsc -p tsconfig.cli.json"`, `"demo": "npm run build:cli && node dist/cli/demo-runner.js"`, `"demo:save": "npm run build:cli && node dist/cli/demo-runner.js --save"`
    - Create minimal `src/cli/demo-runner.ts` scaffold (empty main function, process event handlers, `main().catch()` pattern)
    - Verify: `npm run typecheck`, `npm run build:cli`, `npm test` all pass
    - Guardrail: no new dependencies added, main `tsconfig.json` unchanged
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 7.1, 7.2_

- [x] 2. CLI core pure functions
  - [x] 2.1 Implement `parseCliArgs` argument parser
    - Implement manual `process.argv.slice(2)` parser in `src/cli/demo-runner.ts`
    - Support `--file <path>`, `--out <path>`, `--save`, `--include-prompt-text`, `--help`/`-h`
    - Return `CliOptions` interface; throw categorized error for unknown flags or missing values
    - `--help`/`-h` takes priority over all other flags
    - _Requirements: 7.1, 7.3, 7.4, 12.1, 12.2, 12.3_

  - [x] 2.2 Implement `inferSourceType` and `buildDemoInput`
    - `inferSourceType(filePath)`: case-insensitive extension check, returns `'jsonl'` | `'csv'` or throws content-free error
    - `buildDemoInput(options)`: maps `CliOptions` to `DemoInput` type for `runIntegrationDemo`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 1.1_

  - [x] 2.3 Implement `formatUsage` help text
    - Return usage summary string listing all flags with descriptions
    - Include `--file`, `--out`, `--save`, `--include-prompt-text`, `--help` each on its own line
    - _Requirements: 12.1, 12.3_

  - [x] 2.4 Implement error types and `mapToContentFreeError`
    - Define `CliErrorCategory` type with 7 categories
    - Implement `mapToContentFreeError(error, stage)` mapping to fixed stderr messages
    - Never forward raw `.message` content, stack traces, or sensitive data
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 6.3, 6.4, 6.5_

  - [x] 2.5 Write unit tests for all pure CLI functions
    - Test `parseCliArgs`: default mode, file mode, help flag, unknown flags, missing values
    - Test `inferSourceType`: `.jsonl`, `.csv`, `.JSONL`, `.CSV`, `.txt` (error)
    - Test `buildDemoInput`: demo mode mapping, file mode mapping
    - Test `formatUsage`: contains all flag descriptions
    - Test `mapToContentFreeError`: all 7 categories produce correct fixed messages
    - _Requirements: 7.3, 7.4, 2.2, 2.3, 2.4, 6.3, 12.1_

- [x] 3. Checkpoint
  - Stop here for review. Do not continue to the next wave until verification passes and the user confirms or separately prompts the next wave.
  - Verification: `npm run typecheck`, `npm run build:cli`, `npm test`, `git diff --check`

- [x] 4. Output writer and file safety
  - [x] 4.1 Implement stdout writer
    - Write markdown string to injected stdout writer (default `process.stdout.write`)
    - Append trailing newline if not present
    - No diagnostic messages, progress indicators, or wrapper text
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 4.2 Implement file writer with collision-safe naming
    - Write UTF-8 markdown to specified path via injected `writeFile` function
    - If target exists, generate timestamp suffix: `-YYYYMMDD-HHmmss` before extension
    - Handle files with no extension (append timestamp to end)
    - Validate target directory exists and is writable; throw categorized error if not
    - Print relative output path confirmation to stderr
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.3 Implement output routing logic
    - `--out <path>` → file writer with given path
    - `--save` → file writer with `./cooked-report.md`
    - Both provided → `--out` wins
    - Neither → stdout writer
    - When file mode active, suppress stdout report output
    - _Requirements: 3.4, 4.1, 4.2, 4.3_

  - [x] 4.4 Write unit tests for output writer
    - Test stdout writer: correct content, trailing newline
    - Test file writer: creates file, UTF-8 content
    - Test collision-safe naming: existing file gets timestamp suffix
    - Test no-extension collision: timestamp appended to end
    - Test target directory validation: error on non-existent directory
    - Test output routing: --out vs --save vs neither vs both
    - Test stderr confirmation: relative path printed
    - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.4, 4.5, 4.7, 11.1, 11.2_

- [x] 5. Checkpoint
  - Stop here for review. Do not continue to the next wave until verification passes and the user confirms or separately prompts the next wave.
  - Verification: `npm run typecheck`, `npm run build:cli`, `npm test`, `git diff --check`

- [x] 6. Pipeline and renderer integration
  - [x] 6.1 Wire `main()` function end-to-end
    - Implement full flow: `parseCliArgs` → help check → `buildDemoInput` → `runIntegrationDemo` → `renderDemoReport` → `writeOutput`
    - Pass `{ include_markdown: true }` to `renderDemoReport`
    - Demo mode: no `--file` flag, calls with `{ mode: 'demo' }`
    - File mode: `--file` flag, calls with `{ mode: 'file', file_path, source_type }`
    - `--include-prompt-text` accepted but ignored (V1 privacy default)
    - Exit 0 on success, exit 1 on any error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 5.6, 5.7, 6.1, 6.2_

  - [x] 6.2 Implement error boundary and process handlers
    - Register `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers
    - Both write "An unexpected error occurred.\n" to stderr and exit 1
    - `main().catch()` fallback with same behavior
    - Wrap pipeline call in try/catch: map errors to content-free categories per stage
    - _Requirements: 9.4, 9.1, 9.2, 9.3, 6.2, 6.4_

  - [x] 6.3 Write integration tests for pipeline flow
    - Test full demo run: stdout contains markdown report with expected sections
    - Test no extra status text in stdout (markdown only)
    - Test file mode with valid `.jsonl` fixture
    - Test `--save` writes file with markdown content
    - Test pipeline error: content-free error to stderr, exit 1, no stack trace
    - Test render error: content-free error to stderr, exit 1
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 3.2, 4.2, 6.1, 6.2, 9.1, 9.2_

- [x] 7. Checkpoint
  - Stop here for review. Do not continue to the next wave until verification passes and the user confirms or separately prompts the next wave.
  - Verification: `npm run typecheck`, `npm run build:cli`, `npm test`, `npm run demo`, `npm run demo:save`, `git diff --check`

- [x] 8. Privacy, error, and process-boundary hardening
  - [x] 8.1 Implement privacy sentinel tests
    - Verify no `prompt_text` in stdout, stderr, or written files across demo and file modes
    - Verify no Banned_Output_Fields in any output: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`
    - Verify no matched secret substrings in output
    - Verify no `template_body` in output
    - Verify no safety warning raw text in output
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Implement error hardening tests
    - Verify no stack traces in stdout or stderr under any error condition
    - Verify `--help` exits 0 before pipeline runs (spy on `runIntegrationDemo`)
    - Verify invalid args error: unrecognized flag → exit 1 + usage hint
    - Verify file not readable error: generic "File not readable." message, no path echo
    - Verify unsupported extension error: `.txt` file → content-free error
    - _Requirements: 6.4, 6.5, 6.6, 12.2, 5.1, 9.5_

  - [x] 8.3 Write property tests for privacy and network isolation
    - **Property 2: Privacy preservation** — CLI output (stdout, stderr, files) never contains prompt_text, banned fields, matched secrets, safety warning messages, template_body, or stack traces
    - **Property 7: No network** — Zero network requests during any CLI execution path (fetch spy confirms 0 calls)
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3**

  - [x] 8.4 Write property tests for exit code and output isolation
    - **Property 3: Exit code correctness** — Exit 0 iff pipeline completes and output written successfully; exit 1 for any error
    - **Property 5: Help purity** — `--help` never triggers pipeline execution regardless of other flags
    - **Property 6: Output isolation** — When `--out`/`--save` active, stdout has no report content; when neither active, no file written
    - **Validates: Requirements 6.1, 6.2, 12.2, 3.4, 4.1**

  - [x] 8.5 Implement `uncaughtException`/`unhandledRejection` handler tests
    - Verify handlers are registered
    - Verify handlers write "An unexpected error occurred.\n" to stderr
    - Verify handlers call `process.exit(1)`
    - _Requirements: 9.4_

- [x] 9. Checkpoint
  - Stop here for review. Do not continue to the next wave until verification passes and the user confirms or separately prompts the next wave.
  - Verification: `npm run typecheck`, `npm run build:cli`, `npm test`, `npm run demo`, `npm run demo -- --help`, `npm run demo:save`, `git diff --check`

- [x] 10. Documentation and closeout
  - [x] 10.1 Create `docs/demo-runner-cli.md`
    - Document CLI usage, all flags, examples for demo mode, file mode, `--save`, `--out`, `--help`
    - Document error behavior and exit codes
    - Document privacy guarantees
    - _Requirements: 12.1, 12.3_

  - [x] 10.2 Update `HANDOFF.md` and `CHANGELOG.md`
    - Update HANDOFF.md: mark 11-demo-runner-cli status as Complete
    - Update CHANGELOG.md: add entry for demo runner CLI implementation
    - _Requirements: 10.5_

- [x] 11. Final checkpoint
  - Stop here for review. Do not continue to the next wave until verification passes and the user confirms or separately prompts the next wave.
  - Verification: `npm run typecheck`, `npm run build:cli`, `npm test`, `npm run demo`, `npm run demo -- --help`, `npm run demo:save`, `git diff --check`

## Notes

- Do not use Run All Tasks for this spec. Implement one wave at a time. Wave 0 must complete and be reviewed before Wave 1 starts.
- All test tasks are required for V1 because the CLI touches stdout, stderr, file output, process exits, and privacy boundaries.
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation — do not skip them
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All CLI logic lives in `src/cli/demo-runner.ts` as a single module
- No new dependencies are added — uses existing `tsc`, `vitest`, and `node`
- Main `tsconfig.json` remains unchanged (`noEmit: true`)
- Privacy guardrails (no prompt_text, no banned fields, no secrets, no stack traces) apply across ALL waves

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "6.1", "6.2"] },
    { "id": 4, "tasks": ["6.3", "8.1", "8.2", "8.5"] },
    { "id": 5, "tasks": ["8.3", "8.4", "10.1", "10.2"] }
  ]
}
```
