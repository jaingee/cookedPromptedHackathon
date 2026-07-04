/**
 * cookedPrompts — Static Template Catalog
 *
 * A readonly catalog of reusable, privacy-safe prompt templates.
 * Each template uses generic bracket placeholders only — never real prompt text,
 * secrets, model answers, or banned full-answer fields.
 *
 * Templates are matched to prompt weaknesses via `applicable_issue_labels`.
 */

import type { PromptTemplate } from './types.js';

/** Template generator version identifier. */
export const TEMPLATE_GENERATOR_VERSION = 'template-generator-v1';

/** Static created_at for all catalog entries. */
export const TEMPLATE_CATALOG_CREATED_AT = '2026-07-04T00:00:00.000Z';

/**
 * Static readonly catalog of prompt templates.
 *
 * 12 label-specific templates (one per ScoringIssueLabel) +
 * 4 cross-cutting templates (common multi-label combinations).
 */
export const TEMPLATE_CATALOG: readonly PromptTemplate[] = [
  // ─── Label-Specific Templates ─────────────────────────────────────────────────

  {
    template_id: 'tpl-missing-context',
    template_name: 'Context-Rich Prompt',
    template_body:
      '[TASK]: Describe what you need done.\n[CONTEXT]: Provide domain background, relevant data, or prior work.\n[CONSTRAINTS]: Specify limits or boundaries.\n[OUTPUT_FORMAT]: Define what the output should look like.',
    category_tags: ['general'],
    applicable_issue_labels: ['missing_context'],
    description:
      'A template that guides you to include domain context and background for the model.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-unclear-task',
    template_name: 'Clear Task Prompt',
    template_body:
      '[TASK]: State the objective in one clear sentence.\n[CONTEXT]: Provide relevant background.\n[OUTPUT_FORMAT]: Describe the expected result format.\n[EXAMPLES]: Show a brief example of the desired output.',
    category_tags: ['general'],
    applicable_issue_labels: ['unclear_task'],
    description:
      'A template that ensures the task objective is stated clearly and unambiguously.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-missing-constraints',
    template_name: 'Constrained Prompt',
    template_body:
      '[TASK]: Describe what you need.\n[CONSTRAINTS]: Specify length, tone, format, and boundaries.\n[BOUNDARIES]: List what the response should NOT include.\n[OUTPUT_FORMAT]: Define the structure of the output.',
    category_tags: ['general'],
    applicable_issue_labels: ['missing_constraints'],
    description:
      'A template that guides you to add specific constraints and boundaries to your prompt.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-missing-output-format',
    template_name: 'Structured Output Prompt',
    template_body:
      '[TASK]: Describe the task.\n[OUTPUT_FORMAT]: Define the exact structure (e.g., JSON, table, list, prose).\n[EXAMPLES]: Provide a sample of the desired output shape.\n[CONSTRAINTS]: Specify any formatting rules.',
    category_tags: ['general'],
    applicable_issue_labels: ['missing_output_format'],
    description:
      'A template that ensures you define the expected output structure clearly.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-overbroad-prompt',
    template_name: 'Focused Sub-Task Prompt',
    template_body:
      '[TASK]: Describe one specific sub-task (not the whole project).\n[CONTEXT]: Provide only the relevant context for this sub-task.\n[CONSTRAINTS]: Keep the scope narrow and achievable.\n[OUTPUT_FORMAT]: Define a concrete deliverable for this step.',
    category_tags: ['general'],
    applicable_issue_labels: ['overbroad_prompt'],
    description:
      'A template that helps you decompose broad requests into focused, manageable sub-prompts.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-privacy-risk',
    template_name: 'Privacy-Safe Prompt',
    template_body:
      '[TASK]: Describe what you need without including sensitive data.\n[CONTEXT]: Use anonymized or placeholder data instead of real values.\n[SAFETY_NOTES]: Note any data categories that must be redacted.\n[CONSTRAINTS]: Specify that no personal or private data should appear in the response.',
    category_tags: ['general'],
    applicable_issue_labels: ['privacy_risk'],
    description:
      'A template that reminds you to remove or anonymize sensitive data before sending to a model.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-possible-secret',
    template_name: 'Secret-Free Prompt',
    template_body:
      '[TASK]: Describe the task without embedding secrets or credentials.\n[CONTEXT]: Reference secrets by name or placeholder (e.g., [API_KEY]) — never paste actual values.\n[SAFETY_NOTES]: Confirm all secrets have been removed or replaced with placeholders.\n[CONSTRAINTS]: Specify that no real credentials should appear anywhere.',
    category_tags: ['general'],
    applicable_issue_labels: ['possible_secret'],
    description:
      'A template that ensures secrets and credentials are replaced with safe placeholders.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-wrong-model-class',
    template_name: 'Model-Appropriate Prompt',
    template_body:
      '[TASK]: Describe the task and its complexity level.\n[CONTEXT]: Note what capabilities are needed (e.g., coding, reasoning, search).\n[CONSTRAINTS]: Specify any model requirements or limitations.\n[OUTPUT_FORMAT]: Define the expected output complexity.',
    category_tags: ['general'],
    applicable_issue_labels: ['wrong_model_class'],
    description:
      'A template that helps you match your prompt to the right model capability class.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-overpowered-model',
    template_name: 'Lightweight Prompt',
    template_body:
      '[TASK]: State the simple task clearly.\n[CONSTRAINTS]: Note this is a straightforward request — keep it brief.\n[OUTPUT_FORMAT]: Define a short, direct output format.',
    category_tags: ['general'],
    applicable_issue_labels: ['overpowered_model'],
    description:
      'A template for simple tasks that do not require a powerful model — keeps prompts short and direct.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-needs-search',
    template_name: 'Search-Grounded Prompt',
    template_body:
      '[TASK]: Describe what factual information you need.\n[SOURCE_MATERIAL]: Provide references, URLs, or data sources to ground the answer.\n[CONSTRAINTS]: Require citations or source attribution.\n[OUTPUT_FORMAT]: Define how sources should be referenced in the output.',
    category_tags: ['research'],
    applicable_issue_labels: ['needs_search'],
    description:
      'A template that guides you to include source references and require citations for factual claims.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-needs-tool-use',
    template_name: 'Tool-Enabled Prompt',
    template_body:
      '[TASK]: Describe what you need accomplished.\n[TOOLS]: List the tools or capabilities the model should use (e.g., code execution, file access, API calls).\n[CONSTRAINTS]: Specify which tools are allowed and any limitations.\n[OUTPUT_FORMAT]: Define what a successful tool-assisted result looks like.',
    category_tags: ['coding'],
    applicable_issue_labels: ['needs_tool_use'],
    description:
      'A template that helps you specify which tools or structured workflows the model should invoke.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-too-long-for-task',
    template_name: 'Concise Prompt',
    template_body:
      '[TASK]: State the core request in one or two sentences.\n[CONTEXT]: Include only the essential context (remove filler).\n[CONSTRAINTS]: Keep the total prompt under a reasonable length.\n[OUTPUT_FORMAT]: Define a brief output format.',
    category_tags: ['general'],
    applicable_issue_labels: ['too_long_for_task'],
    description:
      'A template that helps you trim unnecessary content and focus on the core task.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },

  // ─── Cross-Cutting Templates ──────────────────────────────────────────────────

  {
    template_id: 'tpl-cross-context-format',
    template_name: 'Context + Output Structure',
    template_body:
      '[TASK]: Describe what you need.\n[CONTEXT]: Provide domain background, data, or prior work.\n[OUTPUT_FORMAT]: Define the exact output structure (e.g., JSON, table, list).\n[EXAMPLES]: Show a sample of the expected result.\n[CONSTRAINTS]: Specify length, tone, and formatting rules.',
    category_tags: ['general'],
    applicable_issue_labels: ['missing_context', 'missing_output_format'],
    description:
      'A combined template for prompts missing both domain context and output structure definition.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-cross-constraints-scope',
    template_name: 'Scoped and Constrained',
    template_body:
      '[TASK]: Describe one focused sub-task.\n[CONSTRAINTS]: Specify length, tone, format, and boundaries.\n[BOUNDARIES]: List what the response should NOT cover.\n[CONTEXT]: Provide only the minimum context needed.\n[OUTPUT_FORMAT]: Define a concrete, bounded deliverable.',
    category_tags: ['general'],
    applicable_issue_labels: ['missing_constraints', 'overbroad_prompt'],
    description:
      'A combined template for prompts that are both unconstrained and too broad in scope.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-cross-safety-first',
    template_name: 'Safety-First Prompt',
    template_body:
      '[TASK]: Describe the task without embedding any sensitive data or secrets.\n[SAFETY_NOTES]: Confirm all secrets, credentials, and personal data have been removed or replaced with placeholders.\n[CONTEXT]: Use anonymized data only.\n[CONSTRAINTS]: Specify that no real secrets, credentials, or personal data should appear.\n[OUTPUT_FORMAT]: Define the expected output format.',
    category_tags: ['general'],
    applicable_issue_labels: ['privacy_risk', 'possible_secret'],
    description:
      'A safety-first template for prompts flagged with both privacy risks and possible secrets.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
  {
    template_id: 'tpl-cross-model-fit',
    template_name: 'Right-Sized Model Prompt',
    template_body:
      '[TASK]: State the task and its actual complexity.\n[CONTEXT]: Note what capabilities are truly needed.\n[CONSTRAINTS]: Specify that a simpler or more appropriate model suffices.\n[OUTPUT_FORMAT]: Define a proportionate output for the task complexity.',
    category_tags: ['general'],
    applicable_issue_labels: ['wrong_model_class', 'overpowered_model'],
    description:
      'A combined template for prompts where the model class is wrong or overpowered for the task.',
    generator_version: TEMPLATE_GENERATOR_VERSION,
    created_at: TEMPLATE_CATALOG_CREATED_AT,
  },
] as const;

/**
 * Returns the full static template catalog.
 */
export function getTemplateCatalog(): readonly PromptTemplate[] {
  return TEMPLATE_CATALOG;
}
