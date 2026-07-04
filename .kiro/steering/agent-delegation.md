---
inclusion: auto
description: Use when creating or reviewing tasks.md, deciding whether implementation tasks can run in parallel, planning Kiro task waves, assigning subagent-style roles, or deciding whether to run tasks individually or all at once.
---

# cookedPrompts Agent Delegation Steering

## Principle

Prefer small, reviewable tasks. Use parallel execution only when tasks are genuinely independent.

## Kiro-Native Parallelism

If Kiro supports explicit subagents in the current environment, use them only for clearly separable tasks.

If explicit subagents are not available, express delegation through `tasks.md` task waves and role labels.

Future `tasks.md` files should make dependencies explicit so Kiro can safely identify independent work.

## Task Role Labels

When useful, label tasks by role:

- `implementation`
- `test`
- `review`
- `documentation`
- `privacy-review`
- `schema-review`
- `ui-copy-review`

## Safe Parallel Examples

Parallel execution may be appropriate when tasks touch separate files and have clear inputs/outputs, such as:

- importer fixture creation
- documentation update
- isolated unit tests
- UI copy review
- schema review after schema is already defined

## Do Not Parallelize

Do not parallelize tasks that:

- edit the same files,
- change privacy or redaction behavior,
- change database migrations,
- affect prompt storage rules,
- depend on unsettled requirements,
- require human approval,
- could accidentally introduce cloud upload,
- could accidentally introduce full model answer storage.

## Review Rule

For early cookedPrompts passes, prefer manual task-by-task execution.

Only use "Run all Tasks" or subagent-style parallel execution after:

1. requirements are approved,
2. design is approved,
3. tasks are dependency-safe,
4. privacy constraints are explicit,
5. the user has approved parallel execution.

## Documentation Rule

After meaningful completed work, update:

- `HANDOFF.md`
- `CHANGELOG.md`

Do not update `CHANGELOG.md` for planned work that was not completed.

## Changelog Rule

When a meaningful pass is completed, record:

- selected Kiro model,
- reasoning level,
- completed outcome,
- files changed,
- verification run, if any.
