---
inclusion: always
description: Project organization, feature boundaries, module responsibilities, naming conventions, spec strategy, and where to place HANDOFF.md.
---

# cookedPrompts Structure Steering

## Project Structure Direction

Use a simple structure that separates domain logic, storage, importers, UI, and exports.

Root-level source-of-truth document:

- HANDOFF.md

Kiro guidance:

- `.kiro/steering/` for persistent project guidance
- `.kiro/specs/` for feature specs
- `.kiro/hooks/` later for automations
- `.kiro/skills/` later for reusable workflows

Suggested source folders:

- `src/app` or `src/pages`: app routes and page shells
- `src/components`: reusable UI components
- `src/features`: feature-level modules
- `src/domain`: core product logic and types
- `src/storage`: SQLite schema, migrations, and repositories
- `src/importers`: JSONL/CSV import parsing and validation
- `src/scoring`: prompt scoring logic
- `src/safety`: redaction and warning detection
- `src/recommendation`: vendor-neutral model recommendation logic
- `src/exports`: Markdown/JSON/CSV export generation
- `src/lib`: shared utilities
- `tests`: unit and integration tests
- `fixtures`: mock prompt logs and test datasets
- `docs`: product notes and implementation notes

## Feature Boundary Rule

Keep these responsibilities separate:

- Importer parses and validates logs.
- Storage persists validated data.
- Scoring evaluates prompt quality.
- Safety detects privacy and risk issues.
- Recommendation chooses model capability classes.
- UI displays results.
- Export generates user-facing files.

Do not mix importer, scoring, and SQLite persistence into one large module.

## Spec Strategy

Create specs one feature at a time.

Initial spec order:

- 01-local-importer
- 02-sqlite-data-layer
- 03-scoring-engine

Do not create all future specs at the start.

## First Spec Boundary

01-local-importer must not implement permanent storage deeply.

It should define:

- import format
- validation
- parsing
- redaction handoff
- preview behavior
- normalized internal shape

02-sqlite-data-layer owns persistence.

## Naming

Use clear, boring technical names in code.

Product copy can be playful, but code should be maintainable.

Good code/module names:

- promptLog
- promptScore
- safetyWarning
- modelRecommendation
- rewriteVariant
- template
- userMemoryProfile
- modelCatalogue
- importBatch

Avoid joke names in core code unless they are strictly UI labels.

## Review Rule

Before implementation, each spec should have reviewed requirements, design, and tasks.

Do not allow implementation before tasks are clear and scoped.

## Project Memory Files

- `HANDOFF.md` — current project state, roadmap, scope boundaries, open decisions, and future-pass queue.
- `CHANGELOG.md` — completed work history, including selected Kiro model and reasoning level for meaningful passes.
- `PROJECT_WORKFLOW.md` — workflow and read-order guide.
- `.kiro/specs/` — Kiro feature specs, one folder per feature with `requirements.md`, `design.md`, and `tasks.md`.
- `.kiro/steering/` — persistent project guidance.
- `.kiro/skills/` and `.kiro/hooks/` — future workflow tools, not required for V1 setup.

Do not create or reference a root-level `spec.md` for cookedPrompts.

## Handoff Rule

Update HANDOFF.md after completing meaningful implementation work or changing roadmap/scope.
