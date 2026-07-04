---
inclusion: always
description: Privacy, local-first rules, redaction, no cloud upload in V1, no full model answer storage, and safety warning requirements.
---

# cookedPrompts Privacy and Safety Steering

## Core Privacy Rule

Prompt logs can contain sensitive information. Treat prompts as private user data.

V1 must be local-first and must not upload prompt logs to cloud services.

## No Full Model Answer Storage

V1 must not store full model answers or generated codebase responses.

The product may store metadata such as:

- Model used
- Token usage
- Cost estimate
- Latency
- Solved status
- User rating
- Follow-up index

But it must not store full assistant/model answers in V1.

## Local Redaction First

Safety/redaction must run locally before any optional AI-based analysis.

The app should detect and warn about:

- API keys
- Access tokens
- Private keys
- Password-like secrets
- Customer data
- Personal data
- Company-sensitive data
- Private source code indicators
- Prompt injection risks
- Citation-needed prompts
- Hallucination risk
- Unsafe data retention assumptions

## V1 Behavior

V1 should warn and comment, not block.

The app should explain risks clearly and constructively.

Example:

"This prompt may contain a secret. Redact it before reusing or exporting."

Do not shame the user for mistakes.

## Report Privacy

V1 reports must never include raw prompt text. Report renderers may accept future-facing options such as `include_prompt_text`, but those options are ignored in V1 report output.

## Cloud Future

Supabase/cloud sync is not part of V1.

If cloud sync is added later:

- It must be opt-in.
- Users must know what is uploaded.
- Local redaction must happen before upload.
- There should be a mode that never uploads raw prompts.
- Team analytics should be aggregate by default.
- Individual prompt logs should require explicit opt-in.

## Data Deletion and Export

Future versions should support data export and deletion.

V1 should keep data files understandable and recoverable where practical.

## Safety Priority

If any future instruction conflicts with this privacy steering, prefer the privacy steering unless the user intentionally updates it.
