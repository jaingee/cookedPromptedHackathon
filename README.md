# cookedPrompts

**Roast the prompt. Coach the user. Improve the habit.**

A local-first AI prompt coaching tool that reviews your past prompts, identifies weak patterns, teaches better model choice, detects privacy risks, and turns recurring mistakes into reusable templates.

V1 is a completed local-first demo pipeline for privacy-safe prompt habit coaching.

## At a glance

| Area | Summary |
|---|---|
| **Problem** | AI users often blame the model when the real issue is vague prompts, missing context, weak constraints, unsafe data sharing, or poor model choice. |
| **Approach** | Analyze prompt logs locally, score prompt habits, flag privacy risks, recommend model capability classes, and suggest reusable templates. |
| **Result** | A completed local-first V1 demo pipeline that generates the **"20 Prompts Later: Your AI Habits Exposed"** coaching report. |
| **Demo command** | `npm run demo` |
| **Privacy posture** | No cloud sync, no telemetry, no provider API calls, no external AI judge, no full model-answer storage. |
| **Kiro evidence** | `.kiro/steering/` and `.kiro/specs/` show the spec-driven build process. |

## The story

### Problem

People often blame the AI model when the real issue is their prompting habit: vague requests, missing context, weak constraints, unsafe sharing of sensitive data, or using an overpowered model for a simple task.

Prompt logs can also contain private code, credentials, work context, personal information, or internal notes, so analyzing them through a cloud-first workflow creates trust issues.

### Approach

cookedPrompts analyzes prompt logs locally after the fact. It imports JSONL/CSV prompt logs, strips full-answer fields, scores prompt quality, flags safety/privacy risks, recommends model capability classes, suggests rewrite templates, and renders a coaching report.

### Result

V1 is a completed local-first demo pipeline. A judge can run:

```bash
npm run demo
```

and see the full **"20 Prompts Later: Your AI Habits Exposed"** report generated from synthetic demo data.

## What cookedPrompts does

cookedPrompts turns prompt logs into a local coaching report.

It helps users answer:

- **What weak prompt habits do I repeat?**
- **Where am I wasting model capability, tokens, or time?**
- **Am I exposing sensitive information?**
- **Which model capability class would have fit better?**
- **What reusable template should I use next time?**

V1 includes:

- JSONL / CSV import
- prompt validation and normalization
- banned full-answer field stripping
- local SQLite storage
- scoring across seven prompt-quality dimensions
- local safety/privacy scanning
- local model capability recommendation
- rewrite/template coaching
- integration demo flow
- Markdown report rendering
- demo runner CLI

## Why V1 is local-first

Prompt logs can contain sensitive personal, technical, or company information, so V1 is intentionally local-first.

Before adding hosted features or integrations, cookedPrompts first proves the core coaching loop locally:

```text
import prompts -> analyze habits -> flag risks -> recommend model fit -> suggest templates -> render report
```

This keeps the hackathon demo focused, reviewable, and privacy-safe while preserving a clear path for future versions.

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

## How to judge this repo quickly

1. Read the short problem/approach/result story above.
2. Run the local demo:

```bash
npm install
npm run demo
```

3. Save the report if desired:

```bash
npm run demo:save
```

4. Inspect the implementation path:
   - `src/cli/demo-runner.ts`
   - `src/integration-demo/`
   - `src/demo-report/`
   - `src/safety/`
   - `src/model-recommendation/`
   - `src/rewrite-template/`
5. Inspect the Kiro spec evidence:
   - `.kiro/steering/`
   - `.kiro/specs/09-integration-demo-flow/`
   - `.kiro/specs/10-demo-report-renderer/`
   - `.kiro/specs/11-demo-runner-cli/`

## What judges can verify

| Claim | Where to verify |
|---|---|
| **Working local demo** | Run `npm run demo` |
| **Saved report output** | Run `npm run demo:save` |
| **CLI implementation** | `src/cli/demo-runner.ts` |
| **End-to-end pipeline** | `src/integration-demo/` |
| **Report renderer** | `src/demo-report/` |
| **Safety scanner** | `src/safety/` |
| **Model recommendation** | `src/model-recommendation/` |
| **Rewrite/template coaching** | `src/rewrite-template/` |
| **Spec-driven build evidence** | `.kiro/specs/` |
| **Steering and guardrails** | `.kiro/steering/` |
| **Privacy boundary** | `docs/security-and-privacy.md` |
| **Synthetic demo data notes** | `docs/demo-data.md` |

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

## Kiro usage and spec-driven build evidence

This project was built through a Kiro-style spec-driven workflow rather than a single ad-hoc coding pass.

Kiro artifacts visible in this repo:

| Kiro artifact | Where to inspect |
|---|---|
| Product steering | `.kiro/steering/product.md` |
| Privacy and safety steering | `.kiro/steering/privacy-and-safety.md` |
| Technical direction | `.kiro/steering/tech.md` |
| Feature requirements/design/tasks | `.kiro/specs/*/requirements.md`, `.kiro/specs/*/design.md`, `.kiro/specs/*/tasks.md` |
| Integration demo flow | `.kiro/specs/09-integration-demo-flow/` |
| Demo report renderer | `.kiro/specs/10-demo-report-renderer/` |
| Demo runner CLI | `.kiro/specs/11-demo-runner-cli/` |
| Reusable Kiro workflow skill | `.kiro/skills/rtk-token-efficient-cli/` |

Kiro was used for:

- steering and scope control
- requirements-first planning
- design documents before implementation
- task-wave breakdowns
- implementation planning
- privacy guardrail planning
- test planning
- review and cleanup passes
- verification and closeout discipline

I did not rely heavily on Kiro hooks or advanced automation features in this version. The main value came from using Kiro as a structured spec-driven development environment: keeping requirements, designs, tasks, implementation passes, and verification aligned as the project grew.

The shipped V1 follows the same pipeline described in the specs:

```text
import -> validate -> strip full answers -> normalize -> store -> score -> scan safety -> recommend model class -> suggest templates -> summarize -> render report -> run CLI
```

## Kiro usage note

This V1 was built with Kiro using **roughly 2,000 credits** during an exploratory, highly verified build process.

Most implementation passes used **Auto mode**, with **Opus 4.8** used for heavier reasoning/planning passes and occasional **GLM 5** / **MiniMax 2.5** use.

The credit usage could likely be optimized further. A more streamlined repeat build could probably fit closer to **around 1,000 credits** by:

- batching similar implementation waves
- reusing established architecture patterns
- reducing redundant planning loops
- avoiding repeated re-verification of stable modules
- keeping verification focused once the core architecture is stable

The higher credit usage was useful during exploration because the project was being shaped, tested, and privacy-hardened at the same time. For a repeat implementation, the same product could likely be built more efficiently.

## Demo video path

A short demo video can show the project in this order:

1. State the problem: prompt habits are hard to see, and prompt logs are sensitive.
2. Run `npm run demo`.
3. Show the generated "20 Prompts Later" report.
4. Point out the report sections:
   - prompt health
   - issue patterns
   - safety/privacy
   - model recommendations
   - rewrite/template coaching
   - next actions
5. Show `.kiro/specs/11-demo-runner-cli/` and `.kiro/specs/09-integration-demo-flow/` to demonstrate spec-to-code alignment.
6. End with the roadmap: V1 is local-first; future versions can add hosted features only after privacy boundaries are proven.

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
