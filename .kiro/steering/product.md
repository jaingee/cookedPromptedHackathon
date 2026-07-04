---
inclusion: always
description: Core cookedPrompts product direction, V1 scope, non-goals, target users, product principle, and roadmap boundaries.
---

# cookedPrompts Product Steering

## Product Summary

cookedPrompts is a playful local-first AI habit coach that reviews past prompts, identifies weak prompt patterns, teaches better model choice, detects privacy and safety risks, and turns recurring prompt mistakes into reusable templates and workflow files.

The product should be useful first and funny second. The joke gets people in, but behavior improvement keeps them.

## Product Principle

Roast the prompt. Coach the user. Improve the habit.

The product may be funny, sarcastic, or lightly roasting, but it must never insult the user. Criticism should target the prompt, workflow, missing context, missing constraints, or model choice.

## Target Users

V1 targets:

- Software engineers
- Students
- AI hobbyists
- Prompt-heavy users who want better AI habits

## V1 Product Direction

V1 is a local-first coaching pipeline and dashboard data service that analyzes imported or mocked prompt logs after the fact.

V1 should help users understand:

- Which prompts were vague or under-specified
- Which prompts likely wasted tokens, cost, or time
- Which model choices were overkill or underpowered
- Which prompts contained privacy or safety risks
- How prompts could be rewritten better
- Which reusable templates or habits should be saved

## V1 Scope

V1 includes:

- Local-first coaching pipeline and dashboard data service
- Mocked/imported prompt logs
- JSONL/CSV import and export
- SQLite local storage
- Provider-neutral prompt log schema
- Prompt-only analysis
- Safety/redaction before optional AI analysis
- Vendor-neutral model recommendation classes
- Prompt scoring across multiple dimensions
- Basic rewrite suggestions
- Template saving
- Markdown exports such as memory.md, prompt_style.md, model_rules.md, guardrails.md, skills.md, and hooks.md
- Dashboard data service and minimal local CLI report surface
- Demo dataset for "20 Prompts Later: Your AI Habits Exposed"

## V1 Non-Goals

V1 must not include:

- Browser extension
- API wrapper/proxy
- VS Code extension
- Kiro extension
- Login/auth
- Cloud sync
- Supabase implementation
- Payments/billing
- Team features
- Full model answer storage
- Real-time prompt blocking
- Production-grade environmental accounting

## Roadmap Summary

### V1

Local-first prompt coaching pipeline using mocked/imported logs.

### V2

Optional Supabase/cloud sync, auth, user accounts, multi-device support, richer exports, improved model catalogue, optional AI-assisted analysis, redacted share cards, and better personal workspace support.

### V3

Capture sources and integrations such as browser extension, API wrapper/proxy, CLI prompt logger, VS Code/Kiro extension, provider integrations, pre-send suggestions, and more advanced workflow integrations.

### V4/V5+

Billing, paid tiers, enterprise controls, organization policies, team analytics, compliance features, and monetization. Do not implement billing before meaningful usage and retention are proven.

## Product Guardrail

Do not overbuild. The first demo should prove this coaching loop:

Import prompt logs → analyze prompt habits → show scores and risks → suggest better prompts → save templates/export memory.

## Handoff

For the public hackathon repo, `.kiro/specs/`, `.kiro/steering/`, and `docs/` record the visible roadmap, scope boundaries, and implementation notes. Internal handoff artifacts are intentionally excluded from the cleaned public repo.
