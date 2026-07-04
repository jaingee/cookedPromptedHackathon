---
inclusion: auto
description: Use when designing or reviewing prompt logs, SQLite schema, future Supabase/Postgres migration, import formats, scoring outputs, model recommendations, safety warnings, rewrite variants, templates, user memory profiles, or gamification events.
---

# cookedPrompts Data Model Steering

## Data Model Principle

Use a provider-neutral data model first.

Do not hardcode the product around one AI vendor.

## Future Supabase/Postgres Principle

V1 uses SQLite, but the schema should be boring and migration-friendly.

Use:

- UUID-style IDs
- explicit columns for core entities
- clear relationships
- created_at
- updated_at
- deleted_at where useful
- nullable user_id for future auth
- nullable workspace_id for future workspaces
- nullable sync_status for future sync

Avoid:

- SQLite-only tricks
- giant JSON blobs for core entities
- vendor-specific model assumptions in core tables
- storing full model answers in V1

## Core Entities

The V1 data model should support these entities:

- PromptLog
- PromptScore
- ModelRecommendation
- SafetyWarning
- RewriteVariant
- Template
- UserMemoryProfile
- GamificationMetric
- ModelCatalogue
- ImportBatch

## PromptLog

PromptLog represents one user prompt or follow-up prompt.

Suggested fields:

- id
- user_id nullable in V1
- workspace_id nullable in V1
- import_batch_id
- session_id
- timestamp
- source
- provider
- model_used
- prompt_text
- prompt_hash
- follow_up_index
- parent_prompt_id
- input_tokens
- output_tokens
- total_tokens
- estimated_cost
- latency_ms
- solved_status
- user_rating
- tags
- redaction_status
- sync_status nullable
- created_at
- updated_at
- deleted_at nullable

V1 must not store the full model answer.

## PromptScore

PromptScore stores separate scores, not one single score.

Score dimensions:

- clarity
- context
- constraints
- output_format
- model_choice
- efficiency
- safety_guardrails

Use a 0 to 5 scale unless changed by a later spec.

## ModelRecommendation

Model recommendations should use capability classes first.

Capability classes:

- cheap_fast
- general_purpose
- coding
- deep_reasoning
- long_context
- tool_using
- search_required
- multimodal
- privacy_sensitive_local

Specific vendor model mapping should be configurable and replaceable.

## SafetyWarning

SafetyWarning should capture:

- warning_type
- severity
- matched_pattern or detection reason
- explanation
- recommended_fix
- redacted_preview where safe

## RewriteVariant

RewriteVariant should capture:

- variant_type
- rewritten_prompt
- explanation
- target_model_class
- estimated_token_delta
- saved_as_template flag

Variant types may include:

- casual
- technical
- expert
- cheap_model
- deep_reasoning

## Template

Template stores reusable improved prompts.

Templates should be tagged by task type, model class, and use case.

## UserMemoryProfile

UserMemoryProfile should support Markdown export to memory.md and related files.

It may include:

- recurring prompt mistakes
- preferred output formats
- common project context
- model preferences
- writing style notes
- reusable prompt templates

## GamificationMetric

Gamification should stay lightweight in V1.

Possible metrics:

- prompt streaks
- token waste reduced
- estimated cost saved
- badges earned
- most improved prompt
- roast of the week

Do not let gamification complicate the core data model.
