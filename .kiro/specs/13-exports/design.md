# 13-exports Design

## Design Summary

13-exports adds a local export bundle layer on top of the existing demo/report pipeline. The existing `--save` / `--out` report path stays a report artifact precursor. The export feature is a separate bundle-oriented contract that writes a small set of human-readable markdown/text files.

## Proposed Export Shape

- Export target: directory bundle.
- Export artifacts: `coaching-report.md`, `memory.md`, `workflow.md`.
- Artifact style: markdown/text only, human-facing, deterministic.
- Machine-stable contract: file names, ordering, headings, and section content shape.

## Public Contract Direction

The later runtime implementation should expose an export-oriented entry point that accepts:

- the unified demo output,
- an export target directory,
- and deterministic options such as `now` / naming controls if needed.

The existing CLI remains the user-facing surface. A dedicated pure export module may be introduced for artifact building, but the spec should not require a separate command unless the implementation needs it.

## File Boundaries

- `coaching-report.md` is the report artifact written in export form.
- `memory.md` is the compact habit-memory file.
- `workflow.md` is the reusable workflow/playbook file.

V1 keeps these files text-based and local-only. No JSON manifest is required for the first export pass unless a later implementation wave proves it necessary.

## Collision and Naming Policy

- Export targets are directories, not single files.
- If the target directory exists, the implementation should use a deterministic collision rule, likely a timestamped sibling directory or equivalent stable suffix.
- Within a bundle, filenames should remain stable.
- The implementation should not silently overwrite existing export artifacts.

## CLI Direction

- Report save stays on `--out` / `--save`.
- Export bundles should likely be a separate CLI path such as `--export <dir>`.
- Help text should clearly distinguish report saving from export bundle generation.
- The export bundle should remain local-first and content-free on errors.

## Privacy Model

- Exported files may include redacted prompt examples and coaching summaries only when the source data is already safely redacted.
- Exported files must never contain banned full-answer fields or raw secrets.
- Export files must not expose raw safety warnings, stack traces, or exception messages.
- Redaction should happen before truncation and before file writing.

## Wave Breakdown

### 13B - Export contracts and pure artifact builders

- Define export bundle types and artifact builders.
- Add deterministic file content builders for report, memory, and workflow files.
- Add tests for bundle shape and privacy invariants.

### 13C - CLI and file-writing integration

- Wire export bundle generation through the existing CLI.
- Add collision-safe directory/file writing.
- Update help text and error handling.
- Add tests for CLI behavior and generated export outputs.

### 13D - Docs, closeout, and final export review

- Update handoff, changelog, and any export docs.
- Verify generated output is stable and privacy-safe.
- Close out the spec when the export bundle is demo-ready.

## Generated Output Comparison Rule

Before changing export/report output behavior, the implementation agent must inspect the current generated output. After the change, it must generate the output again and compare before/after to confirm only the intended export differences occurred.

