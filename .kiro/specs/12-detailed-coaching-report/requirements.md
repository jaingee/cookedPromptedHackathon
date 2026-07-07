# Requirements Document

## Introduction

The Detailed Coaching Report upgrades the existing cookedPrompts demo report into a more useful, memorable prompt coach. The report should stay deterministic, local-first, and privacy-safe, but it should now teach through concrete examples instead of only aggregate summaries.

This spec does not add cloud sync, auth, telemetry, provider calls, or external AI judging. It extends the local report and CLI pipeline so the user can see why prompts underperformed, what a better version looks like, and what habit to build next.

## Glossary

- **Detailed Report**: The upgraded markdown coaching report for spec 12.
- **Prompt Example Card**: A report item that shows a redacted original prompt, what went wrong, a better prompt, and why the improvement works.
- **Prompt Habit Score**: The overall 0-100 headline score for the batch.
- **Category Scorecard**: The 0-100 score breakdown for Clarity, Context, Constraints, Output Format, Model Fit, Efficiency, and Safety & Privacy.
- **Redacted Prompt**: A prompt excerpt with sensitive spans masked before display.
- **Better Prompt**: A deterministic local rewrite of the original prompt that improves clarity, structure, or safety without using an external model.
- **Roast of the Batch**: The most memorable but still constructive roast line for the worst prompt or worst prompt cluster in the batch.
- **One Good Prompt Worth Copying**: A strong prompt example selected to reinforce the right habits.

## Requirements

### Requirement 1: Overall Coaching Report

**User Story:** As a local user, I want the report to feel like a coach, not just an analytics dump, so I can quickly understand what went wrong and how to improve.

#### Acceptance Criteria

1. WHEN the report is rendered, THE report SHALL include a headline batch verdict that summarizes the batch in a coach-like tone.
2. THE report SHALL include an overall Prompt Habit Score on a 0-100 scale.
3. THE report SHALL include a score interpretation band for the overall score, such as Poor, Okay, Good, or Excellent.
4. THE report SHALL keep the tone playful and direct without insulting the user.

### Requirement 2: Category Scorecard

**User Story:** As a user, I want to see where my prompts are weak and strong, so I can improve the right habit instead of guessing.

#### Acceptance Criteria

1. THE report SHALL include a Category Scorecard with the categories Clarity, Context, Constraints, Output Format, Model Fit, Efficiency, and Safety & Privacy.
2. THE report SHALL display each category as a 0-100 score.
3. THE report SHALL include human-readable bands or labels for each category score.
4. THE report SHALL derive the 0-100 values from the existing scoring data in a deterministic way.

### Requirement 3: Prompt Examples and Better Versions

**User Story:** As a user, I want to see real examples and an improved version, so I can learn exactly how to fix my prompts.

#### Acceptance Criteria

1. THE report SHALL include prompt example cards that show a redacted original prompt or prompt excerpt.
2. THE report SHALL include an explanation of what went wrong for each example card.
3. THE report SHALL include a better prompt version for each example card.
4. THE report SHALL include a short explanation of why the better prompt works.
5. THE report SHALL include a habit-to-build note for each example card.
6. THE report SHALL select example cards deterministically from local data.
7. WHEN the input is demo mode, THE report MAY show synthetic example prompts more freely because the data is already mocked.
8. WHEN the input is file or user mode, THE report SHALL still show prompt examples locally, but it SHALL redact or mask sensitive content before display.

### Requirement 4: Roast of the Batch

**User Story:** As a user, I want one memorable roast that is still useful, so the lesson sticks.

#### Acceptance Criteria

1. THE report SHALL include a Roast of the Batch section or equivalent callout.
2. THE roast SHALL be based on a real batch pattern, not random copy.
3. THE roast SHALL target the prompt or workflow, not the person.
4. THE roast SHALL remain constructive and coaching-oriented.

### Requirement 5: Model Waste / Overkill

**User Story:** As a user, I want to know when I overused model power, so I can stop wasting time or cost on simple tasks.

#### Acceptance Criteria

1. THE report SHALL include a model waste or overkill coaching section.
2. THE section SHALL explain when a task looks overpowered for the chosen model class.
3. THE section SHALL explain when the task likely needed a stronger model class.
4. THE report SHALL keep the recommendation vendor-neutral and local.

### Requirement 6: Safety and Privacy Lessons

**User Story:** As a user, I want to learn when my prompts are risky, so I can redact sensitive content before reusing or exporting them.

#### Acceptance Criteria

1. THE report SHALL include a safety and privacy lesson section.
2. THE section SHALL explain what kind of sensitive content was found without exposing matched secret values.
3. THE report SHALL mask sensitive spans in any displayed prompt example.
4. THE report SHALL not include full model answers or assistant completions.

### Requirement 7: One Good Prompt Worth Copying

**User Story:** As a user, I want to copy one good example, so the report shows me what "good" looks like.

#### Acceptance Criteria

1. THE report SHALL include one good prompt worth copying.
2. THE example SHALL be selected deterministically from the local batch.
3. THE example SHALL be redacted or masked if it contains sensitive spans.
4. THE section SHALL explain why the prompt is strong.

### Requirement 8: Top Fixes Checklist

**User Story:** As a user, I want a short checklist, so I can leave with clear next actions.

#### Acceptance Criteria

1. THE report SHALL include a top fixes checklist with the highest-value habit changes.
2. THE checklist SHALL be ordered by coaching impact or priority.
3. THE checklist SHALL be short enough to scan quickly.

### Requirement 9: Privacy and Output Safety

**User Story:** As a privacy-conscious user, I want prompt examples to be safe, so the local report never leaks secrets or model answers.

#### Acceptance Criteria

1. THE report SHALL not include full model answers or assistant completions.
2. THE report SHALL not include banned full-answer fields in report output: `assistant_message`, `response`, `completion`, `model_answer`, `output_text`, `generated_text`, `template_body`.
3. THE report SHALL redact or mask sensitive spans such as keys, passwords, tokens, credentials, private hostnames, and private customer data.
4. THE report SHALL not expose raw safety warning text or matched secret values.
5. THE report SHALL keep all processing local and offline.
6. THE report SHALL not require a network call or external AI judge.

### Requirement 10: Determinism and Testability

**User Story:** As a maintainer, I want the report to stay deterministic, so I can test it and trust it.

#### Acceptance Criteria

1. THE report SHALL produce the same output for the same input and options.
2. THE report SHALL support deterministic example selection.
3. THE report SHALL support deterministic prompt rewrite generation.
4. THE report SHALL include tests for score conversion, example selection, redaction, and report structure.

### Requirement 11: Compatibility

**User Story:** As a maintainer, I want the upgrade to stay local and reviewable, so it fits the existing architecture.

#### Acceptance Criteria

1. THE report SHALL remain a local deterministic renderer and not add cloud dependencies.
2. THE report SHALL preserve the existing public renderer API where practical.
3. THE report SHALL avoid new packages unless explicitly approved later.
4. THE CLI SHALL continue to produce markdown output that can be saved or printed locally.
