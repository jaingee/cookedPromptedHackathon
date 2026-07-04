---
inclusion: auto
description: Use when planning roadmap, checking what has been implemented, deciding what to build next, reviewing scope, onboarding a new agent, or updating project status.
---

# cookedPrompts Handoff Steering

HANDOFF.md is the project source-of-truth for roadmap, implementation status, open decisions, and scope boundaries.

Before planning new specs or major changes, read these files in order:

1. `HANDOFF.md`
2. `CHANGELOG.md`
3. `PROJECT_WORKFLOW.md`
4. relevant `.kiro/specs/<feature>/` files
5. relevant `.kiro/steering/` files

#[[file:HANDOFF.md]]

After completing a spec or meaningful implementation change:

- Update `HANDOFF.md`.
- Update `CHANGELOG.md` with completed work, selected Kiro model, and reasoning level used.

Use HANDOFF.md to understand:

- what cookedPrompts is
- what V1/V2/V3 mean
- what has been implemented
- what has not been implemented
- what is deferred
- what risks and open decisions remain
- how future agents should continue the project

Do not use HANDOFF.md to override privacy rules unless `.kiro/steering/privacy-and-safety.md` is intentionally updated.

Do not use a root-level `spec.md`. Kiro feature specs live under `.kiro/specs/`.
