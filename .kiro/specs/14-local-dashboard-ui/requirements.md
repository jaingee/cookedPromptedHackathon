# 14-local-dashboard-ui Requirements

## Purpose

Define the first real local dashboard UI for cookedPrompts: a read-only, local-first browser surface for exploring prompt scores, weak habits, and per-prompt coaching detail without leaving the user's machine.

## Problem

The product now has strong local foundations:

- imported prompt logs,
- SQLite persistence,
- deterministic scoring,
- safety scanning,
- model recommendation,
- rewrite/template coaching,
- detailed coaching reports,
- and export bundles.

What it still lacks is an interactive local UI. The existing dashboard work is intentionally a data service plus CLI report, not a browser dashboard. Users can generate reports and exports, but they cannot browse their prompt history, scan weak prompts, or jump from aggregate patterns into prompt detail in a more natural visual flow.

## Core User Value

- As a user, I want a local dashboard that shows what is going wrong across my prompts without making me read a full report every time.
- As a user, I want to browse scored prompts and quickly identify the ones worth fixing first.
- As a user, I want a prompt detail page where I can inspect score breakdowns, explanations, and the original prompt locally.
- As a user, I want the dashboard to stay private, local-only, and free of cloud or account requirements.

## V1 Dashboard UI Decisions

- This spec is for a read-only local dashboard UI, not a cloud app.
- The dashboard UI builds on the existing dashboard data service and local SQLite data.
- The dashboard UI is a browser surface for local use, separate from the existing markdown report and export bundle workflow.
- The UI must remain local-first, deterministic, and usable without network access.
- Overview and list surfaces must not expose prompt text.
- Prompt detail may show original prompt text locally because the user is viewing their own local data on their own machine.
- Full model answers or assistant completions remain out of scope and must never appear.
- V1 does not include editing, deleting, rescoring, cloud sync, auth, billing, or team features.
- No new packages should be assumed unless a later implementation pass proves they are necessary and the user explicitly approves them.

## Required V1 Views

### 1. Overview dashboard

The landing view must show a compact summary of local prompt health using existing dashboard aggregates.

Required content:

- total scored prompts,
- average overall score,
- needs-action count,
- low-confidence count,
- most common issue label,
- dimension summary,
- issue label summary,
- confidence summary.

The overview should feel like a working dashboard, not a text dump.

### 2. Scored prompt list

The UI must provide a browsable prompt list backed by the existing dashboard list DTOs.

Required list behavior:

- newest-first order,
- bounded pagination,
- batch/version filters if the underlying service already supports them cleanly,
- safe metadata display,
- overall score and confidence visibility,
- issue labels per prompt,
- no prompt text in the list surface.

### 3. Prompt detail page

The UI must provide a single-prompt local detail view.

Required detail content:

- score breakdown across all current score dimensions,
- issue labels,
- explanations,
- prompt metadata,
- original prompt text for local inspection,
- clear local-only presentation with no export/share behavior in this spec.

The detail page must not show full model answers or assistant completions.

### 4. Empty and error states

The UI must handle:

- no database / invalid database,
- database exists but no scores,
- filters with no matching prompts,
- missing prompt detail,
- content-free local errors.

Error states must stay content-free and must not dump prompt text, secrets, stack traces, or raw exception text into the UI.

## Runtime and Surface Requirements

- The dashboard UI must run locally only.
- The first UI implementation may use a small local server and browser pages, but it must not require cloud hosting.
- The first UI implementation must not require a new frontend framework by default.
- The dashboard UI should reuse the existing TypeScript/Node project structure and dashboard data contracts where practical.
- The first runtime pass should keep the public data boundary narrow and readable enough for tests.

## Privacy and Safety Requirements

- No network calls, telemetry, provider calls, or cloud sync.
- No full model-answer retention or display.
- No assistant completions in the UI.
- No banned full-answer fields in UI-facing types or rendered output:
  - `assistant_message`
  - `response`
  - `completion`
  - `model_answer`
  - `output_text`
  - `generated_text`
  - `template_body`
- No raw safety warning text in user-facing UI.
- No raw stack traces or raw exception text in user-facing UI.
- Overview, list, and aggregate UI views must not include prompt text.
- Prompt text remains local-only and detail-only.

## Non-goals

- No cloud dashboard.
- No auth/login/billing.
- No browser extension or API wrapper.
- No export redesign.
- No PDF or DOCX work.
- No importer, storage, or scoring redesign.
- No prompt editing, deletion, tagging changes, or write-back flows.
- No real-time updates or background sync.
- No new runtime package approvals in this spec pass.
- No runtime code changes in 14A.

## Acceptance Shape

This spec is complete when later implementation can proceed without re-deciding:

- the delivery surface for the first local dashboard UI,
- the required V1 views,
- the prompt text privacy boundary,
- the relation between the dashboard UI and existing report/export flows,
- the expected later wave split for implementation.
