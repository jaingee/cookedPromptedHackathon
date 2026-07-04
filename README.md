# cookedPrompts

Roast the prompt. Coach the user. Improve the habit.

cookedPrompts is a local-first AI habit coach that audits prompt logs, exposes weak prompting patterns, flags privacy risks, recommends model capability classes, and turns recurring mistakes into better prompt habits.

## Elevator Pitch

Prompting is a habit, not a one-off trick. cookedPrompts helps people inspect their AI usage after the fact, find repeated issues, and turn those issues into better prompts, safer workflows, and reusable templates.

The V1 hackathon build is deterministic and local-first. It does not call external AI services, sync data to the cloud, or store full model answers.

## What It Does

- Imports provider-neutral prompt logs from JSONL or CSV.
- Stores normalized prompt metadata in local SQLite.
- Scores prompts across clarity, context, constraints, output format, capability fit, efficiency, and safety/privacy.
- Flags privacy and safety risks with value-free warnings.
- Recommends vendor-neutral model capability classes.
- Suggests rewrite guidance and reusable prompt templates.
- Produces local demo and markdown-style coaching reports.

## Why Local-First Matters

Prompt logs often contain sensitive context: source code, customer details, credentials, strategy, or personal data. cookedPrompts keeps V1 analysis local so users can learn from their own habits without uploading raw prompts or model answers.

V1 has no cloud sync, auth, telemetry, provider calls, or external AI judge.

## Demo Flow

1. Load the built-in synthetic demo dataset.
2. Normalize the prompt logs into a shared local schema.
3. Run scoring, safety scanning, model recommendation, and rewrite/template guidance.
4. Aggregate the batch into a coaching summary.
5. Render a report for "20 Prompts Later: Your AI Habits Exposed."

## Current Features

- Local JSONL/CSV importer and preview validation.
- Full-answer field stripping for banned model-answer fields.
- SQLite persistence for prompt logs and scores.
- Deterministic scoring engine with privacy-safe explanations.
- Safety scanner for secret-like, credential-like, personal-data, and risky-routing patterns.
- Vendor-neutral model recommendation classes and cost posture estimates.
- Rewrite and template coaching.
- Dashboard data service plus a minimal local CLI report surface.
- Demo report renderer with markdown output.

## Architecture Overview

- `src/importers/local/` parses and normalizes prompt logs.
- `src/storage/sqlite/` owns local SQLite migrations and repositories.
- `src/scoring/` computes deterministic prompt quality scores.
- `src/safety/` returns local, value-free safety warnings.
- `src/model-recommendation/` maps task signals to model capability classes.
- `src/rewrite-template/` produces rewrite guidance and reusable templates.
- `src/integration-demo/` orchestrates the demo pipeline.
- `src/demo-report/` renders the final coaching report without raw prompt text.

## Built With

- TypeScript
- Vitest
- SQLite via `better-sqlite3`
- Node.js local runtime

## How To Run

```powershell
npm install
npm run typecheck
npm test
```

## Test Commands

```powershell
npm run typecheck
npm test
git diff --check
```

## Privacy Guarantees

- No cloud sync in V1.
- No telemetry in V1.
- No external AI judge or provider call in V1.
- No full model answer storage.
- Banned full-answer fields are stripped or rejected at boundaries.
- Safety warnings do not return matched secret values.
- V1 demo reports never include raw `prompt_text`, even when `include_prompt_text` is accepted for future API compatibility.
- Demo data is synthetic and uses fake, non-actionable placeholders.

## Intentionally Out Of Scope For V1

- Login, auth, teams, billing, or subscriptions.
- Cloud sync or Supabase implementation.
- Browser, VS Code, Kiro, or API proxy capture extensions.
- Real-time prompt blocking.
- External LLM evaluation or hosted AI analysis.
- Full model answer storage.

## Roadmap

- V1: local-first prompt coaching pipeline, SQLite persistence, deterministic reports, synthetic demo dataset.
- V2: optional cloud sync and account features after explicit privacy design.
- V3: capture integrations such as browser extension, API wrapper, CLI logger, and editor extensions.
- Later: team analytics, policy controls, paid tiers, and enterprise features only after the core habit loop proves useful.
