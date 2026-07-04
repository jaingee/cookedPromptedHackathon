/**
 * cookedPrompts — Demo Report Coaching Copy
 *
 * Static deterministic coaching text mappings.
 * All text is hand-authored, local-only, and deterministic.
 * No AI/LLM generation. No prompt_text. No secrets.
 */

/**
 * Coaching notes for each of the 12 scoring issue labels.
 * Maps ScoringIssueLabel → coaching string.
 */
export const ISSUE_LABEL_COACHING_NOTES: Record<string, string> = {
  missing_context:
    'Add background, goal, and audience so the model has enough to work with.',
  unclear_task:
    'State the objective in one sentence. What does "done" look like?',
  missing_constraints:
    'Specify length, tone, format, or boundaries.',
  missing_output_format:
    'Tell the model what shape the output should be (JSON, list, prose, etc.).',
  overbroad_prompt:
    'Break this into smaller focused sub-tasks.',
  privacy_risk:
    'Remove or redact sensitive data before sending externally.',
  possible_secret:
    'Never paste secrets. Use placeholder references instead.',
  wrong_model_class:
    'Match the task to the right model capability class.',
  overpowered_model:
    'A cheaper/faster model handles this fine. Save the frontier for hard tasks.',
  needs_search:
    'Ground factual claims with source references.',
  needs_tool_use:
    'Use a tool or structured workflow instead of asking the model directly.',
  too_long_for_task:
    'Trim filler. Focus on the core request.',
};

/**
 * Coaching notes for weak scoring dimensions.
 * Maps dimension name → coaching text when the dimension scores poorly.
 */
export const DIMENSION_COACHING_NOTES: Record<string, string> = {
  clarity:
    'Your prompts could be clearer. State the task in one sentence before adding detail.',
  context:
    'Missing context is your biggest gap. Add background, constraints, and audience.',
  constraints:
    'Add explicit constraints: length, format, tone, and boundaries help the model focus.',
  output_format:
    'Specify the desired output shape upfront. JSON? Bullet list? Code block?',
  capability_fit:
    'You may be picking the wrong model class. Match capability to task complexity.',
  efficiency:
    'Your prompts tend to be longer than needed. Trim filler and get to the point.',
  safety_privacy:
    'Some prompts carry safety risks. Review for secrets, PII, or sensitive data.',
};

/**
 * Fallback encouragement actions for padding next-actions to minimum 3.
 */
export const GENERAL_ENCOURAGEMENT_ACTIONS: string[] = [
  'Review your top 3 prompts from today and identify one reusable pattern.',
  'Try the "one sentence goal" rule: state what "done" means before adding context.',
  'Experiment with a cheaper model for routine tasks — save frontier models for hard problems.',
  'Create a personal prompt template for your most common task type.',
];

/** Human-readable labels for scoring dimensions. */
export const DIMENSION_DISPLAY_LABELS: Record<string, string> = {
  clarity: 'Clarity',
  context: 'Context & Background',
  constraints: 'Constraints',
  output_format: 'Output Format',
  capability_fit: 'Capability Fit',
  efficiency: 'Efficiency',
  safety_privacy: 'Safety & Privacy',
};

/** Human-readable labels for issue labels. */
export const ISSUE_LABEL_DISPLAY_NAMES: Record<string, string> = {
  missing_context: 'Missing context',
  unclear_task: 'Unclear task',
  missing_constraints: 'Missing constraints',
  missing_output_format: 'Missing output format',
  overbroad_prompt: 'Overbroad prompt',
  privacy_risk: 'Privacy risk',
  possible_secret: 'Possible secret',
  wrong_model_class: 'Wrong model class',
  overpowered_model: 'Overpowered model',
  needs_search: 'Needs search',
  needs_tool_use: 'Needs tool use',
  too_long_for_task: 'Too long for task',
};

/** Get human-readable dimension label, fallback to raw key. */
export function humanizeDimension(key: string): string {
  return DIMENSION_DISPLAY_LABELS[key] ?? key;
}

/** Get human-readable issue label, fallback to raw key. */
export function humanizeIssueLabel(key: string): string {
  return ISSUE_LABEL_DISPLAY_NAMES[key] ?? key;
}
