# Requirements Document

## Introduction

The Demo Runner CLI wraps the existing `runIntegrationDemo()` and `renderDemoReport()` public APIs into a terminal-runnable Node.js script. It enables users to run the "20 Prompts Later: Your AI Habits Exposed" coaching demo locally and receive a deterministic markdown report via stdout or file output.

This is a packaging-only module. It delegates all scoring, safety, model recommendation, rewrite/template, and report-rendering logic to existing engines. The CLI adds argument parsing, output routing, error presentation, and process exit behavior.

## Glossary

- **CLI**: The command-line interface script that serves as the terminal entry point for the demo pipeline
- **Demo_Pipeline**: The orchestration pipeline exposed by `runIntegrationDemo()` that processes prompt logs through all V1 engines
- **Report_Renderer**: The pure function `renderDemoReport()` that converts pipeline output into a structured coaching report
- **Markdown_Renderer**: The pure function `renderReportMarkdown()` that serializes a report to deterministic markdown
- **Demo_Dataset**: The built-in synthetic dataset of approximately 20 prompt logs used for the default demo experience
- **Content_Free_Error**: An error message that contains only a generic description of the failure step without prompt text, secrets, stack traces, or sensitive data
- **Banned_Output_Fields**: Fields that must never appear in CLI output: assistant_message, response, completion, model_answer, output_text, generated_text, template_body, matched secret substrings, safety warning messages, and raw stack traces

## Requirements

### Requirement 1: Demo Mode Execution

**User Story:** As a developer, I want to run the built-in demo dataset through the coaching pipeline from my terminal, so that I can experience the "20 Prompts Later" demo without setup.

#### Acceptance Criteria

1. WHEN the CLI is invoked without a `--file` argument, THE CLI SHALL call `runIntegrationDemo` with `{ mode: 'demo' }` input
2. WHEN `runIntegrationDemo` returns a `UnifiedDemoOutput` without a top-level `error` field, THE CLI SHALL pass it to `renderDemoReport` with `{ include_markdown: true }` options and print the resulting `DemoReport.markdown` string to stdout
3. THE CLI SHALL use only the public APIs `runIntegrationDemo`, `renderDemoReport`, and `renderReportMarkdown` without reimplementing pipeline logic
4. IF `runIntegrationDemo` returns a `UnifiedDemoOutput` with a top-level `error` field set, THEN THE CLI SHALL print a Content_Free_Error to stderr and exit with code 1
5. WHEN the demo report is successfully printed to stdout, THE CLI SHALL exit with code 0

### Requirement 2: File Mode Execution

**User Story:** As a developer, I want to run the coaching pipeline against my own JSONL or CSV file, so that I can analyze my actual prompt logs.

#### Acceptance Criteria

1. WHEN the CLI is invoked with a `--file <path>` argument, THE CLI SHALL call `runIntegrationDemo` with `{ mode: 'file', file_path: <path>, source_type }` input
2. WHEN a file path ends in `.csv` (case-insensitive), THE CLI SHALL set `source_type` to `'csv'`
3. WHEN a file path ends in `.jsonl` (case-insensitive), THE CLI SHALL set `source_type` to `'jsonl'`
4. IF a file path does not end in `.csv` or `.jsonl` (case-insensitive), THEN THE CLI SHALL print a Content_Free_Error to stderr and exit with code 1
5. IF the file at the given path does not exist or is not readable, THEN THE CLI SHALL print a Content_Free_Error to stderr and exit with code 1

### Requirement 3: Stdout Output

**User Story:** As a developer, I want the markdown report printed to stdout by default, so that I can pipe it to other tools or read it directly in my terminal.

#### Acceptance Criteria

1. WHEN no `--out` flag and no `--save` flag is provided, THE CLI SHALL write the markdown report to process stdout
2. THE CLI SHALL write only the markdown string produced by `renderReportMarkdown` to stdout without additional formatting or wrapper text
3. THE CLI SHALL NOT write diagnostic messages, progress indicators, or status text to stdout
4. WHEN `--out` or `--save` is provided, THE CLI SHALL NOT write the markdown report to stdout (file output only)
5. THE CLI SHALL terminate stdout output with a trailing newline character

### Requirement 4: File Output

**User Story:** As a developer, I want to save the markdown report to a file, so that I can share it or reference it later.

#### Acceptance Criteria

1. WHEN the `--out <path>` flag is provided, THE CLI SHALL write the markdown report to the specified file path encoded as UTF-8
2. WHEN the `--save` flag is provided without `--out`, THE CLI SHALL write the markdown report to `./cooked-report.md` encoded as UTF-8
3. IF both `--out` and `--save` flags are provided, THEN THE CLI SHALL use the `--out` path and ignore the `--save` default
4. IF the target file already exists, THEN THE CLI SHALL append a timestamp suffix in the format `-YYYYMMDD-HHmmss` to the filename before the extension to avoid overwriting (e.g., `cooked-report-20260705-010000.md`)
5. IF the target directory does not exist or is not writable, THEN THE CLI SHALL print a Content_Free_Error to stderr and exit with code 1
6. THE CLI SHALL write only the markdown report content to the file without intermediate pipeline data or debug output
7. WHEN a file is written successfully, THE CLI SHALL print the output file path to stderr as a confirmation message

### Requirement 5: Report Privacy Compliance

**User Story:** As a developer, I want the CLI output to follow the same privacy rules as the renderer, so that my sensitive prompt data is never exposed in terminal output or saved files.

#### Acceptance Criteria

1. THE CLI SHALL NOT include `prompt_text` values in any output (stdout, stderr, or written files)
2. THE CLI SHALL NOT include any Banned_Output_Fields in any output (stdout, stderr, or written files)
3. THE CLI SHALL NOT include matched secret substrings (content that triggered safety scanner rules) in any output
4. THE CLI SHALL NOT include the raw text that triggered safety warnings in any output; value-free warning metadata (category, severity, count) is permitted
5. THE CLI SHALL NOT include `template_body` values in any output
6. THE CLI SHALL pass `include_prompt_text: false` (or omit it) to `renderDemoReport` to enforce the V1 privacy default
7. WHEN the `--include-prompt-text` flag is provided, THE CLI SHALL accept the flag without error but continue to exclude prompt text from all output (V1 behavior)

### Requirement 6: Exit Behavior

**User Story:** As a developer, I want clear exit codes from the CLI, so that I can use it reliably in scripts and automation.

#### Acceptance Criteria

1. WHEN the pipeline and report generation complete successfully, THE CLI SHALL exit with code 0
2. WHEN any error occurs during pipeline execution, report generation, or file writing, THE CLI SHALL exit with code 1
3. WHEN an error occurs, THE CLI SHALL write a Content_Free_Error message to stderr that describes only the failed step (e.g., "Pipeline execution failed.", "Report generation failed.", "File write failed.")
4. THE CLI SHALL NOT write stack traces to stderr or stdout under any circumstances
5. THE CLI SHALL NOT write prompt text, secrets, matched content, or sensitive data to stderr or stdout under any circumstances
6. IF the CLI receives invalid arguments (unrecognized flags or missing required values), THEN THE CLI SHALL exit with code 1 and print a usage hint to stderr

### Requirement 7: No External CLI Frameworks

**User Story:** As a maintainer, I want the CLI to avoid heavy dependencies, so that the project stays lean and the CLI remains a thin wrapper.

#### Acceptance Criteria

1. THE CLI SHALL parse arguments using native Node.js `process.argv` without importing CLI framework packages
2. THE CLI SHALL NOT list any third-party argument-parsing or CLI-framework package (including but not limited to commander, yargs, meow, oclif, clipanion, and cac) in `package.json` dependencies or devDependencies
3. THE CLI SHALL support `--file <path>` and `--out <path>` as value flags that each consume the next argv token as their argument, `--save` as a boolean flag, `--include-prompt-text` as a boolean flag, and `--help` / `-h` as a boolean flag, all parsed manually from `process.argv`
4. IF the CLI receives an unrecognized flag or a value flag without a following argument, THEN THE CLI SHALL exit with code 1 and print a usage hint to stderr

### Requirement 8: No Network Activity

**User Story:** As a privacy-conscious user, I want the CLI to work completely offline, so that my prompt data never leaves my machine.

#### Acceptance Criteria

1. THE CLI SHALL NOT make any network requests during execution
2. THE CLI SHALL NOT call any cloud service APIs, telemetry endpoints, or external provider APIs
3. THE CLI SHALL NOT import modules that initiate network connections as a side effect
4. THE CLI SHALL operate entirely on local data using the in-memory SQLite database provided by the pipeline

### Requirement 9: Error Handling and Safety

**User Story:** As a developer, I want errors to be handled safely, so that my sensitive data is never leaked through error messages.

#### Acceptance Criteria

1. IF `runIntegrationDemo` throws or rejects, THEN THE CLI SHALL write a Content_Free_Error to stderr and exit with code 1
2. IF `renderDemoReport` throws, THEN THE CLI SHALL write a Content_Free_Error to stderr and exit with code 1
3. IF file writing fails (e.g., permission denied, disk full), THEN THE CLI SHALL write a Content_Free_Error to stderr and exit with code 1
4. THE CLI SHALL register handlers for `process.on('uncaughtException')` and `process.on('unhandledRejection')` that write "An unexpected error occurred." to stderr and exit with code 1
5. Content_Free_Error messages SHALL NOT contain prompt text, file contents, secret values, matched patterns, or stack traces

### Requirement 10: Script Entry Point

**User Story:** As a developer, I want a simple npm script to run the demo, so that I do not need to remember complex commands.

#### Acceptance Criteria

1. THE CLI SHALL be runnable via `npm run demo` using a package script selected during the design phase
2. THE CLI SHALL be runnable via `npm run demo:save` using a package script selected during the design phase
3. THE CLI implementation strategy SHALL avoid adding new runtime or CLI-framework dependencies unless explicitly approved
4. THE design phase SHALL choose one execution strategy from existing project tooling, such as: compile TypeScript with existing `tsc` output and run Node on compiled JavaScript, use an existing test/build-compatible TypeScript execution approach if already available, or add a new runner dependency only if explicitly justified and approved
5. THE CLI SHALL preserve the same output and exit behavior regardless of the selected execution strategy

### Requirement 11: File Write Safety

**User Story:** As a developer, I want file writes to be safe and predictable, so that I do not accidentally overwrite important files.

#### Acceptance Criteria

1. WHEN writing to a file path that already exists, THE CLI SHALL generate a unique filename by appending a UTC timestamp in the format `-YYYYMMDD-HHmmss` immediately before the last file extension (e.g., `cooked-report.md` becomes `cooked-report-20260705-010000.md`)
2. IF the target file path has no extension, THEN THE CLI SHALL append the UTC timestamp suffix to the end of the filename
3. THE CLI SHALL write only UTF-8 encoded markdown content to the output file
4. THE CLI SHALL NOT write raw pipeline data, intermediate results, or debug output to any file
5. IF the target directory does not exist or is not writable, THEN THE CLI SHALL write a Content_Free_Error to stderr and exit with code 1

### Requirement 12: Help Flag

**User Story:** As a developer, I want a help flag so that I can quickly see available options without reading documentation.

#### Acceptance Criteria

1. WHEN the `--help` flag or `-h` short alias is provided, THE CLI SHALL print a usage summary to stdout listing each available flag followed by a description of its purpose
2. WHEN the `--help` flag or `-h` is provided alongside any other flags, THE CLI SHALL exit with code 0 and print the usage summary without running the pipeline
3. THE CLI SHALL include descriptions for `--file`, `--out`, `--save`, `--include-prompt-text`, and `--help` in the usage summary, with each flag appearing on its own line
