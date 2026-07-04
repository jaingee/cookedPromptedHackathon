# cookedPrompts

**Roast the prompt. Coach the user. Improve the habit.**

A local-first AI prompt coaching tool that reviews your past prompts, identifies weak patterns, teaches better model choice, detects privacy risks, and turns recurring mistakes into reusable templates.

V1 is the completed local-first trust foundation for a future SaaS product.

## What cookedPrompts does

cookedPrompts analyzes imported prompt logs after the fact and produces a coaching report. It scores prompts across 7 dimensions, flags safety risks, recommends model classes, suggests rewrite templates, and packages everything into a markdown "20 Prompts Later: Your AI Habits Exposed" report.

No cloud. No login. No external AI judge. Just local rule-based analysis of your prompt habits.

## Why V1 is local-first

cookedPrompts is designed to become a SaaS product later, but V1 is intentionally local-first because prompt logs can contain sensitive personal, technical, or company information.

Before adding accounts, cloud sync, hosted dashboards, or integrations, the product first proves the core coaching loop locally:

```text
import prompts -> analyze habits -> flag risks -> recommend model fit -> suggest templates -> render report
```

This makes the future SaaS version safer because privacy, redaction, deterministic analysis, and no-full-answer retention are designed into the foundation instead of added later.

## V1 Product Walkthrough

The V1 pipeline processes prompt logs through these stages:

1. **Import prompts locally** — Parse JSONL or CSV prompt logs into a provider-neutral format.
2. **Validate and normalize** — Check required fields, reject malformed rows, normalize timestamps and tags.
3. **Strip full-answer fields** — Remove banned model-answer fields (V1 never stores full responses).
4. **Score prompt habits** — Rate each prompt 0–5 across clarity, context, constraints, output format, capability fit, efficiency, and safety/privacy.
5. **Run safety/redaction checks** — Detect API keys, secrets, PII, prompt injection risks, and other privacy concerns.
6. **Recommend model fit locally** — Suggest vendor-neutral capability classes (cheap_fast, coding, deep_reasoning, etc.) based on prompt characteristics.
7. **Suggest rewrite templates** — Map issue labels to coaching guidance and reusable template structures.
8. **Render coaching report** — Produce a deterministic markdown report with 8 sections: batch overview, prompt health, issue patterns, safety/privacy, model recommendations, rewrite coaching, next actions, and limitations.
9. **Run through CLI** — `npm run demo` executes the full pipeline and prints the report.

## Quick Start

```bash
# Clone and install
git clone https://github.com/jaingee/cookedPromptedHackathon.git
cd cookedPromptedHackathon
npm install

# Run the demo (uses built-in synthetic dataset)
npm run demo

# Save the report to a file
npm run demo:save

# See all options
npm run demo -- --help
```

## CLI Commands

```bash
# Run demo dataset, print report to stdout
npm run demo

# Run demo dataset, save to ./cooked-report.md
npm run demo:save

# Show help
npm run demo -- --help

# Analyze your own JSONL file
npm run demo -- --file ./my-prompts.jsonl

# Analyze your own CSV file
npm run demo -- --file ./my-prompts.csv

# Save report to custom path
npm run demo -- --out ./reports/analysis.md

# Combine file input and custom output
npm run demo -- --file ./prompts.jsonl --out ./report.md

# Build CLI (used internally by demo scripts)
npm run build:cli
```

### Flags

| Flag | Description |
|------|-------------|
| `--file <path>` | Run pipeline against a JSONL or CSV file |
| `--out <path>` | Save markdown report to specified file |
| `--save` | Save markdown report to `./cooked-report.md` |
| `--include-prompt-text` | Accepted (no effect in V1) |
| `--help`, `-h` | Show usage and exit |

## Example Workflow

```bash
# 1. Run the demo to see what a coaching report looks like
npm run demo

# 2. Export your own prompt logs as JSONL or CSV
#    (each row needs: id, timestamp, prompt_text, model_used)

# 3. Analyze your prompts
npm run demo -- --file ./my-exported-prompts.jsonl

# 4. Save the report for reference
npm run demo -- --file ./my-exported-prompts.jsonl --out ./my-report.md
```

## Privacy Guarantees

cookedPrompts V1 is strictly local-first:

- **No network calls** — the CLI never contacts external services
- **No telemetry** — no usage tracking, no analytics
- **No provider API calls** — no OpenAI/Anthropic/Google calls
- **No external AI judge** — all scoring is local and rule-based
- **No cloud sync** — data stays on your machine
- **No full model-answer retention** — V1 strips and rejects response fields
- **No raw prompt text in report output** — the rendered report uses aggregate data only
- **No login or auth** — runs without accounts

The report output never contains: `prompt_text`, `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`, or `template_body`.

## Public Repo Boundary

This public hackathon repository intentionally excludes two internal project-memory files:

- `HANDOFF.md`
- `CHANGELOG.md`

These files are used in the private working repo to track implementation state, planning history, verification notes, Kiro workflow context, detailed development handoffs, and session-by-session changelog entries.

They are excluded from this public repo because they may contain internal process notes, private project memory, overly detailed agent/session logs, or security-sensitive development context that is not necessary for judging the hackathon submission.

The visible public repo still includes the important project artifacts:

- source code
- tests
- public documentation
- `.kiro/specs/`
- `.kiro/steering/`
- `.kiro/skills/`
- privacy and demo-data notes

This keeps the submission reviewable while preserving a safer public boundary.

## Current V1 Status

| Module | Status |
|--------|--------|
| Local importer (JSONL/CSV) | Complete |
| SQLite data layer | Complete |
| Scoring engine (7 dimensions) | Complete |
| Score persistence | Complete |
| Dashboard data service | Complete |
| Safety/redaction scanner | Complete |
| Model recommendation | Complete |
| Rewrite/template system | Complete |
| Integration demo flow | Complete |
| Demo report renderer | Complete |
| Demo runner CLI | Complete |

42 test files. 841 tests passing.

## Non-goals / Deferred Features

V1 deliberately does not include:

- Browser extension or API proxy
- VS Code / Kiro extension
- Cloud sync or Supabase integration
- Login, auth, or user accounts
- Billing or payments
- PDF/DOCX export
- Interactive TUI or web dashboard
- Real-time prompt blocking
- LLM-generated narrative or AI-assisted scoring
- Telemetry or usage analytics
- Team/organization features

These may come in V2-V5. The public roadmap boundary is summarized here and in the visible `.kiro/specs/`, `.kiro/steering/`, and `docs/` artifacts.

## Developer Verification

```bash
npm run typecheck       # TypeScript check (no emit)
npm run build:cli       # Compile CLI to dist/
npm test                # Run all tests (vitest)
npm run demo            # Run demo pipeline
npm run demo -- --help  # Show CLI help
npm run demo:save       # Save report (delete generated file after)
git diff --check        # Check for whitespace issues
```

## Project Docs / Where to Read Next

| File | Purpose |
|------|---------|
| `README.md` | Public product overview and quick start |
| `PROJECT_WORKFLOW.md` | Public workflow overview for how the project was planned |
| `docs/importer.md` | Importer documentation |
| `docs/storage.md` | SQLite layer docs |
| `docs/scoring.md` | Scoring engine docs |
| `docs/scoring-persistence.md` | Score persistence docs |
| `docs/dashboard.md` | Dashboard service docs |
| `docs/safety.md` | Safety scanner docs |
| `docs/model-recommendation.md` | Model recommendation docs |
| `docs/rewrite-template.md` | Rewrite/template docs |
| `docs/integration-demo-flow.md` | Integration pipeline docs |
| `docs/demo-report-renderer.md` | Report renderer docs |
| `docs/demo-runner-cli.md` | CLI documentation |
| `docs/security-and-privacy.md` | Public privacy/security boundary |
| `docs/demo-data.md` | Synthetic demo dataset notes |
| `.kiro/steering/` | Persistent project guidance |
| `.kiro/specs/` | Feature specs: requirements -> design -> tasks |
