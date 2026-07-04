# Requirements Document

## Introduction

The Demo Report Renderer is a local-first, deterministic module that transforms `UnifiedDemoOutput` (produced by the 09-integration-demo-flow pipeline) into a structured, human-readable coaching report. The report surfaces prompt habit patterns, safety posture, model fit, and coaching actions in the "20 Prompts Later: Your AI Habits Exposed" demo theme.

This module is a pure renderer. It does not re-score, re-scan, call AI, or perform network operations. It accepts structured data and produces a structured report object with optional markdown string output for local file export.

Product tone: "Roast the prompt. Coach the user. Improve the habit." — direct, useful, slightly playful coaching. Never insulting, never generic.

## Glossary

- **Report_Renderer**: The pure function module that accepts UnifiedDemoOutput and render options, producing a structured DemoReport.
- **UnifiedDemoOutput**: The complete pipeline output from 09-integration-demo-flow containing prompt_results, batch_summary, metadata, and optional error.
- **DemoReport**: The structured report output containing title, summary, sections array, and optional markdown string.
- **ReportSection**: A named section within DemoReport containing a heading, body data, and optional coaching notes.
- **RenderOptions**: Configuration object controlling report rendering behavior. `include_prompt_text` is accepted for future API compatibility but ignored in V1.
- **BatchSummary**: Aggregate statistics from UnifiedDemoOutput including averages, issue counts, safety summary, and model distribution.
- **PipelineMetadata**: Pipeline run metadata including versions, timing, and input source.
- **PromptResult**: Per-prompt result containing score, safety, model recommendation, rewrite, and template data.
- **CoachingAction**: A prioritized actionable recommendation derived from batch patterns.
- **Markdown_Exporter**: The internal formatting logic that serializes DemoReport sections into a markdown string.

## Requirements

### Requirement 1: Report Rendering Entry Point

**User Story:** As a developer consuming UnifiedDemoOutput, I want a single pure function entry point that produces a structured coaching report, so that I can render demo results without managing multiple transformation steps.

#### Acceptance Criteria

1. THE Report_Renderer SHALL expose a single public function `renderDemoReport(input: UnifiedDemoOutput, options?: RenderOptions): DemoReport`.
2. WHEN called with valid UnifiedDemoOutput, THE Report_Renderer SHALL return a DemoReport containing title, summary, sections, and metadata fields.
3. THE Report_Renderer SHALL be a pure function with no side effects, no file I/O, no network calls, and no mutation of the input object.
4. WHEN RenderOptions is omitted, THE Report_Renderer SHALL use default options producing a complete report without prompt_text and with markdown output included.

### Requirement 2: Input Contract

**User Story:** As a developer, I want the renderer to consume UnifiedDemoOutput exactly as produced by 09-integration-demo-flow, so that no intermediate transformation or re-scoring is needed.

#### Acceptance Criteria

1. THE Report_Renderer SHALL accept UnifiedDemoOutput as its sole data input without requiring additional data sources.
2. THE Report_Renderer SHALL not modify, re-score, re-scan, or enrich the input data.
3. THE Report_Renderer SHALL not import or call scoring, safety, model-recommendation, or rewrite-template engine functions.
4. WHEN UnifiedDemoOutput contains an error field, THE Report_Renderer SHALL produce a report reflecting the error state without attempting recovery.

### Requirement 3: Report Output Structure

**User Story:** As a developer, I want a well-defined report output structure, so that consumers can programmatically access report sections or render them in different formats.

#### Acceptance Criteria

1. THE Report_Renderer SHALL return a DemoReport object containing: title (string), summary (string), sections (ReportSection array), generated_at (string timestamp), and renderer_version (string).
2. WHEN include_markdown is true or defaulted, THE DemoReport SHALL include a markdown field containing the full report as a markdown-formatted string.
3. WHEN include_markdown is false, THE DemoReport SHALL omit the markdown field.
4. THE Report_Renderer SHALL produce sections in a fixed, deterministic order.

### Requirement 4: Batch Overview Section

**User Story:** As a user viewing my demo report, I want a quick batch overview showing total prompts analyzed, success rate, average score, and pipeline timing, so that I understand the scope of the analysis at a glance.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a batch overview section containing: total prompts analyzed, succeeded count, failed count, average overall score, and pipeline duration.
2. WHEN all prompts succeed, THE Report_Renderer SHALL display 100% success rate in the batch overview.
3. WHEN average_overall_score is null (no scored prompts), THE Report_Renderer SHALL display a "no scores available" indicator rather than zero.
4. THE Report_Renderer SHALL derive pipeline timing from PipelineMetadata.total_duration_ms.

### Requirement 5: Score and Prompt Health Section

**User Story:** As a user, I want to see dimension averages and score distribution patterns, so that I understand which aspects of my prompting are strongest and weakest.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a score health section containing dimension averages from BatchSummary.dimension_averages.
2. THE Report_Renderer SHALL rank dimensions from weakest to strongest average score.
3. WHEN a dimension average is null, THE Report_Renderer SHALL label that dimension as "not enough data" rather than displaying zero.
4. THE Report_Renderer SHALL include a coaching-tone summary sentence identifying the weakest one or two dimensions.

### Requirement 6: Issue Pattern Section

**User Story:** As a user, I want to see my most common prompt issues with frequency counts and coaching notes, so that I know which habits to fix first.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce an issue pattern section listing issues from BatchSummary.issue_label_counts sorted by frequency descending.
2. THE Report_Renderer SHALL include a deterministic coaching note for each issue label, derived from a static label-to-coaching-note mapping.
3. WHEN no issues are found (empty issue_label_counts), THE Report_Renderer SHALL display a positive coaching message acknowledging clean prompts.
4. THE Report_Renderer SHALL cap the displayed issues at a configurable maximum (default 10) to prevent report bloat.

### Requirement 7: Safety and Privacy Section

**User Story:** As a user, I want a clear safety posture summary showing how many prompts triggered warnings and their severity, so that I understand my privacy risk exposure.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a safety section containing: prompts_with_warnings count, do_not_send_external_count, and severity breakdown from BatchSummary.safety_summary.
2. WHEN do_not_send_external_count is greater than zero, THE Report_Renderer SHALL prominently flag these prompts with a coaching note about redaction before external use.
3. WHEN no safety warnings exist, THE Report_Renderer SHALL display a positive safety posture message.
4. THE Report_Renderer SHALL never include matched secret values, warning rule details that could reveal prompt content, or specific prompt text in the safety section.

### Requirement 8: Model Recommendation Section

**User Story:** As a user, I want to see the distribution of recommended model classes and cost posture patterns, so that I understand whether I am over-spending or under-powering my prompts.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a model recommendation section containing model_class_distribution from BatchSummary.
2. THE Report_Renderer SHALL sort model classes by frequency descending.
3. WHEN a single model class dominates (more than 70% of prompts), THE Report_Renderer SHALL include a coaching note about the usage pattern.
4. WHEN model_class_distribution is empty (no recommendations produced), THE Report_Renderer SHALL display a "no model recommendations available" indicator.

### Requirement 9: Rewrite and Template Coaching Section

**User Story:** As a user, I want to see common rewrite themes and most-suggested templates, so that I know which coaching patterns apply to my prompt habits.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a rewrite/template section summarizing coaching themes extracted from prompt_results rewrite and template suggestions.
2. THE Report_Renderer SHALL aggregate template suggestions by template_id, reporting the most frequently suggested templates (top 5 maximum).
3. THE Report_Renderer SHALL aggregate rewrite guidance severity levels, reporting the distribution of overall_severity values across prompts.
4. WHEN no rewrite suggestions or templates exist in prompt_results, THE Report_Renderer SHALL display a positive message indicating prompts need minimal coaching.

### Requirement 10: Next Actions Section

**User Story:** As a user, I want 3 to 5 prioritized coaching actions derived from my batch patterns, so that I have a clear next step to improve my prompt habits.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce a next actions section containing between 3 and 5 prioritized coaching actions.
2. THE Report_Renderer SHALL derive actions deterministically from batch patterns: top issues, safety posture, weakest dimensions, and model fit.
3. THE Report_Renderer SHALL order actions by priority: safety-related actions first, then issue frequency, then dimension weakness.
4. WHEN fewer than 3 distinct action sources exist, THE Report_Renderer SHALL pad with general coaching encouragement actions to reach a minimum of 3.
5. THE Report_Renderer SHALL assign each action a priority rank (1 being highest) and a short actionable description.

### Requirement 11: Markdown Output Support

**User Story:** As a user, I want the report rendered as markdown for local file export, so that I can save and share my coaching report as a readable document.

#### Acceptance Criteria

1. WHEN include_markdown is true or defaulted, THE Markdown_Exporter SHALL produce a valid markdown string representing the full DemoReport.
2. THE Markdown_Exporter SHALL use heading levels (h1 for title, h2 for sections, h3 for subsections) to structure the output.
3. THE Markdown_Exporter SHALL format numerical data in readable tables or bullet lists rather than raw JSON.
4. THE Markdown_Exporter SHALL include the report title "20 Prompts Later: Your AI Habits Exposed" as the top-level heading when using the default demo theme.
5. THE Markdown_Exporter SHALL produce identical markdown output for identical DemoReport input (deterministic serialization).

### Requirement 12: Privacy Guarantees

**User Story:** As a user, I want assurance that the coaching report never contains my raw prompt text, secrets, or banned fields by default, so that the report is safe to save and share.

#### Acceptance Criteria

1. THE Report_Renderer SHALL not include prompt_text in any report section.
2. THE Report_Renderer SHALL accept include_prompt_text for future API compatibility, but ignore it in V1. The report must never include raw prompt_text, even when include_prompt_text is true.
3. THE Report_Renderer SHALL not include any values from banned output fields (assistant_message, response, completion, model_answer, output_text, generated_text) in the report.
4. THE Report_Renderer SHALL not include matched secret substrings or raw safety warning patterns that could reveal sensitive content.
5. THE Report_Renderer SHALL produce content-free error messages only (step name, no stack traces, no prompt content).

### Requirement 13: Determinism

**User Story:** As a developer, I want identical input to produce identical output, so that tests are repeatable and reports are reproducible.

#### Acceptance Criteria

1. THE Report_Renderer SHALL produce identical DemoReport output for identical UnifiedDemoOutput input and identical RenderOptions.
2. THE Report_Renderer SHALL accept an injectable `now` function in RenderOptions for timestamp generation.
3. THE Report_Renderer SHALL not depend on system clock, random values, or external state beyond the provided input and options.
4. THE Report_Renderer SHALL use stable sorting algorithms for all ordered output (dimensions, issues, model classes, actions).

### Requirement 14: Error Handling

**User Story:** As a developer, I want the renderer to handle partial or empty UnifiedDemoOutput gracefully, so that the report always produces usable output regardless of pipeline failures.

#### Acceptance Criteria

1. WHEN UnifiedDemoOutput.prompt_results is empty, THE Report_Renderer SHALL produce a valid report with zero-count sections and a coaching message acknowledging no data.
2. WHEN UnifiedDemoOutput.error is present, THE Report_Renderer SHALL include the content-free error in the report summary and still produce all available sections.
3. WHEN individual prompt_results contain partial data (missing score, safety, or recommendations), THE Report_Renderer SHALL exclude those prompts from the relevant section aggregations without failing.
4. IF an unexpected field shape is encountered, THEN THE Report_Renderer SHALL skip the malformed field and continue rendering remaining sections.
5. THE Report_Renderer SHALL never throw an unhandled exception; all rendering failures produce a valid DemoReport with appropriate error indication.

### Requirement 15: Non-Goals and Deferred Work

**User Story:** As a project maintainer, I want explicit boundaries on what this module does not do, so that scope remains controlled and future work is clearly separated.

#### Acceptance Criteria

1. THE Report_Renderer SHALL not implement any web UI, browser rendering, or interactive display.
2. THE Report_Renderer SHALL not make network calls, cloud API requests, or telemetry transmissions.
3. THE Report_Renderer SHALL not require or implement authentication, authorization, or billing logic.
4. THE Report_Renderer SHALL not invoke LLM or AI services for narrative generation; all report text is deterministic and rule-based.
5. THE Report_Renderer SHALL not write files to disk; file I/O is the caller's responsibility.
6. THE Report_Renderer SHALL not add new package dependencies unless explicitly approved.
