# 08-rewrite-template-system Requirements

## Introduction

08-rewrite-template-system defines the local-first, deterministic rewrite suggestion and template generation layer for cookedPrompts. It turns prompt scores, issue labels, safety signals, and model recommendation signals into structured coaching guidance and reusable prompt templates without using an LLM.

The system coaches the user by producing structured guidance — what to add, remove, or change in a prompt — organized by issue label and scored dimension. It does not produce polished AI rewrites. The output helps users understand WHAT to improve: context, constraints, examples, output format, safety/privacy, model fit, and task decomposition.

Templates are reusable, generic, privacy-safe patterns derived from identified prompt weaknesses. They contain no prompt text, no matched secrets, and no sensitive substrings.

Product principle: Roast the prompt. Coach the user. Improve the habit.

## Glossary

- **Rewrite_Engine**: The deterministic, rule-based module that produces structured rewrite suggestions from scored prompt data.
- **Template_Generator**: The deterministic, rule-based module that produces reusable generic prompt templates from identified patterns.
- **Rewrite_Suggestion**: A structured guidance object describing what to improve in a prompt, organized by issue label and dimension.
- **Prompt_Template**: A reusable, generic, privacy-safe prompt pattern that addresses a common weakness category.
- **Guidance_Item**: A single actionable coaching tip within a rewrite suggestion, containing what to add/remove/change, severity, and explanation.
- **Issue_Label**: A stable scoring issue label from the scoring engine (type `ScoringIssueLabel`).
- **PromptScore**: The public scoring output for a single prompt log, containing dimension scores and issue labels.
- **SafetyScanResult**: The value-free output of a local safety scan, containing warning categories and severities.
- **ModelRecommendation**: The public recommendation output containing capability class, effort, postures, and explanations.
- **Prompt_Text**: The raw user prompt content, used locally for rewrite context but never stored in suggestion or template output.

## Requirements

### Requirement 1: Rewrite Suggestion Input

**User Story:** As a user, I want the rewrite engine to accept my prompt score, safety results, model recommendation, and prompt text, so that it can produce targeted coaching guidance.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL accept a rewrite input object containing: prompt_score (required), prompt_text (required), safety_result (optional), and model_recommendation (optional).
2. WHEN prompt_score is provided, THE Rewrite_Engine SHALL use issue_labels, dimension scores, explanations, and confidence to generate guidance.
3. WHEN safety_result is provided, THE Rewrite_Engine SHALL incorporate safety warning categories and severities into guidance.
4. WHEN model_recommendation is provided, THE Rewrite_Engine SHALL incorporate capability class, effort level, and cost/speed posture into guidance.
5. THE Rewrite_Engine SHALL NOT accept full model answer fields (assistant_message, response, completion, model_answer, output_text, generated_text).

### Requirement 2: Structured Rewrite Suggestion Output

**User Story:** As a user, I want to receive structured coaching guidance that tells me exactly what to improve in my prompt, so that I can fix weaknesses without relying on an AI to rewrite it for me.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL produce a rewrite suggestion object containing: prompt_log_id, guidance items (one or more), overall priority, overall severity, summary explanation, engine version, and created_at timestamp.
2. WHEN issue_labels are present in the prompt score, THE Rewrite_Engine SHALL produce at least one guidance item per issue label.
3. THE Rewrite_Engine SHALL assign each guidance item a severity (low, medium, high, critical) and a priority rank.
4. THE Rewrite_Engine SHALL include a plain-language explanation in each guidance item describing what to add, remove, or change.
5. THE Rewrite_Engine SHALL tag each guidance item with the dimension it relates to (clarity, context, constraints, output_format, capability_fit, efficiency, safety_privacy).
6. THE Rewrite_Engine SHALL produce an empty guidance list when the prompt has no issue labels and all dimension scores are 4 or above.

### Requirement 3: Issue-Label-to-Guidance Mapping

**User Story:** As a user, I want each identified prompt weakness to map to specific, actionable coaching advice, so that I know exactly what to fix.

#### Acceptance Criteria

1. WHEN the issue label is missing_context, THE Rewrite_Engine SHALL produce guidance recommending the user add domain context, background, or relevant data.
2. WHEN the issue label is unclear_task, THE Rewrite_Engine SHALL produce guidance recommending the user clarify the task objective and expected output.
3. WHEN the issue label is missing_constraints, THE Rewrite_Engine SHALL produce guidance recommending the user specify constraints such as length, tone, format, or boundaries.
4. WHEN the issue label is missing_output_format, THE Rewrite_Engine SHALL produce guidance recommending the user define the expected output structure (JSON, list, paragraph, code, table).
5. WHEN the issue label is overbroad_prompt, THE Rewrite_Engine SHALL produce guidance recommending the user decompose the task into smaller, focused sub-prompts.
6. WHEN the issue label is privacy_risk, THE Rewrite_Engine SHALL produce guidance warning the user to remove or redact sensitive data before sending the prompt externally.
7. WHEN the issue label is possible_secret, THE Rewrite_Engine SHALL produce guidance warning the user to remove secrets and use placeholder references instead.
8. WHEN the issue label is wrong_model_class, THE Rewrite_Engine SHALL produce guidance recommending the user consider a different model capability class for this task.
9. WHEN the issue label is overpowered_model, THE Rewrite_Engine SHALL produce guidance suggesting the user can use a cheaper or faster model for this task complexity.
10. WHEN the issue label is needs_search, THE Rewrite_Engine SHALL produce guidance recommending the user request search grounding or provide source references.
11. WHEN the issue label is needs_tool_use, THE Rewrite_Engine SHALL produce guidance recommending the user invoke a tool or structured workflow instead of asking the model directly.
12. WHEN the issue label is too_long_for_task, THE Rewrite_Engine SHALL produce guidance recommending the user trim unnecessary content and focus the prompt on the core task.

### Requirement 4: Safety-Sensitive Rewrite Constraints

**User Story:** As a privacy-conscious user, I want safety and privacy warnings to take priority over rewrite convenience, so that my sensitive data is protected before any other coaching applies.

#### Acceptance Criteria

1. WHEN safety_result contains warnings with severity critical or high, THE Rewrite_Engine SHALL place safety/privacy guidance items first in priority order.
2. WHEN safety_result indicates a do_not_route_until_redacted posture (via model_recommendation safety_posture), THE Rewrite_Engine SHALL produce redaction-first guidance before any other improvement advice.
3. WHEN safety_result contains a citation_needed category, THE Rewrite_Engine SHALL produce guidance requiring the user add source citations or reference materials.
4. WHEN safety_result contains a prompt_injection category, THE Rewrite_Engine SHALL produce guidance warning the user about injection risk and recommending defensive prompt structure.
5. THE Rewrite_Engine SHALL NOT produce guidance that encourages the user to keep sensitive data in a prompt for the sake of improved clarity or context scores.

### Requirement 5: Model Recommendation Integration

**User Story:** As a user, I want rewrite guidance to reflect the model recommendation cost and effort signals, so that I understand whether to simplify my prompt for a cheaper model or add detail for a more capable one.

#### Acceptance Criteria

1. WHEN model_recommendation indicates minimize_cost posture, THE Rewrite_Engine SHALL include guidance suggesting the user simplify the prompt to work with a cheaper model class.
2. WHEN model_recommendation indicates the prompt is overpowered for the task, THE Rewrite_Engine SHALL include guidance explaining that a simpler model suffices and the prompt can be shortened.
3. WHEN model_recommendation indicates frontier_reasoning class, THE Rewrite_Engine SHALL include guidance noting the prompt warrants deep reasoning and the user should ensure constraints and context are thorough.
4. WHEN model_recommendation indicates local_or_open_weight class, THE Rewrite_Engine SHALL include guidance noting the prompt is suitable for a local/open model and the user should keep it concise for smaller context windows.

### Requirement 6: Template Suggestion Output

**User Story:** As a user, I want the system to suggest reusable prompt templates based on common weaknesses it detects, so that I can build better prompt habits over time.

#### Acceptance Criteria

1. THE Template_Generator SHALL produce template suggestion objects containing: template_id, template_name, template_body (generic placeholder-based text), category_tags, applicable_issue_labels, description, generator_version, and created_at timestamp.
2. THE Template_Generator SHALL produce templates that are generic and reusable — containing placeholders (such as [TASK], [CONTEXT], [CONSTRAINTS], [OUTPUT_FORMAT]) instead of specific prompt content.
3. THE Template_Generator SHALL NOT include any prompt_text, matched secrets, or sensitive substrings in template output.
4. THE Template_Generator SHALL tag each template with one or more category tags (such as coding, writing, analysis, research, creative, data, communication).
5. THE Template_Generator SHALL link each template to the issue labels it addresses, so the user understands which weakness the template helps fix.
6. WHEN the prompt has issue labels missing_context and missing_output_format, THE Template_Generator SHALL suggest a template that includes placeholder sections for both context and output format.

### Requirement 7: Privacy and Safety Behavior

**User Story:** As a privacy-conscious user, I want the rewrite and template system to never leak my prompt text or secrets into its output, so that suggestion data is safe to store and export.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL NOT include prompt_text in the rewrite suggestion output object.
2. THE Rewrite_Engine SHALL NOT include matched secret substrings in any guidance item text.
3. THE Template_Generator SHALL NOT include prompt_text in template output.
4. THE Template_Generator SHALL NOT include matched secret substrings in template output.
5. THE Rewrite_Engine SHALL use prompt_text locally (in-memory) to inform guidance generation but SHALL NOT persist or serialize prompt_text into the suggestion object.
6. THE Rewrite_Engine SHALL NOT include banned full-answer fields (assistant_message, response, completion, model_answer, output_text, generated_text) in any output.
7. THE Template_Generator SHALL NOT include banned full-answer fields in any output.

### Requirement 8: Deterministic Local-First Behavior

**User Story:** As a developer, I want the rewrite and template system to be fully deterministic and local-first, so that the same input always produces the same output without network calls.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL produce identical output when given identical input (deterministic behavior).
2. THE Template_Generator SHALL produce identical output when given identical input (deterministic behavior).
3. THE Rewrite_Engine SHALL NOT make network calls, cloud requests, or external API calls.
4. THE Template_Generator SHALL NOT make network calls, cloud requests, or external API calls.
5. THE Rewrite_Engine SHALL NOT use an LLM, AI model, or external service to generate rewrite suggestions.
6. THE Template_Generator SHALL NOT use an LLM, AI model, or external service to generate templates.
7. THE Rewrite_Engine SHALL use rule-based logic only — mapping issue labels and dimension scores to predefined guidance through deterministic rules.
8. THE Template_Generator SHALL use rule-based logic only — selecting and composing templates from a predefined local template catalog through deterministic rules.

### Requirement 9: Dimension-Specific Coaching Tips

**User Story:** As a user, I want coaching tips tied to specific scoring dimensions, so that I can target the weakest area of my prompt.

#### Acceptance Criteria

1. WHEN clarity_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to restate the task in a single clear sentence.
2. WHEN context_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to provide relevant background, domain, or data context.
3. WHEN constraints_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to add specific constraints (length, tone, boundaries, scope).
4. WHEN output_format_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to define the expected output structure.
5. WHEN capability_fit_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to reconsider the model class for this task.
6. WHEN efficiency_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to trim unnecessary content or decompose the prompt.
7. WHEN safety_privacy_score is 0 or 1, THE Rewrite_Engine SHALL produce a guidance item advising the user to review and redact sensitive content.
8. WHEN all dimension scores are 4 or 5 and no issue labels are present, THE Rewrite_Engine SHALL produce no dimension-specific guidance items.

### Requirement 10: Dashboard/CLI/Export Integration Boundary

**User Story:** As a developer, I want clear integration boundaries so that future display and export features can consume rewrite and template data without coupling to this spec.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL expose a public function API that returns structured suggestion objects suitable for future dashboard, CLI, or export consumption.
2. THE Template_Generator SHALL expose a public function API that returns structured template objects suitable for future dashboard, CLI, or export consumption.
3. THE Rewrite_Engine SHALL NOT implement dashboard UI, CLI display, or file export in this spec.
4. THE Template_Generator SHALL NOT implement dashboard UI, CLI display, or file export in this spec.
5. THE Rewrite_Engine SHALL NOT implement persistence or storage of suggestions in this spec.
6. THE Template_Generator SHALL NOT implement persistence or storage of templates in this spec.

### Requirement 11: Non-Goals

**User Story:** As a developer, I want explicit non-goals documented so that scope remains clear and future agents do not over-build.

#### Acceptance Criteria

1. THE Rewrite_Engine SHALL NOT generate polished LLM-written rewrites of prompts.
2. THE Rewrite_Engine SHALL NOT call any external AI model, provider API, or cloud service.
3. THE Rewrite_Engine SHALL NOT implement cloud sync, telemetry, or analytics.
4. THE Rewrite_Engine SHALL NOT persist suggestions to SQLite or any storage layer in this spec.
5. THE Rewrite_Engine SHALL NOT implement a dashboard UI or web interface in this spec.
6. THE Template_Generator SHALL NOT store full model answers or prompt text.
7. THE Rewrite_Engine SHALL NOT add any npm packages.
8. THE Template_Generator SHALL NOT add any npm packages.

## Non-Goals (Summary)

- No LLM rewrite generation
- No provider calls or external AI
- No cloud sync or telemetry
- No persistence or storage in this spec
- No dashboard UI or web interface in this spec
- No CLI display in this spec
- No file export in this spec
- No npm package additions
- No full model answer storage
- No prompt_text leakage into output
- No matched secret substrings in output
- No raw parsed rows in output

## Open Questions

- OQ-1: Should the template catalog be a static predefined set or should it grow based on observed issue-label frequency? Working assumption: static predefined catalog in V1; dynamic growth deferred to V2.
- OQ-2: Should guidance items include before/after example snippets using generic placeholder text? Working assumption: yes, using placeholder-only examples to illustrate improvements without exposing real prompt text.
- OQ-3: Should the rewrite engine produce a numeric "improvement potential" score estimating how much the overall score would improve if guidance is followed? Working assumption: defer to V2; V1 uses priority/severity only.
- OQ-4: Should templates be composable (multiple templates chained for a single prompt)? Working assumption: V1 suggests individual templates per issue; composition is a V2 feature.
- OQ-5: How many templates should the initial catalog contain? Working assumption: one template per issue label category (12 templates minimum), plus 3–5 cross-cutting templates for common multi-issue patterns.

## Acceptance Criteria (Spec-Planning Pass)

For the requirements pass:

- requirements.md created with EARS-pattern acceptance criteria
- all issue labels mapped to guidance
- privacy/safety boundaries defined
- deterministic/local-first behavior specified
- non-goals explicitly documented
- HANDOFF.md updated
- CHANGELOG.md updated
- typecheck/test baseline remains unchanged (31 files, 483 tests)
