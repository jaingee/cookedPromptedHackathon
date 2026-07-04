# cookedPrompts Project Workflow

## Purpose

This document explains how future Kiro sessions should work on cookedPrompts without losing context, reopening settled decisions, or mixing planning with implementation.

---

## Project Memory Files

### `HANDOFF.md`

Current source-of-truth for product state, roadmap, scope boundaries, open decisions, risks, and durable future-pass queue.

Read this first at the start of every session. Update it after meaningful completed work or scope changes.

### `CHANGELOG.md`

Plain-language record of completed work only.

Must record the selected Kiro model and reasoning level used for meaningful passes.

Not a replacement for Git history. Do not record planned work as completed work.

### `PROJECT_WORKFLOW.md`

This file. Operating guide for future Kiro sessions. Explains read order, spec workflow, changelog discipline, handoff discipline, and task parallelism rules.

### `.kiro/steering/`

Persistent project guidance. These files load automatically or on reference and steer the Kiro agent across all sessions.

Always-loaded steering files:

- `product.md` — V1 scope, product principle, roadmap boundaries
- `tech.md` — preferred stack, local-first rule, SQLite direction
- `structure.md` — project organization, module responsibilities, naming
- `privacy-and-safety.md` — privacy rules, redaction, no cloud in V1

Contextual steering files (load when relevant):

- `tone-and-brand.md` — UI copy, roast copy, brand voice
- `data-model.md` — schema, entities, migration direction
- `handoff.md` — links to HANDOFF.md, update rules
- `agent-delegation.md` — task parallelism and delegation rules

### `.kiro/specs/`

Feature specs with `requirements.md`, `design.md`, and `tasks.md`.

This is where all active feature planning belongs. Do not use a root-level `spec.md` for cookedPrompts. Kiro specs already provide the feature-spec workflow.

Spec folders follow the naming convention `NN-feature-name`, for example:

- `.kiro/specs/01-local-importer/`
- `.kiro/specs/02-sqlite-data-layer/`
- `.kiro/specs/03-scoring-engine/`

### `.kiro/hooks/`

Future automations. Not required for V1 setup.

### `.kiro/skills/`

Future reusable workflows. Not required for V1 setup.

---

## Read Order for Future Sessions

Use this read order at the start of each meaningful session:

1. `HANDOFF.md`
2. `CHANGELOG.md`
3. `PROJECT_WORKFLOW.md`
4. relevant `.kiro/steering/` files
5. relevant `.kiro/specs/<feature>/` files
6. live project files for the active pass

Do not skip `HANDOFF.md`. It is the single source of truth for current project state.

---

## Spec Workflow

Use Kiro specs in this order:

1. Requirements first.
2. Review requirements.
3. Design second.
4. Review design.
5. Tasks third.
6. Review tasks.
7. Implement task by task.
8. Update `HANDOFF.md` and `CHANGELOG.md` after meaningful completed work.

Do not allow implementation before requirements, design, and tasks are clear and reviewed.

Each spec lives under `.kiro/specs/<feature>/` and contains:

- `requirements.md`
- `design.md`
- `tasks.md`

Do not create `spec.md` at the project root. Do not use `spec.md` for feature planning.

---

## Changelog Discipline

Use `CHANGELOG.md` for completed work only.

Rules:

- One dated section per work session.
- Timestamped bullets when possible.
- Future changelog-style headings should include time in Singapore timezone: `## YYYY-MM-DD HH:MM +08:00`
- Record the selected Kiro model.
- Record the reasoning level used.
- Keep entries brief and outcome-focused.
- Record what changed and why it mattered.
- Record verification only when verification was actually run.
- Do not record planned work as completed work.
- Do not use the changelog as a replacement for Git history.

---

## Handoff Discipline

Use `HANDOFF.md` for:

- current project state,
- roadmap,
- implemented/not implemented status,
- open decisions,
- risks,
- future-pass queue,
- major scope decisions,
- next intended Kiro spec.

Update `HANDOFF.md` after meaningful completed work or scope changes.

Do not use `HANDOFF.md` to override privacy or safety rules. If a privacy conflict arises, prefer `.kiro/steering/privacy-and-safety.md` unless it is intentionally updated by the user.

---

## Privacy and Safety Priority

Privacy and safety steering overrides convenience.

Never add behavior that violates:

- local-first V1,
- no cloud upload in V1,
- no full model answer storage in V1,
- local redaction before optional AI analysis,
- prompt logs are private user data.

If any future instruction conflicts with `.kiro/steering/privacy-and-safety.md`, raise the conflict explicitly rather than silently overriding the privacy rule.

---

## Tone Rule

For all user-facing copy:

Roast the prompt. Coach the user. Improve the habit.

The product can be funny, but never mean. Roast the prompt, not the user. See `.kiro/steering/tone-and-brand.md` for full guidance.

---

## Task Parallelism and Delegation

Early passes should be implemented manually task by task.

Parallel task execution or subagent-style delegation is allowed only when:

1. requirements are approved,
2. design is approved,
3. tasks are dependency-safe,
4. tasks touch separate files or clearly isolated areas,
5. privacy constraints are explicit,
6. the user has approved parallel execution.

Do not parallelize database migrations, privacy/redaction logic, storage rules, or tasks that edit the same files.

See `.kiro/steering/agent-delegation.md` for full delegation rules.

---

## Token-Efficient CLI Inspection

Prefer RTK (Rust Token Killer) for large or noisy command output when safe.

Use the project-local skill at `.kiro/skills/rtk-token-efficient-cli/SKILL.md`.

Use RTK for:

- repo structure inspection
- searching code and project files
- git status, diffs, and recent logs
- test/lint/build summaries
- large log files

Do not use RTK for:

- secrets, `.env`, or credential-bearing files
- destructive commands
- production deploy commands
- exact-output debugging where summarization could hide failures
- raw private prompt logs

If RTK is unavailable, use narrow normal commands:

- `git status --short`
- `git diff --stat`
- targeted file reads
- targeted test runs

Privacy and safety steering overrides token efficiency. Never use RTK as a shortcut to inspect sensitive data.

During Git closeout, RTK may summarize status/diff, but exact `git diff --check`, `git status --short`, `git commit`, and `git push` should still be run normally.

---

## Terminal Tool Recovery

Use `.kiro/skills/terminal-tool-recovery/SKILL.md` whenever shell, PowerShell, RTK, npm, git, package install, or command execution fails repeatedly.

If the same terminal tool or command fails twice, do not retry it unchanged. Diagnose the failure, simplify the command, switch shell/tool if available, or stop and report the blocker.

In particular, do not loop on `execute_pwsh`. If `execute_pwsh` fails repeatedly, stop using it and try a narrower/default-shell fallback if available. If no terminal path works, report the blocker clearly instead of continuing.
