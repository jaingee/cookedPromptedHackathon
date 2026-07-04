# Requirements Document

## Introduction

The integration demo flow is a local-first orchestration layer that connects all completed V1 engines (importer, storage, scoring, scoring-persistence, dashboard, safety/redaction, model recommendation, rewrite/template) into one coherent, demoable pipeline. A single entry point accepts imported prompt logs and produces a unified structured output containing per-prompt coaching results and a batch-level summary.

This spec defines the orchestration boundary and the unified output shape. It does not implement a polished web UI, cloud service, authentication, or billing. The demo answers: Which prompts are weak? Why? What safety issues exist? What model class is recommended? What should the user change? Which templates help? What is the batch coaching summary?

## Glossary

- **Demo_Orchestrator**: The top-level pipeline function that accepts prompt log input and coordinates all V1 engines to produce unified output.
- **Pipeline_Step**: A single stage in the orchestration sequence (import, store, score, persist scores, scan safety, recommend model, generate rewrite guidance, suggest templates).
- **Prompt_Result**: The per-prompt structured output containing score, issue labels, safety warnings, model recommendation, rewrite guidance, and template suggestions for one prompt.
- **Batch_Summary**: The aggregate structured output across all processed prompts containing average scores, common issues, safety posture, and model class distribution.
- **Unified_Output**: The complete structured result containing all Prompt_Results plus the Batch_Summary plus pipeline metadata.
- **Demo_Dataset**: The existing synthetic dataset of approximately 20 prompts used for demonstration purposes.
- **Partial_Result**: A valid Unified_Output where some prompts encountered per-prompt errors but the pipeline continued and produced results for remaining prompts.
- **Pipeline_Options**: Injectable configuration for deterministic testing including clock, ID factory, and database path.

## Requirements

### Requirement 1: Single Entry Point Orchestration

**User Story:** As a developer, I want a single function call that runs the full coaching pipeline on a set of prompt logs, so that I can demonstrate the complete V1 loop without manually wiring each engine.

#### Acceptance Criteria

1. WHEN a set of normalized PromptLogEntry records is provided, THE Demo_Orchestrator SHALL execute the pipeline in order: store → score → persist scores → scan safety → recommend model → generate rewrite guidance → suggest templates.
2. WHEN a file path and source type are provided instead of pre-normalized entries, THE Demo_Orchestrator SHALL import and normalize the file using the local importer before executing the pipeline.
3. WHEN the demo dataset flag is set, THE Demo_Orchestrator SHALL load the built-in demo dataset using loadDemoDataset and execute the pipeline on it.
4. THE Demo_Orchestrator SHALL return a single Unified_Output object containing all Prompt_Results and the Batch_Summary.
5. THE Demo_Orchestrator SHALL accept Pipeline_Options for injectable clock, ID factory, and database path to support deterministic testing.

### Requirement 2: Engine Integration via Public API Only

**User Story:** As a developer, I want the orchestrator to consume each engine exclusively through its public module boundary, so that integration does not bypass internal implementation details.

#### Acceptance Criteria

1. THE Demo_Orchestrator SHALL import the local importer module only through the public exports of `src/importers/local/index.ts`.
2. THE Demo_Orchestrator SHALL import the SQLite storage module only through the public exports of `src/storage/sqlite/index.ts`.
3. THE Demo_Orchestrator SHALL import the scoring module only through the public exports of `src/scoring/index.ts`.
4. THE Demo_Orchestrator SHALL import the scoring-persistence module only through the PromptScoreRepository exported from `src/storage/sqlite/repositories/prompt-score-repository.ts`.
5. THE Demo_Orchestrator SHALL import the dashboard module only through the public exports of `src/dashboard/index.ts`.
6. THE Demo_Orchestrator SHALL import the safety module only through the public exports of `src/safety/index.ts`.
7. THE Demo_Orchestrator SHALL import the model recommendation module only through the public exports of `src/model-recommendation/index.ts`.
8. THE Demo_Orchestrator SHALL import the rewrite/template module only through the public exports of `src/rewrite-template/index.ts`.

### Requirement 3: Prompt-Level Result Shape

**User Story:** As a developer demoing the system, I want each prompt to have a structured result containing all coaching insights, so that I can display or export per-prompt analysis.

#### Acceptance Criteria

1. THE Prompt_Result SHALL contain the prompt_log_id referencing the source prompt.
2. THE Prompt_Result SHALL contain the PromptScore with overall score, dimension scores, issue labels, explanations, and confidence.
3. THE Prompt_Result SHALL contain the SafetyScanResult with value-free warnings, highest severity, and scanner version.
4. THE Prompt_Result SHALL contain the ModelRecommendation with recommended class, effort, postures, explanation, candidate families, and optional estimated cost.
5. THE Prompt_Result SHALL contain the RewriteSuggestion with guidance items, overall severity, overall priority, and summary.
6. THE Prompt_Result SHALL contain the TemplateSuggestion with suggested templates.
7. THE Prompt_Result SHALL contain an error field that is null on success or a content-free error message on per-prompt failure.
8. IF a per-prompt pipeline step fails, THEN THE Prompt_Result SHALL contain partial results from completed steps and a content-free error message identifying the failing step.

### Requirement 4: Batch-Level Summary Shape

**User Story:** As a developer demoing the system, I want an aggregate summary across all prompts, so that I can show coaching insights at the batch level.

#### Acceptance Criteria

1. THE Batch_Summary SHALL contain the total number of prompts processed and the number that succeeded.
2. THE Batch_Summary SHALL contain the average overall score across all successfully scored prompts.
3. THE Batch_Summary SHALL contain per-dimension average scores (clarity, context, constraints, output_format, capability_fit, efficiency, safety_privacy).
4. THE Batch_Summary SHALL contain a frequency count of each ScoringIssueLabel across all prompts.
5. THE Batch_Summary SHALL contain a safety posture summary: total prompts with warnings, count by severity level, count of do_not_send_external prompts.
6. THE Batch_Summary SHALL contain a model class distribution: count of each recommended ModelCapabilityClass across all prompts.
7. THE Batch_Summary SHALL contain a list of the most common issue labels sorted by frequency descending.
8. THE Batch_Summary SHALL NOT contain any prompt_text, matched secret substrings, or banned full-answer fields.

### Requirement 5: Safety and Privacy Priority Behavior

**User Story:** As a user, I want safety and privacy findings to always outrank demo polish, so that dangerous prompts are flagged prominently regardless of other scores.

#### Acceptance Criteria

1. WHEN a prompt receives a safety severity of critical or high, THE Prompt_Result SHALL place safety warnings before other coaching insights in the structured output ordering.
2. WHEN a prompt receives a safety_posture of do_not_route_until_redacted, THE Prompt_Result SHALL include a prominent do_not_send_external flag set to true.
3. WHEN a prompt receives a safety_posture of do_not_route_until_redacted, THE Batch_Summary SHALL increment the do_not_send_external count.
4. THE Unified_Output SHALL NOT contain any prompt_text in the Batch_Summary or in any aggregate field.
5. THE Unified_Output SHALL NOT contain matched secret substrings in any field at any level.
6. THE Unified_Output SHALL NOT contain any banned full-answer fields (assistant_message, response, completion, model_answer, output_text, generated_text) at any level.

### Requirement 6: Rewrite and Template Inclusion

**User Story:** As a developer demoing the coaching loop, I want each prompt result to include structured rewrite guidance and template suggestions, so that the demo shows actionable coaching.

#### Acceptance Criteria

1. WHEN a prompt is successfully scored, THE Demo_Orchestrator SHALL generate a RewriteSuggestion using the scored output, safety result, and model recommendation as input.
2. WHEN a prompt is successfully scored, THE Demo_Orchestrator SHALL generate a TemplateSuggestion using the prompt score issue labels.
3. THE Prompt_Result rewrite_suggestion field SHALL contain guidance items with severity, priority, action, explanation, and optional generic examples.
4. THE Prompt_Result template_suggestion field SHALL contain suggested templates with bracket placeholders only.
5. THE Prompt_Result rewrite and template outputs SHALL NOT contain prompt_text, matched secrets, or banned full-answer fields.

### Requirement 7: Model Recommendation Inclusion

**User Story:** As a developer demoing the coaching loop, I want each prompt result to include a model recommendation, so that the demo shows which model class the user should have used.

#### Acceptance Criteria

1. WHEN a prompt is successfully scored and safety-scanned, THE Demo_Orchestrator SHALL generate a ModelRecommendation using the prompt score and safety result.
2. THE Prompt_Result model_recommendation field SHALL contain recommended_class, recommended_effort, cost_speed_posture, privacy_posture, safety_posture, explanation, and candidate_families.
3. THE Prompt_Result model_recommendation field SHALL NOT contain prompt_text, matched safety values, banned full-answer fields, or live provider data.
4. WHEN user model constraints are provided in Pipeline_Options, THE Demo_Orchestrator SHALL pass the constraints to the model recommendation engine.

### Requirement 8: Local Demo Dataset Support

**User Story:** As a developer, I want to run the demo pipeline on the built-in synthetic dataset without importing a file, so that I can demonstrate the system without requiring user data.

#### Acceptance Criteria

1. WHEN the demo mode flag is set, THE Demo_Orchestrator SHALL load the built-in demo dataset using the loadDemoDataset function from the importer module.
2. WHEN a user-provided file path is given, THE Demo_Orchestrator SHALL import and normalize it using the local importer public API.
3. THE Demo_Orchestrator SHALL support both JSONL and CSV source types for file-based input.
4. THE Demo_Orchestrator SHALL produce identical Unified_Output shape regardless of whether the input is demo dataset or user-imported file.

### Requirement 9: Error Handling and Partial Results

**User Story:** As a developer, I want the pipeline to continue processing remaining prompts when one prompt fails, so that a single bad prompt does not block the entire demo.

#### Acceptance Criteria

1. IF a per-prompt pipeline step throws an error, THEN THE Demo_Orchestrator SHALL catch the error and continue processing remaining prompts.
2. IF a per-prompt error occurs, THEN THE Demo_Orchestrator SHALL record a content-free error message (no prompt_text, no stack traces, no secrets) in the Prompt_Result error field.
3. IF a per-prompt error occurs, THEN THE Prompt_Result SHALL contain partial results from steps that completed before the failure.
4. THE Batch_Summary SHALL report total prompts attempted, total succeeded, and total failed.
5. IF all prompts fail, THEN THE Demo_Orchestrator SHALL still return a valid Unified_Output with an empty successful results list and a Batch_Summary reflecting zero successes.
6. IF the storage initialization fails, THEN THE Demo_Orchestrator SHALL return a top-level error in the Unified_Output rather than attempting per-prompt processing.

### Requirement 10: Privacy and Redaction Guarantees

**User Story:** As a user, I want the unified output to respect all privacy boundaries established by each engine, so that no sensitive data leaks into demo output.

#### Acceptance Criteria

1. THE Unified_Output SHALL NOT contain prompt_text in the Batch_Summary or any aggregate-level field.
2. THE Unified_Output Prompt_Result SHALL include prompt_text only in a dedicated prompt_text field when the caller explicitly requests it via an include_prompt_text option.
3. WHEN include_prompt_text is false or omitted, THE Prompt_Result SHALL NOT contain prompt_text in any field.
4. THE Unified_Output SHALL NOT contain matched secret substrings in any field at any level.
5. THE Unified_Output SHALL NOT contain any key named assistant_message, response, completion, model_answer, output_text, or generated_text at any nesting level.
6. THE Demo_Orchestrator SHALL pass prompt_text to engines that require it for local in-memory processing (safety scanner, rewrite engine) but SHALL NOT include prompt_text in any engine output stored in the Unified_Output unless explicitly requested.

### Requirement 11: Determinism and Reproducibility

**User Story:** As a developer, I want the same input to produce the same output every time, so that tests are deterministic and demos are reproducible.

#### Acceptance Criteria

1. WHEN Pipeline_Options provides a clock function, THE Demo_Orchestrator SHALL pass the clock to all engines that accept injectable time.
2. WHEN Pipeline_Options provides an idFactory function, THE Demo_Orchestrator SHALL pass the idFactory to all engines that accept injectable ID generation.
3. WHEN Pipeline_Options provides a database path, THE Demo_Orchestrator SHALL use that path for SQLite storage instead of the default.
4. WHEN the same input, clock, and idFactory are provided, THE Demo_Orchestrator SHALL produce a byte-identical Unified_Output.
5. THE Demo_Orchestrator SHALL NOT introduce randomness, non-deterministic ordering, or system-clock-dependent values unless the caller omits the injectable clock.

### Requirement 12: CLI and Report Output Boundary

**User Story:** As a developer, I want the orchestrator to produce structured data only, so that rendering and display remain separate concerns that can reuse existing CLI report or produce different formats.

#### Acceptance Criteria

1. THE Demo_Orchestrator SHALL return structured data (Unified_Output) only and SHALL NOT perform console output, file writing, or side effects beyond database persistence.
2. WHEN a CLI report is desired, the caller SHALL pass the Unified_Output to the existing renderDashboardReport or a dedicated demo report renderer.
3. THE Unified_Output SHALL be serializable to JSON without loss of information.
4. THE Unified_Output SHALL contain pipeline metadata including orchestrator version, engines used with their versions, total execution time, and timestamp.
5. THE Demo_Orchestrator SHALL NOT depend on any specific rendering format (Markdown, HTML, terminal ANSI) in its return type.

### Requirement 13: Non-Goals and Deferred Work

**User Story:** As a developer, I want explicit boundaries on what this spec does not include, so that scope remains clear and future work is tracked separately.

#### Acceptance Criteria

1. THE Demo_Orchestrator SHALL NOT implement a web UI, HTTP server, or browser-based interface.
2. THE Demo_Orchestrator SHALL NOT make network calls, cloud requests, telemetry transmissions, or external LLM API calls.
3. THE Demo_Orchestrator SHALL NOT implement login, authentication, authorization, or billing.
4. THE Demo_Orchestrator SHALL NOT implement a browser extension, VS Code extension, or Kiro extension.
5. THE Demo_Orchestrator SHALL NOT add new npm packages beyond what is already installed in the project.
6. THE Demo_Orchestrator SHALL NOT store or emit full model answers or banned full-answer fields.
7. THE Demo_Orchestrator SHALL NOT emit raw parsed row data from the importer in the Unified_Output.
8. THE Demo_Orchestrator SHALL operate using deterministic, rule-based logic only with no AI/LLM inference calls.

### Requirement 14: Unified Output Metadata

**User Story:** As a developer, I want the output to include metadata about the pipeline run, so that I can trace which versions produced the results and how long it took.

#### Acceptance Criteria

1. THE Unified_Output SHALL contain an orchestrator_version string identifying the Demo_Orchestrator version.
2. THE Unified_Output SHALL contain an engines_used record listing each engine name and its version string.
3. THE Unified_Output SHALL contain a pipeline_started_at ISO 8601 timestamp.
4. THE Unified_Output SHALL contain a pipeline_completed_at ISO 8601 timestamp.
5. THE Unified_Output SHALL contain a total_duration_ms integer representing elapsed pipeline time.
6. THE Unified_Output SHALL contain the input_source descriptor (demo, jsonl file path, or csv file path).
