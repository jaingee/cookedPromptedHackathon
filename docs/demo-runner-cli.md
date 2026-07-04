# Demo Runner CLI

## Purpose

The Demo Runner CLI runs the local-first cookedPrompts demo pipeline and renders the "20 Prompts Later: Your AI Habits Exposed" markdown coaching report.

- Local-only — no cloud, no sync, no external services
- Deterministic — same input produces same output
- No provider API calls
- No telemetry
- No raw prompt text in V1 report output

## Commands

```bash
# Run demo dataset and print report to stdout
npm run demo

# Run demo dataset and save report to ./cooked-report.md
npm run demo:save

# Show help
npm run demo -- --help

# Run against your own JSONL file
npm run demo -- --file ./path/to/prompts.jsonl

# Run against your own CSV file
npm run demo -- --file ./path/to/prompts.csv

# Save report to custom path
npm run demo -- --out ./custom-report.md

# Combine file input and custom output
npm run demo -- --file ./prompts.jsonl --out ./report.md

# Build CLI without running (used internally by demo scripts)
npm run build:cli
```

## Flags

| Flag | Type | Description |
|------|------|-------------|
| `--file <path>` | value | Run pipeline against a JSONL or CSV file |
| `--out <path>` | value | Save markdown report to specified file |
| `--save` | boolean | Save markdown report to `./cooked-report.md` |
| `--include-prompt-text` | boolean | Accepted (no effect in V1) |
| `--help`, `-h` | boolean | Show usage and exit |

Notes:
- `--include-prompt-text` is accepted but ignored in V1 (privacy-first).
- `--out` wins over `--save` if both provided.
- Supported file types: `.jsonl` and `.csv` only.
- `--help` exits before running the pipeline, regardless of other flags.

## Output Behavior

- **stdout mode** (default): Prints markdown report only. No status text, no progress indicators.
- **file mode** (`--out` or `--save`): Writes markdown file and prints confirmation path to stderr. Report markdown is NOT printed to stdout in file mode.
- **Collision-safe naming**: If target file exists, CLI creates a timestamped filename (format: `-YYYYMMDD-HHmmss` before extension).
- **No directory creation**: Target directory must exist and be writable.

## Error Behavior

All errors are content-free. Fixed messages:

| Error | Message |
|-------|---------|
| Invalid arguments | `Invalid arguments. Run with --help for usage.` |
| Unsupported file type | `Unsupported file type. Only .jsonl and .csv are supported.` |
| File not readable | `File not readable.` |
| Pipeline failure | `Pipeline execution failed.` |
| Report generation failure | `Report generation failed.` |
| File write failure | `File write failed.` |
| Unexpected error | `An unexpected error occurred.` |

- No stack traces in any output.
- No raw file paths in error messages.
- No raw pipeline/renderer/writer exception messages forwarded.
- Exit code 0 on success, exit code 1 on any error.

## Privacy Guarantees

CLI output (stdout, stderr, written files) never contains:

- `prompt_text`
- `assistant_message`
- `response`
- `completion`
- `model_answer`
- `output_text`
- `generated_text`
- `template_body`
- Matched secret substrings
- Raw safety warning text
- Raw row content
- Raw file content
- Raw stack traces

The CLI does not inspect or sanitize report markdown itself — it relies on the existing local report renderer. Tests verify the CLI boundary does not leak sensitive data from pipeline output or error messages.

## Verification

```bash
npm run typecheck
npm run build:cli
npm test
npm run demo
npm run demo -- --help
npm run demo:save
git diff --check
```

Generated report files (`cooked-report.md`, `cooked-report-*.md`) should be deleted after verification if not intentionally kept.

## Non-goals

- PDF/DOCX export
- Browser extension
- Cloud sync
- Auth/login/billing
- External AI judge / LLM narrative
- Provider API calls
- Telemetry
- Interactive TUI
- Config files
- Scheduled runs
- Team/multi-user mode
