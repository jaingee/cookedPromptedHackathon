---
inclusion: always
description: Preferred current technical direction, local-first architecture, SQLite direction, JSONL/CSV import/export, future Supabase migration constraints, and how tech choices should evolve by roadmap phase.
---

# cookedPrompts Tech Steering

## Preferred V1 Stack

Use a TypeScript-first local web app architecture.

Preferred stack:

- TypeScript
- React
- Next.js unless there is a strong reason to choose Vite
- SQLite for local structured storage
- JSONL/CSV import and export
- Markdown export for generated user profile and workflow files

## Kiro Model Assumption

Do not assume GPT models are available in Kiro.

When referring to the coding/planning agent, use neutral language:

- Kiro agent
- AI model
- model provider
- selected Kiro model
- provider-neutral model catalogue

Do not hardcode any project behavior around one AI provider.

## Local-First Rule

The app must work without login, cloud sync, or an external database in V1.

V1 data should be stored locally. Any optional AI analysis must happen only after local redaction and only when explicitly configured later.

## Storage Direction

Use SQLite as the main local persistence layer.

The schema should be designed so that future Supabase/Postgres migration is possible without rewriting the product model.

Avoid browser-only storage as the primary architecture unless explicitly decided later.

## Import/Export

V1 must support provider-neutral prompt logs.

Required import formats:

- JSONL
- CSV

Exports should include:

- JSONL
- CSV where useful
- Markdown files for memory/profile/workflow outputs

## Future Supabase Migration

Do not implement Supabase in V1.

Design the data layer so that future Supabase migration can map local tables to cloud tables cleanly.

Future cloud features may include:

- User accounts
- Optional sync
- Multi-device access
- Team workspaces
- Aggregated analytics

## Roadmap-Based Tech Evolution

### V1

Local-first. SQLite. No auth. No cloud sync. No billing. No capture extensions.

### V2

Add optional Supabase sync, auth, user accounts, redaction-before-upload, and multi-device support.

### V3

Add browser extension, API wrapper/proxy, CLI logger, VS Code/Kiro extension, and provider integrations.

### V4/V5+

Add billing, payments, enterprise controls, and organization-level governance only after the core product proves usage and retention.

## Implementation Style

Prefer small, reviewable modules.

Avoid hardcoding vendor-specific model logic into core domain logic. Use vendor-neutral model capability classes first, then map to specific models through configuration.

## Testing Expectations

For each feature, include tests or validation for:

- Valid input
- Invalid input
- Empty input
- Sensitive data detection boundaries
- No accidental storage of full model answers
- Error messages that help users fix import issues
- Future migration safety where relevant

## Steering Update Rule

This file can and should be updated when the project enters V2 or V3. V1 tech constraints should remain strict until the V1 demo is working.
