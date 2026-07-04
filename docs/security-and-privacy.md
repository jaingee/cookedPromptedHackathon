# Security and Privacy

cookedPrompts V1 is local-first by default. Prompt logs are treated as private user data because they may contain source code, customer context, credentials, business strategy, or personal information.

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

V1 demo reports never include raw `prompt_text`, even when `include_prompt_text` is accepted for future API compatibility. Report output is aggregate and coaching-oriented.

## Demo Data

The built-in demo dataset is synthetic. Fake secrets are placeholders only and are intentionally non-actionable.
