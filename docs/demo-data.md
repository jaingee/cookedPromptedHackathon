# Demo Data

The built-in cookedPrompts demo dataset is synthetic. It is designed to exercise the V1 coaching pipeline without using real user prompts, real secrets, real credentials, or full model answers.

## What It Covers

- Vague prompts and missing context.
- Overly broad prompts.
- Token and cost waste signals.
- Model overkill and model-fit recommendations.
- Privacy and safety warning paths.
- Rewrite guidance and reusable template suggestions.
- Demo report rendering.

## Fake Secrets

Some demo prompts intentionally include fake credential-like placeholders so the safety scanner can demonstrate risk detection. These examples are non-actionable and use obvious placeholder values such as:

- `FAKE_API_KEY_PLACEHOLDER_DO_NOT_USE`
- `FAKE_PASSWORD_PLACEHOLDER_DO_NOT_USE`
- `db.example.test:5432`

The placeholders are not real credentials, not service tokens, and not internal hosts.

## Privacy Boundary

The demo dataset contains no real user prompts, no real model answers, no real credentials, and no private logs. V1 reports generated from this data may include synthetic prompt excerpts for coaching, but they do not include real user data, raw matched secret values, or banned full-answer fields.
