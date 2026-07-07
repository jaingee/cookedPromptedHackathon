# Security and Privacy

cookedPrompts V1 is local-first by default. Prompt logs are treated as private user data because they may contain source code, customer context, credentials, business strategy, or personal information.

V1 is complete through `14-local-dashboard-ui` and remains local-first. Any future hosted features must preserve the same privacy posture: opt-in upload, redaction-aware flows, and no full-answer retention.

## V1 Guarantees

- No cloud sync.
- No telemetry.
- No external AI judge.
- No provider API calls.
- No login, auth, billing, or hosted account layer.
- No full model answer storage.

## Data Boundaries

V1 stores prompt logs and scoring metadata locally in SQLite. It does not store full assistant/model answers. Banned full-answer fields include:

- `assistant_message`
- `response`
- `completion`
- `model_answer`
- `output_text`
- `generated_text`

Import and storage boundaries strip or reject these fields where they could otherwise persist full model output.

## Safety Warnings

The safety scanner returns value-free warning categories and severities. It does not return matched secret values or raw sensitive substrings.

Warnings are coaching signals, not enforcement. V1 warns users to redact risky content before external use.

## Demo Reports

V1 demo reports can include synthetic or redacted local prompt excerpts as part of coaching examples. They do not include full model answers, banned full-answer fields, raw matched secret values, or raw safety warning text. `--include-prompt-text` and `include_prompt_text` are accepted for compatibility, but the public report boundary still stays coaching-oriented rather than exposing raw prompt-log dumps.

## Demo Data

The built-in demo dataset is synthetic. Fake secrets are placeholders only and are intentionally non-actionable.

## Future Cloud Boundary

Future SaaS/cloud sync must be opt-in, clear about what leaves the machine, and redaction-aware before upload. V1 deliberately proves the import, scoring, safety, model-fit, rewrite/template, and reporting loop locally before adding accounts or hosted dashboards.
