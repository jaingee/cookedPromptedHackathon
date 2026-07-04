# 06-safety-redaction Tasks

## Status

- Requirements: Completed.
- Design: Completed.
- Tasks: Completed.
- Implementation: Completed.
- Tests: Completed.

## Global Guardrails

All waves must respect these rules:

- Local-first. No network calls, no cloud sync, no telemetry.
- No external AI / LLM judge in the scan path.
- No matched secret substrings stored anywhere.
- No secret values in warnings (message, location hint, recommendation).
- No prompt content in errors or logs.
- No redacted prompt copies in V1 unless explicitly approved in a later pass.
- No raw regex match values stored; no hash of secret values (default is no).
- No model recommendation, rewrite generation, exports, or dashboard UI in this spec.
- No new packages.
- Banned full-answer fields (never accepted, stored, or emitted): `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`.
- Scanner must be deterministic (same input → same warnings and ordering).
- Synthetic fake test data only (obvious placeholders, never real secrets).
- TypeScript strict mode; ESM `.js` import specifiers.
- Content-free error messages (field/category names only, never prompt content).

---

## Wave 1 — Safety Data Contracts

### Task 1.1 — Define safety warning and category types

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: requirements + design complete
- **Files likely touched**: `src/safety/types.ts`
- **Goal**: Define `SafetyWarningCategory`, `SafetySeverity`, and `SafetyConfidence` type contracts.
- **Acceptance**: exports all three union types with the exact members from the design; no implementation logic; no banned fields referenced; typecheck passes.

### Task 1.2 — Define scanner input and warning/result types

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 1.1
- **Files likely touched**: `src/safety/types.ts`
- **Goal**: Define `SafetyWarning`, `SafetyScanInput`, and `SafetyScanResult` interfaces.
- **Acceptance**: interfaces match the design contracts exactly; `SafetyScanInput` omits all banned full-answer fields; `SafetyWarning` carries no matched value/substring/preview/hash; typecheck passes.

### Task 1.3 — Establish safety module boundary

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Tasks 1.1, 1.2
- **Files likely touched**: `src/safety/index.ts`
- **Goal**: Create the safety module barrel exporting the public type contracts.
- **Acceptance**: `src/safety/index.ts` re-exports the type contracts; module boundary is clean; no runtime scan logic yet; typecheck passes.

---

## Wave 2 — Deterministic Scanner

### Task 2.1 — Implement scanner rules list

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Wave 1
- **Files likely touched**: `src/safety/rules.ts`
- **Goal**: Implement the deterministic rules list (rule id, category, severity, confidence, value-free message, optional value-free recommendation, matcher).
- **Acceptance**: rules cover the design categories; patterns are broad and safe and contain no real secrets; canonical ordering defined; no matched values captured; typecheck passes.

### Task 2.2 — Implement the safety scanner

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 2.1
- **Files likely touched**: `src/safety/safety-scanner.ts`
- **Goal**: Implement the scan pass and result builder that produces `SafetyScanResult` from `SafetyScanInput`.
- **Acceptance**: evaluates rules in memory, discards matched values immediately, builds value-free warnings, computes `highest_severity`, stamps `scanner_version` and `scanned_at`; deterministic output; typecheck passes.

### Task 2.3 — Support multiple warning categories and value-free output

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 2.2
- **Files likely touched**: `src/safety/safety-scanner.ts`, `src/safety/rules.ts`
- **Goal**: Ensure a single prompt can produce multiple warnings across categories, all value-free.
- **Acceptance**: multiple matches yield multiple warnings in canonical order; no matched substrings, no prompt text, no banned fields in any warning; typecheck passes.

### Task 2.4 — No network and content-free errors

- **Status**: Completed (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 2.2
- **Files likely touched**: `src/safety/safety-scanner.ts`, `src/safety/index.ts`
- **Goal**: Ensure the scan path performs no network access and returns content-free errors on invalid input.
- **Acceptance**: no fetch/network in scan path; empty prompt does not throw; malformed metadata does not leak values; invalid input returns a safe result/error; typecheck passes.

---

## Wave 3 — Tests and Privacy Verification

### Task 3.1 — Scanner behavior tests

- **Status**: Completed (2026-07-04).
- **Role**: testing
- **Depends on**: Wave 2
- **Files likely touched**: `tests/safety/safety-scanner.test.ts`
- **Goal**: Test detection behavior across categories with synthetic fake data.
- **Acceptance**: tests cover fake API keys, fake private key block, password-like text, prompt injection, citation-needed, hallucination-risk, safe prompt (no warnings), empty prompt (no crash), and multiple warnings; all pass; deterministic output asserted.

### Task 3.2 — Privacy verification tests

- **Status**: Completed (2026-07-04).
- **Role**: testing
- **Depends on**: Task 3.1
- **Files likely touched**: `tests/safety/safety-privacy.test.ts`
- **Goal**: Verify no matched substrings, no banned fields, and no network access.
- **Acceptance**: asserts warnings contain no matched values/prompt text; asserts no banned full-answer fields anywhere; asserts no fetch/network during a scan; content-free errors verified; all tests use synthetic fake secrets only; all pass.

---

## Wave 4 — Integration Decision / Optional Importer Preview

### Task 4.1 — Decide importer preview integration scope

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Wave 3
- **Files likely touched**: `.kiro/specs/06-safety-redaction/design.md`, `HANDOFF.md`
- **Goal**: Decide whether importer preview integration belongs in 06-safety-redaction or a later spec.
- **Acceptance**: decision recorded with rationale. Decision first, implementation only if low-risk and clearly bounded.

### Task 4.2 — Optional importer preview handoff (only if approved in 4.1)

- **Status**: Deferred by Wave 4 decision (2026-07-04).
- **Role**: implementation
- **Depends on**: Task 4.1
- **Files likely touched**: `src/safety/index.ts`, importer preview boundary (only if approved)
- **Goal**: If included, add only a preview warning handoff so the importer preview can surface safety warnings.
- **Acceptance**: Decision first, implementation only if low-risk and clearly bounded. Does not mutate stored prompts; does not block imports unless requirements clearly say so; no banned fields cross the boundary; typecheck and tests pass.

---

## Wave 5 — Docs and Closeout

### Task 5.1 — Write safety module documentation

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Wave 3 (and Wave 4 if implemented)
- **Files likely touched**: `docs/safety.md`
- **Goal**: Document the scanner contract, categories, privacy model, and integration boundaries.
- **Acceptance**: docs describe input/output, categories, value-free warnings, storage recommendation, and future integration points; all examples use FAKE placeholders.

### Task 5.2 — Update HANDOFF and CHANGELOG and mark spec complete

- **Status**: Completed (2026-07-04).
- **Role**: documentation
- **Depends on**: Task 5.1
- **Files likely touched**: `HANDOFF.md`, `CHANGELOG.md`, `.kiro/specs/06-safety-redaction/tasks.md`
- **Goal**: Update project memory and mark the spec complete.
- **Acceptance**: HANDOFF status table updated; CHANGELOG entry added; spec status set to complete.

### Task 5.3 — Create backup branch

- **Status**: Completed (2026-07-04).
- **Role**: closeout
- **Depends on**: Task 5.2
- **Goal**: Create the backup branch after closeout.
- **Acceptance**: backup branch `backup/after-06-safety-redaction-complete` created and pushed.

---

## Deferred / Out of Scope

- Cloud scanning.
- LLM classifier.
- AI-based redaction.
- Export blocking workflow.
- Dashboard UI.
- Model recommendation.
- Rewrite/template generation.
- New packages.
- Compliance certification.
