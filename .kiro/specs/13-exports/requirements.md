# 13-exports Requirements

## Purpose

Define the first V1 export feature for cookedPrompts: local, deterministic, privacy-safe export bundles that turn completed prompt coaching work into reusable files.

## Problem

The app already saves the coaching report markdown, but V1 still lacks a clearly defined export feature for reusable workflow artifacts. The next spec must separate the existing report-save path from the export bundle so later implementation does not blur their contracts.

## Core User Value

- As a user, I want to export my coaching results locally so I can keep a reusable prompt habit playbook.
- As a user, I want export files to stay redacted and local so I can share or archive them safely.
- As a developer, I want export behavior to be deterministic so generated files are stable and reviewable.

## V1 Export Decisions

- Existing markdown report-save behavior is a precursor, not the full export feature.
- V1 exports are bundle-directory based, not single-file only.
- V1 export bundles include a primary coaching report plus workflow files.
- V1 workflow exports are markdown/text only.
- The export bundle includes both a memory-style file and a workflow guide file.
- The existing coaching report is exported as a report artifact inside the bundle, not renamed into a different product category.
- Exports remain local and are surfaced through the existing CLI path, with a dedicated export module if the later design needs one for pure artifact building.

## Required V1 Export Artifacts

- `coaching-report.md` - the main detailed coaching report content in export form.
- `memory.md` - a compact reusable memory file with the user's prompt habits and takeaways.
- `workflow.md` - a lightweight workflow guide or playbook for next-time prompt use.

## Privacy and Safety Requirements

- No full model answers or assistant completions in exported files.
- No banned full-answer fields in any export-facing type or file.
- No raw matched secrets, passwords, tokens, customer data, internal hostnames, or obvious personal data in exported text.
- No raw safety warning text, stack traces, or raw exception text in user-facing export output.
- Redaction must happen locally before any export file is written.
- Export files must remain local-only and must not require network, provider, telemetry, cloud, or account features.

## Determinism Requirements

- Same input and same options produce the same export content.
- Export filenames and bundle structure must be stable and predictable.
- If a target path already exists, the export behavior must use a deterministic collision rule instead of silently overwriting.
- Future implementation passes must compare the pre-change and post-change generated output before merging.

## Non-Goals

- No PDF or DOCX export in V1.
- No browser or web UI export work in this spec.
- No cloud sync, auth, billing, or provider calls.
- No importer, storage, or scoring redesign.
- No runtime code changes in 13A.

## Acceptance Shape

This spec is complete when later implementation can add exports without re-deciding:

- what files exist,
- where the export feature lives,
- how the CLI should surface it,
- how collisions work,
- and which privacy boundaries are mandatory.

