# Design Document

## Overview

The detailed coaching report is a local-first upgrade of the existing demo report. It keeps the current deterministic pipeline but makes the output feel more like a prompt habit coach by adding score bands, better before/after examples, a roast, a good-example highlight, model-waste teaching, and stronger next-step guidance.

The design keeps the system fully offline and deterministic. It does not use an external AI judge, cloud scoring, or any network calls. It also keeps the existing privacy boundary: local reports may show prompt examples, but sensitive spans must be masked before display and full model answers remain out of scope.

## Product Direction

### Report Tone

The report should feel:

- useful first
- slightly funny
- direct
- memorable
- never insulting

The roast must target the prompt, workflow, missing context, or model choice, not the user.

### Recommended Section Order

1. Batch Verdict
2. Prompt Habit Score
3. Category Scorecard
4. What Kept Hurting Results
5. Prompt Examples & Better Versions
6. Roast of the Batch
7. Model Waste / Overkill
8. Safety & Privacy Lessons
9. One Good Prompt Worth Copying
10. Top Fixes Checklist
11. Limitations

The first four sections should be present in the first runtime wave. The example/roast/good-prompt sections can arrive in a later wave if needed, but the final design should include them.

## Scoring Design

### 0-5 to 0-100 Conversion

The existing 0-5 scores should be converted with:

```ts
Math.round(score * 20)
```

This keeps the mapping simple, stable, and easy for the user to read.

### Overall Score

The overall Prompt Habit Score should be derived from the existing average overall score when present and converted to 0-100 using the same rule.

### Category Scorecard

The scorecard should use these labels:

- Clarity
- Context
- Constraints
- Output Format
- Model Fit
- Efficiency
- Safety & Privacy

Each category should show:

- 0-100 score
- one short label band
- one coaching sentence when useful

Suggested bands:

- 0-49 = Poor
- 50-69 = Okay
- 70-84 = Good
- 85-100 = Excellent

### Score Data Source

The design should reuse the existing scoring output and existing aggregates. It should not introduce a new AI-based evaluator or any external lookup.

## Prompt Example Design

### Example Selection

Example cards should be selected deterministically from the local pipeline output.

Recommended selection rules:

1. Prefer example cards with useful coaching contrast.
2. Include the worst prompt as the roast candidate.
3. Include the best prompt as the copy-worthy example.
4. Use stable tie-breaking by prompt id when scores are equal.

### Demo vs File/User Mode

- Demo mode may show richer example cards because the dataset is synthetic and already designed for illustration.
- File/user mode should also show prompt examples locally, but with masking applied to sensitive spans.

### Safe Output Fields

Use report-facing names such as:

- `prompt_excerpt`
- `redacted_prompt`
- `improved_prompt`
- `coaching_reason`
- `why_it_works`
- `habit_to_build`
- `overall_score_100`
- `category_scores_100`

Avoid report-facing field names that imply raw model output or retained completions.

### Better Prompt Generation

The better prompt should be deterministic and template-based.

Preferred behavior:

- derive a rewrite from the existing issue labels and weak categories
- keep the rewrite local and predictable
- focus on structure, context, constraints, output format, and task clarity
- do not depend on an external AI service

If the deterministic rewrite is too generic, keep the template conservative rather than introducing hidden heuristics.

## Privacy Design

### What May Appear

- Original prompt text or excerpt, if redacted/masked first
- Better prompt versions
- Coaching explanations
- Scores, labels, and habit guidance

### What Must Be Masked

Mask sensitive spans in displayed prompt examples, including:

- API keys and tokens
- passwords and password-like strings
- private keys
- credentials
- private hostnames or internal service names
- customer data and obvious private identifiers

Suggested placeholder text for markdown and CLI:

- `[REDACTED_SECRET]`
- `[REDACTED_PASSWORD]`
- `[REDACTED_TOKEN]`
- `[REDACTED_INTERNAL_HOST]`
- `[REDACTED_CUSTOMER_DATA]`

### What Must Never Appear

- full model answers
- banned full-answer fields
- raw safety warning text
- matched secret substrings
- raw stack traces
- raw exception text

### Compatibility With Existing Contracts

The existing `prompt_text` field can remain in internal pipeline contracts if that is already part of the codebase. The report-facing output should not expose raw sensitive content, but it may show safe prompt excerpts or masked originals where appropriate.

## Renderer Design

### Section Builders

The report renderer should gain new deterministic builders for:

- score summary / batch verdict
- category scorecard
- prompt example cards
- roast highlight
- copy-worthy prompt highlight
- model waste / overkill note
- safety/privacy teaching note
- top fixes checklist

### Markdown Rendering

The markdown serializer should render the structured report cleanly without dumping raw JSON.

Expected shapes:

- short metric lists for scores
- bullet cards for examples
- numbered top fixes list
- compact coaching notes

### Sorting and Capping

Keep all ordering deterministic:

- worst score first where appropriate
- strongest example selected deterministically
- stable tiebreakers by prompt id or label key
- reasonable caps so the report stays readable

## CLI Design

The CLI should remain a thin wrapper.

For demo mode, it may request prompt examples from the local pipeline so the report can teach with synthetic examples.

For file/user mode, it should continue to run locally and feed the report renderer enough information to produce redacted examples.

If a later CLI flag is introduced for opting out of examples, it should be explicit and local-first. The first runtime wave does not need that flag unless tests show a real need.

## Data Contract Changes

Likely additions:

- `overall_score_100`
- `category_scores_100`
- `ScoreBand`
- `PromptExampleCard`
- `TopFixItem`

Likely report-section additions:

- `batch_verdict`
- `prompt_habit_score`
- `category_scorecard`
- `prompt_examples`
- `roast_of_the_batch`
- `model_waste`
- `safety_privacy_lessons`
- `copy_worthy_prompt`
- `top_fixes`

## Implementation Waves

### 12B - Score Foundation

Implement score conversion, bands, section scaffolding, and tests for the new score/report contract.

### 12C - Examples and Redaction

Implement redacted examples, better prompts, roast, copy-worthy prompt, model waste, and privacy tests.

### 12D - Copy and Docs Polish

Tune the coaching copy, update docs, and perform final demo review.

## Non-Goals

- External AI rewriting or judging
- Cloud storage or sync
- Auth/login/billing
- Browser extension
- New packages unless later approved
- Full model-answer storage
- PDF/DOCX output
- Telemetry or network calls

## Verification Strategy

The implementation should be tested with:

- deterministic score conversion tests
- example selection tests
- redaction/masking tests
- privacy regression tests for banned fields
- markdown structure tests
- CLI demo/file mode smoke tests

## Design Recommendation

This design intentionally keeps the first implementation wave narrow: lock the spec, then implement the score foundation before the more sensitive example/redaction work.
