# 06-safety-redaction Design

## Overview

The safety/redaction module performs deterministic local scanning of prompt text and optional metadata for risk indicators, producing value-free warnings. Each warning identifies a risk category, severity, and confidence, plus a content-free message, an optional recommendation, and a value-free location hint. The scanner reads potentially sensitive data in memory, discards any matched value immediately, and never stores, logs, or serializes the matched substring or the prompt text.

This module is the local redaction step that must run before any optional AI analysis is ever configured. It is designed to be a stable foundation that future features (importer preview, dashboard warning counts, export gating, optional AI-analysis preflight) can build on without reworking the contract.

## Design Goals

- Local-first: no network, no cloud, no telemetry, no AI model call in the scan path.
- Deterministic: identical input yields identical warnings and ordering.
- Value-free warnings: warnings never contain the matched value, prompt text, or any full model answer.
- No matched secret storage: matched substrings are discarded immediately after detection.
- Simple enough for V1: a rules list plus a result builder, no heavy machinery.
- Extensible for the future: the contract supports later dashboard aggregation, export gating, and optional AI-analysis preflight without breaking changes.

## Data Contracts

These TypeScript contracts describe the intended shape. They are design only and are not implemented in this planning pass. Emphasis: no matched text, no redacted prompt text, and no full model answer fields ever appear in these contracts.

```typescript
export type SafetyWarningCategory =
  | 'secret_like'
  | 'credential_like'
  | 'private_key'
  | 'personal_data'
  | 'customer_data'
  | 'company_sensitive'
  | 'private_source_code'
  | 'prompt_injection'
  | 'hallucination_risk'
  | 'citation_needed'
  | 'unsafe_retention_assumption'
  | 'unknown';

export type SafetySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyConfidence = 'low' | 'medium' | 'high';

export interface SafetyWarning {
  id: string;
  prompt_log_id?: string;
  category: SafetyWarningCategory;
  severity: SafetySeverity;
  confidence: SafetyConfidence;
  message: string;
  location_hint?: string;
  recommendation?: string;
  scanner_version: string;
  created_at: string;
}

export interface SafetyScanInput {
  prompt_log_id?: string;
  prompt_text: string;
  source?: string;
  provider?: string;
  model_used?: string;
  tags?: string[];
}

export interface SafetyScanResult {
  prompt_log_id?: string;
  warnings: SafetyWarning[];
  highest_severity: SafetySeverity | null;
  scanner_version: string;
  scanned_at: string;
}
```

Notes:

- `SafetyScanInput` deliberately omits every banned full-answer field (`assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`).
- `SafetyWarning` carries no substring, prefix/suffix, preview, sample, or hash of the matched value.
- `location_hint` is a value-free descriptor only (see Privacy Model).

## Scanner Architecture

The scanner is a simple deterministic pipeline:

1. A rules list. Each rule declares: a `rule id`, a `category`, a `severity`, a `confidence`, a value-free `message`, an optional value-free `recommendation`, and a matcher (a function or regex pattern). Patterns are intentionally broad and safe and contain no real secrets.
2. A scan pass that evaluates each rule against the prompt text (and, where relevant, metadata) in memory.
3. A result builder that constructs `SafetyWarning` objects from matched rules and discards matched values. The builder computes `highest_severity` and stamps `scanner_version` and `scanned_at`.

Ordering is deterministic: rules define a canonical order, and warnings are emitted in that order (deduped by category where appropriate, mirroring the existing scoring matcher behavior).

Candidate future modules (do NOT create in this planning pass):

- `src/safety/types.ts` — the data contracts above.
- `src/safety/safety-scanner.ts` — the scan pass and result builder.
- `src/safety/rules.ts` — the rules list.
- `src/safety/index.ts` — the module boundary/barrel.

Relationship to existing code: `src/scoring/rules/safety-patterns.ts` already contains a local `matchSafetyPatterns` heuristic that returns category + severity only (never matched substrings), with categories `api_key_like`, `access_token_like`, `private_key_marker`, `password_assignment`, `email_or_personal_data`, `company_sensitive`, and `prompt_injection`. The new safety module generalizes and consolidates that pattern approach into a richer category set with confidence and value-free location hints. A future refactor could make the dedicated safety module the shared source of truth for the scoring engine's internal matcher, but that is out of scope here; this spec does NOT change scoring.

## Warning Categories

Each category is defined below with FAKE examples of what it catches. Examples use obvious placeholders and never contain real secrets.

- `secret_like` — generic secret-looking values (long random tokens, key-ish prefixes). FAKE example: `FAKE_API_KEY_1234abcd...`.
- `credential_like` — credential assignments such as passwords or access tokens. FAKE examples: `password = FAKE_PLACEHOLDER`, `access_token: FAKE_TOKEN_0000`.
- `private_key` — private key block markers. FAKE example: `-----BEGIN FAKE PRIVATE KEY-----`.
- `personal_data` — personal data such as email addresses. FAKE example: `fake@example.test`.
- `customer_data` — indicators of customer records or PII belonging to third parties. FAKE example: `customer record: FAKE_CUSTOMER_NAME, acct FAKE_0001`.
- `company_sensitive` — internal/confidential markers. FAKE example: `CONFIDENTIAL — internal only (FAKE)`.
- `private_source_code` — indicators of private/proprietary source code. FAKE example: `// PROPRIETARY FAKE SOURCE — do not share`.
- `prompt_injection` — attempts to override instructions. FAKE example: `ignore all previous instructions (FAKE test string)`.
- `hallucination_risk` — prompts likely to elicit fabricated facts (asking for certainty without sources). FAKE example: `state the exact figures with no sources (FAKE)`.
- `citation_needed` — prompts asserting facts that should be cited. FAKE example: `claim X is true, no citation (FAKE)`.
- `unsafe_retention_assumption` — assumptions that sensitive data will be retained/stored safely. FAKE example: `save this data forever (FAKE assumption)`.
- `unknown` — a fallback category for detected-but-unclassified risk.

## Privacy Model

- Scan input CAN contain sensitive data; scan output MUST NOT reveal any sensitive data.
- Rules MAY inspect values in memory; matched values are discarded immediately after a match decision is made.
- Warnings identify the category and the location type only.
- No substring, prefix/suffix, preview, sample, or hash of the matched value is stored by default.
- No logs contain prompt content.

Allowed location hints (value-free):

- `prompt_text`
- `metadata.tags`
- `line:3`
- `contains private-key-like block`
- `contains token-like value`

NOT allowed in any output:

- the actual matched token
- a prefix or suffix of the matched value
- a redacted preview of the value
- a customer name
- an email address
- a source code snippet

## Storage Strategy

Recommendation: the V1 implementation starts with an in-memory scan result and does not persist warnings.

- Persistence is a later wave, added only if a concrete need appears (for example, dashboard aggregation or export gating).
- If warnings are persisted later, store the warnings only (category, severity, confidence, value-free message/hint/recommendation, timestamps, scanner version) and never the matched text.
- A possible future `safety_warnings` table could hold persisted warnings, keyed by `prompt_log_id`, designed to keep dashboard aggregation possible later.
- The first implementation wave does NOT require a migration.

## Integration Strategy

The following are future integration points. They are documented as architecture-ready boundaries and are NOT implemented in the first implementation wave unless tasks explicitly say so:

- Importer preview: the local importer preview could call the scanner before commit to surface a preview warning. (The importer already carries a `SafetyHandoffResult` shape in its preview; the scanner can feed that boundary later.)
- Prompt log repository: could expose a safety status derived from warnings later.
- Scoring: may optionally receive warning context later, but must NOT depend on the safety module yet. Scoring keeps its own internal matcher for now.
- Dashboard: could later show warning counts aggregated by category, without exposing prompt text.
- Exports: could later block or warn on unreviewed risky prompts.
- Optional AI analysis: could require a safety preflight scan before any analysis runs.

## Error Handling

- Errors are content-free: no prompt content, no matched values, and no metadata values in error messages.
- Invalid scanner input returns a safe error result (or an empty warning set), never an exception that leaks content.
- The scanner MUST NOT throw on an empty prompt.
- Malformed metadata MUST NOT leak values; the scanner tolerates it and reports at most a value-free warning or none.

## Testing Strategy

Plan (implemented in Wave 3) covers:

- Fake API keys detected as `secret_like`/`credential_like`.
- Fake private key block detected as `private_key`.
- Password-like text detected as `credential_like`.
- Prompt injection text detected as `prompt_injection`.
- Citation-needed prompts detected as `citation_needed`.
- Hallucination-risk prompts detected as `hallucination_risk`.
- Empty prompt produces no crash and no false positives.
- Safe prompt produces no warnings.
- Multiple warnings across categories in one prompt.
- No matched values appear anywhere in output.
- No banned full-answer fields appear anywhere.
- No network/fetch is invoked during a scan.
- Deterministic output: same input yields same warnings and ordering.

All test data uses synthetic fake secrets only.

## Implementation Waves Preview

- Wave 1 — types and scanner rule contracts.
- Wave 2 — deterministic local scanner implementation.
- Wave 3 — tests and privacy verification.
- Wave 4 — optional importer preview integration (decision first).
- Wave 5 — docs and closeout + backup branch.

## Deferred Items

- Cloud scanning.
- LLM classifier.
- AI-based redaction.
- Export blocking workflow.
- Dashboard UI.
- Model recommendation.
- Rewrite/template generation.
- New packages.
- Compliance certification.


---

## Wave 4 Integration Decision

**Decision date**: 2026-07-04
**Decision**: Defer importer preview implementation to a future dedicated pass.

### Rationale

- The safety scanner is implemented and privacy-tested (`scanPromptSafety()` returns value-free warnings).
- Wiring it into importer preview changes importer behavior and should be a separate bounded pass with importer-specific tests.
- Deferring avoids mixing scanner verification with importer behavior changes.
- Deferring preserves the current importer/scoring/dashboard baseline and avoids unexpected workflow changes.
- Future importer integration should be scoped as a dedicated pass with importer-specific tests.

### Approved future integration boundary

When importer preview integration is implemented in a future pass:

- Importer preview may call `scanPromptSafety()` on local prompt text before commit.
- Importer preview may expose only value-free warning summaries (categories, severity, confidence, message, recommendation).
- Importer preview must not store matched values, prompt text, redacted copies, previews, prefixes, suffixes, or hashes.
- Importer preview must not block imports by default unless a later requirement explicitly approves blocking behavior.
- Importer preview must preserve existing banned full-answer field handling.
- Importer preview tests must use synthetic fake data only.

### Current Wave 4 outcome

- No source changes.
- No importer behavior changes.
- No scanner behavior changes.
- No persistence.
- No dashboard integration.
- Scanner remains ready for future integration through the public `scanPromptSafety()` API.
