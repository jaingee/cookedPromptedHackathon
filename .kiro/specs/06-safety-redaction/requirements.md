# 06-safety-redaction Requirements

## Status

- Requirements: Drafted.
- Design: Drafted.
- Tasks: Drafted.
- Implementation: Not started.
- Tests: Not started.

## Purpose

Safety/redaction provides local-only inspection of prompt text and metadata for sensitive data and risk indicators, producing value-free warnings. It is a foundation for later optional AI analysis, model recommendation, rewrite/template generation, exports, dashboard warnings, and future cloud-sync safeguards.

The scanner reads potentially sensitive prompt text in memory, classifies risk into stable categories with a severity and confidence, and emits warnings that never contain the matched sensitive value, the prompt text, or any full model answer. It is the local redaction step that must run before any optional AI-based analysis is ever configured.

Product framing: roast the prompt, coach the user, improve the habit. Safety warnings warn and coach constructively; they never shame the user and never block in V1.

## User Stories

- As a user, I want to know if a prompt contains secrets before future analysis or export, so I can redact sensitive data before it leaves my control.
- As a user, I want warnings that identify risk categories without exposing the sensitive value, so reading a warning never re-leaks the secret.
- As a local-first user, I want all checks to run locally with no network calls, so my prompt data never leaves my machine.
- As a future dashboard user, I want aggregated warning categories without leaking prompt text, so I can see risk trends without exposing individual prompts.
- As a future export user, I want exports to know whether a prompt needs review before leaving the local machine, so risky prompts can be flagged before export.
- As a user, I want short, constructive messages that tell me what to fix, so I can improve the prompt rather than feel judged.
- As a developer integrating scoring/importer later, I want a stable safety contract, so future integration points do not require reworking the scanner.

## Functional Requirements

### Safety scan input

- The scanner accepts prompt text plus optional metadata: `source`, `provider`, `model_used`, `tags`, and an optional `prompt_log_id`.
- The scanner MUST NOT accept any full model answer fields. Banned fields: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`.
- The scanner MUST tolerate an empty prompt without throwing.
- The scanner MUST tolerate missing/malformed optional metadata without leaking its values.

### Safety scan output

Each warning includes:

- `prompt_log_id` when available (links the warning to a stored prompt log; omitted otherwise).
- warning `category` (see categories below).
- `severity` (low, medium, high, critical).
- `confidence` (low, medium, high).
- a value-free `location_hint` (for example `prompt_text`, `metadata.tags`, `line:3`) that never contains the matched value.
- a short, content-free `message` describing the risk category without quoting prompt content.
- an optional `recommendation` text with constructive, content-free guidance.
- `created_at` timestamp.
- `scanner_version` identifying the rule set that produced the warning.

The scan result also carries the overall `highest_severity`, the `scanner_version`, and a `scanned_at` timestamp.

### Warning categories

The scanner classifies risk into these stable categories:

- `secret_like`
- `credential_like`
- `private_key`
- `personal_data`
- `customer_data`
- `company_sensitive`
- `private_source_code`
- `prompt_injection`
- `hallucination_risk`
- `citation_needed`
- `unsafe_retention_assumption`
- `unknown`

Consumers must not assume this set is fixed; it may grow in future versions.

### Severity and confidence

- Severity is one of: `low`, `medium`, `high`, `critical`.
- Confidence is one of: `low`, `medium`, `high`.

### Redaction behavior

- The scanner detects risk but MUST NOT store the matched sensitive substring.
- V1 MUST NOT store a redacted copy of the prompt unless explicitly approved in a later pass.
- Warning content (message, location hint, recommendation) MUST be value-free.

### Local-only behavior

- No network access, no cloud calls, no telemetry, and no AI model call at any point in the scan path.
- The scanner MUST be deterministic: the same input produces the same warnings and ordering.

### Future integration points (future / architecture-ready)

These are documented as architecture-ready boundaries. They are NOT implemented in this planning pass unless tasks explicitly say so:

- Importer preview warning: the local importer preview could call the scanner before commit.
- Prompt log safety status: the prompt log repository could later expose a safety status.
- Dashboard aggregate warning counts: the dashboard could later aggregate warning categories without exposing prompt text.
- Future export gate / review warning: exports could later warn or gate on unreviewed risky prompts.
- Future optional AI-analysis preflight: any optional AI analysis could require a safety preflight scan first.

## Privacy Requirements

- Warnings MUST NOT include the matched secret value.
- Warnings MUST NOT include prompt text.
- Errors MUST NOT include prompt text.
- Logs MUST NOT include prompt text.
- No raw regex match values are stored.
- No hash of secret values unless explicitly approved later; default is no.
- The scanner MUST be deterministic and local.
- Tests MUST use synthetic fake secrets only (obvious placeholders, never real secrets).

## Non-Goals

- No cloud scanner.
- No LLM classifier.
- No AI-based redaction.
- No external API validation of secrets.
- No dashboard UI in this planning pass.
- No exports.
- No model recommendation.
- No rewrite generation.
- No automatic prompt mutation.
- No irreversible deletion.
- No policy/legal compliance certification.

## Acceptance Criteria

For this planning pass:

- Requirements, design, and tasks documents are created for 06-safety-redaction.
- Boundaries between safety, scoring, importer, dashboard, and exports are clear.
- Implementation waves are small and reviewable.
- Future integration points are documented as architecture-ready without being implemented.
- HANDOFF.md and CHANGELOG.md are updated.
- Typecheck and test baseline are unchanged (docs-only pass): 25 test files, 367 tests passing.

## Open Questions

- Should safety warnings be persisted in V1, or kept in-memory only until a later wave demonstrates a clear need? (Design leans toward in-memory first.)
- Should the dedicated safety module become the shared source of truth for the scoring engine's internal `matchSafetyPatterns` matcher (`src/scoring/rules/safety-patterns.ts`), or should the two remain independent for now? (Out of scope to change scoring here; noted for a future refactor.)
- Should importer-preview integration land in this spec (Wave 4) or a later dedicated spec? The decision should be made before any integration code is written.
- Is a value-free location hint scheme based on line numbers versus field names sufficient, or is a richer (still value-free) hint model needed later?
- Should confidence be rule-driven (per-rule confidence) or category-driven (per-category confidence)? This affects how rules are authored in Wave 2.
