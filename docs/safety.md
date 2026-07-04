# Safety Redaction

## Purpose

Safety redaction provides deterministic local scanning of prompt text and metadata for sensitive or risky content, producing value-free warnings. It supports future importer preview, dashboard warning counts, export gates, and optional AI-analysis preflight — but those integrations are not implemented in this spec.

Product framing: roast the prompt, coach the user, improve the habit.

## What Safety Redaction Includes

- `SafetyScanInput` — typed scan input contract.
- `SafetyWarning` — value-free warning interface.
- `SafetyScanResult` — scan result with warnings and severity summary.
- `SafetyWarningCategory` — 12 risk categories.
- `SafetySeverity` — 4 severity levels (low, medium, high, critical).
- `SafetyConfidence` — 3 confidence levels (low, medium, high).
- `SafetyRule` — rule interface with boolean matcher.
- `SAFETY_SCANNER_VERSION` — scanner version constant (`1.0.0`).
- `SAFETY_RULES` — 11 deterministic rules.
- `SafetyScannerOptions` — optional injectable clock for deterministic timestamps.
- `scanPromptSafety(input, options?)` — the public scan function.
- Behavior tests — synthetic fake data coverage of all categories.
- Privacy/no-network tests — value-free verification and no-fetch assertions.

## Architecture

Files:

- `src/safety/types.ts` — public type contracts (`SafetyWarningCategory`, `SafetySeverity`, `SafetyConfidence`, `SafetyWarning`, `SafetyScanInput`, `SafetyScanResult`).
- `src/safety/rules.ts` — private-regex boolean-only rules with value-free metadata. Module-level regexes are never exported. Rules return only a boolean. `SAFETY_SCANNER_VERSION` and `SAFETY_RULES` are exported.
- `src/safety/safety-scanner.ts` — evaluates rules in canonical order and builds value-free warnings. Discards matched values immediately. Computes `highest_severity`. Stamps `scanner_version` and `scanned_at`.
- `src/safety/index.ts` — module boundary and public exports.
- `tests/safety/safety-scanner.test.ts` — behavior tests covering all categories, safe/empty input, multiple warnings, determinism, and ID generation.
- `tests/safety/safety-privacy.test.ts` — privacy verification tests (no-leak, no banned fields, no fetch, malformed input, rules value-free).

Design:

- `types.ts` defines public contracts. Input may contain `prompt_text` for local inspection. Output never contains prompt text, matched values, or banned fields.
- `rules.ts` has private-regex boolean-only rules. Each rule inspects prompt text and metadata in memory, returns only a boolean, and never returns, stores, or exposes matched substrings.
- `safety-scanner.ts` evaluates rules in canonical order and builds value-free warnings. Matched values are discarded immediately after the boolean test.
- `index.ts` is the module boundary. It re-exports public types, constants, and the scan function.
- Tests use synthetic fake data only — obvious placeholders, never real secrets.

## Public API

```typescript
scanPromptSafety(input: SafetyScanInput, options?: SafetyScannerOptions): SafetyScanResult
```

### Input (`SafetyScanInput`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt_log_id` | `string` | No | Optional prompt log identifier |
| `prompt_text` | `string` | Yes | The prompt text to scan locally |
| `source` | `string` | No | Import source identifier |
| `provider` | `string` | No | AI provider name |
| `model_used` | `string` | No | Model identifier |
| `tags` | `string[]` | No | Optional tags (also scanned) |

### Output (`SafetyScanResult`)

| Field | Type | Description |
|-------|------|-------------|
| `prompt_log_id` | `string \| undefined` | Echoed from input |
| `warnings` | `SafetyWarning[]` | Value-free warnings |
| `highest_severity` | `SafetySeverity \| null` | Highest severity across warnings, or null if none |
| `scanner_version` | `string` | Scanner version (`1.0.0`) |
| `scanned_at` | `string` | ISO 8601 timestamp |

### Warning (`SafetyWarning`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Deterministic warning ID |
| `prompt_log_id` | `string \| undefined` | Echoed from input |
| `category` | `SafetyWarningCategory` | Risk category |
| `severity` | `SafetySeverity` | Severity level |
| `confidence` | `SafetyConfidence` | Confidence level |
| `message` | `string` | Value-free human-readable message |
| `location_hint` | `string \| undefined` | Value-free location hint |
| `recommendation` | `string \| undefined` | Value-free remediation suggestion |
| `scanner_version` | `string` | Scanner version |
| `created_at` | `string` | ISO 8601 timestamp |

### Privacy Guarantee

Input may contain `prompt_text` for local inspection. Output NEVER contains:

- `prompt_text`
- Matched values or substrings
- Redacted prompt copies
- Previews, prefixes, or suffixes of matched content
- Samples of matched text
- Hashes of matched values

## Warning Categories

| Category | Description | Fake Example |
|----------|-------------|--------------|
| `secret_like` | API key or secret-like token | `FAKE_API_KEY_1234567890abcdef1234567890abcdef` |
| `credential_like` | Password or credential assignment | `password: FAKE_PASSWORD_PLACEHOLDER` |
| `private_key` | Private key block | `-----BEGIN FAKE PRIVATE KEY-----` |
| `personal_data` | Email or personal identifier | `fake@example.test` |
| `customer_data` | Customer or account reference | `FAKE_CUSTOMER_001` |
| `company_sensitive` | Confidential or internal-only marker | `FAKE INTERNAL ONLY document` |
| `private_source_code` | Private repository reference | `private repo FAKE_REPO_NAME` |
| `prompt_injection` | Instruction override attempt | `ignore previous instructions (test)` |
| `hallucination_risk` | Certainty demand without verification | `are you 100% sure (test)` |
| `citation_needed` | Factual claim without source | `statistics show (test)` |
| `unsafe_retention_assumption` | Unsafe permanence assumption | `store this permanently (test)` |
| `unknown` | Reserved for future categories | — |

## Privacy Model

- Local-only. No network calls, no cloud sync, no telemetry, no LLM in the scan path.
- Rules inspect prompt text and metadata in memory only.
- Matched values are discarded immediately after the boolean test. They are never returned, stored, logged, previewed, redacted, hashed, or exposed.
- Warnings are value-free. They contain category, severity, confidence, a generic message, and an optional location hint — never the matched content.
- No prompt content appears in output, errors, or logs.
- No raw regex match values are stored or returned.
- No hashes of matched values.
- No redacted prompt copies.
- No persistence in this spec.
- Tests use synthetic fake data only (obvious placeholders, never real secrets).

## Scanner Behavior

- Deterministic: same input produces the same warnings in the same order.
- Canonical rule order: secrets/credentials first, then privacy/sensitive, then behavioral risks.
- One warning per rule maximum. A rule either fires or it does not.
- Multiple categories per prompt: a single prompt can trigger multiple rules.
- `highest_severity` summary: computed from all fired warnings.
- `SafetyScannerOptions.now` allows injectable clock for deterministic timestamps in tests.
- Safe empty result for malformed, empty, or whitespace-only input. No throw.
- Tags are also scanned by rules that support tag matching.

## Testing Baseline

Before Wave 5: 27 test files, 402 tests passing. After Wave 5: remains 27 test files, 402 tests passing (docs-only change).

Coverage summary:

- **Behavior tests** (`tests/safety/safety-scanner.test.ts`): all 12 categories, safe prompt (no warnings), empty prompt (no crash), multiple warnings per prompt, tags scanning, deterministic output, warning ID generation.
- **Privacy tests** (`tests/safety/safety-privacy.test.ts`): no-leak verification (warnings contain no matched values or prompt text), no banned fields in results, no fetch/network during scan, malformed input handling, rules are value-free (rule metadata contains no matched content).

## Integration Decision

Wave 4 decided to defer importer preview integration to a future dedicated pass.

The scanner is ready for integration through `scanPromptSafety()`. Future integration boundary:

- The importer may call the scanner during preview.
- Only value-free summaries (warnings, severity, counts) cross the boundary.
- No matched values, prompt text, or redacted copies cross the boundary.
- No blocking by default — warnings inform, they do not reject imports.

## What Safety Redaction Does Not Do

- No importer integration yet.
- No dashboard UI.
- No storage or persistence.
- No migration.
- No export gate.
- No model recommendation.
- No rewrite/template generation.
- No LLM classifier.
- No cloud scanner.
- No AI-based redaction.
- No compliance certification.
- No packages added.

## Usage Notes

The scanner is a library API, not a CLI command. Call it from code:

```typescript
import { scanPromptSafety } from '../src/safety/index.js';

const result = scanPromptSafety(
  {
    prompt_log_id: 'prompt-001',
    prompt_text: 'Use FAKE placeholder values only in examples.',
    tags: ['example'],
  },
  { now: () => '2026-07-04T00:00:00.000Z' },
);

console.log(result.warnings);
```

## Future Work

Next product specs may be model recommendation, rewrite/template, or exports. A future dedicated pass can wire the scanner into importer preview. CLI report could later show safety warning summaries. Dashboard could aggregate warning counts.
