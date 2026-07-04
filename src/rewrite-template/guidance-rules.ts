/**
 * cookedPrompts — Rewrite Guidance Rules
 *
 * Deterministic, local-first mapping from scoring issue labels and
 * dimension scores to structured coaching guidance definitions.
 *
 * Privacy boundary:
 * - No prompt_text, matched secrets, or banned full-answer fields.
 * - Rules contain only generic placeholder guidance text.
 * - No network, no cloud, no telemetry, no LLM.
 */

import type { ScoringIssueLabel } from '../scoring/types.js';
import type { GuidanceDimension, GuidanceSeverity, GuidanceItem } from './types.js';

/** Static rule definition used to produce GuidanceItems. */
export interface GuidanceRuleDefinition {
  dimension: GuidanceDimension;
  action: GuidanceItem['action'];
  severity: GuidanceSeverity;
  explanation: string;
  example_before?: string;
  example_after?: string;
}

/**
 * Layer 1: Issue-label-to-guidance mapping.
 * Each ScoringIssueLabel maps to a predefined GuidanceRuleDefinition.
 */
export const ISSUE_LABEL_GUIDANCE_RULES: Record<ScoringIssueLabel, GuidanceRuleDefinition> = {
  missing_context: {
    dimension: 'context',
    action: 'add',
    severity: 'medium',
    explanation: 'Add domain context, background information, or relevant data so the model understands the situation.',
  },
  unclear_task: {
    dimension: 'clarity',
    action: 'change',
    severity: 'high',
    explanation: 'Clarify the task objective and specify the expected output clearly in the prompt.',
  },
  missing_constraints: {
    dimension: 'constraints',
    action: 'add',
    severity: 'medium',
    explanation: 'Specify constraints such as length, tone, format, or boundaries to guide the model.',
  },
  missing_output_format: {
    dimension: 'output_format',
    action: 'add',
    severity: 'medium',
    explanation: 'Define the expected output structure (JSON, list, paragraph, code, table, etc.).',
  },
  overbroad_prompt: {
    dimension: 'efficiency',
    action: 'change',
    severity: 'medium',
    explanation: 'Decompose this broad prompt into smaller, focused sub-prompts for better results.',
  },
  privacy_risk: {
    dimension: 'safety_privacy',
    action: 'review',
    severity: 'high',
    explanation: 'Remove or redact sensitive data before sending this prompt to an external model.',
  },
  possible_secret: {
    dimension: 'safety_privacy',
    action: 'remove',
    severity: 'critical',
    explanation: 'Remove secrets (API keys, tokens, passwords) and use placeholder references instead.',
  },
  wrong_model_class: {
    dimension: 'capability_fit',
    action: 'change',
    severity: 'medium',
    explanation: 'Consider using a different model capability class better suited to this task.',
  },
  overpowered_model: {
    dimension: 'efficiency',
    action: 'change',
    severity: 'low',
    explanation: 'A cheaper or faster model would handle this task well. Simplify or shorten if desired.',
  },
  needs_search: {
    dimension: 'capability_fit',
    action: 'add',
    severity: 'medium',
    explanation: 'Request search grounding or provide source references for factual accuracy.',
  },
  needs_tool_use: {
    dimension: 'capability_fit',
    action: 'change',
    severity: 'medium',
    explanation: 'Consider invoking a tool or structured workflow instead of asking the model directly.',
  },
  too_long_for_task: {
    dimension: 'efficiency',
    action: 'remove',
    severity: 'medium',
    explanation: 'Trim unnecessary content and focus the prompt on the core task.',
  },
};

/**
 * Layer 2: Dimension-score rules.
 * When a dimension score is 0 or 1 AND no issue-label already covers
 * that dimension, a supplementary guidance item is produced.
 */
export interface DimensionScoreRule {
  dimension: GuidanceDimension;
  action: GuidanceItem['action'];
  severity: GuidanceSeverity;
  explanation: string;
}

export const DIMENSION_SCORE_RULES: Record<GuidanceDimension, DimensionScoreRule> = {
  clarity: {
    dimension: 'clarity',
    action: 'change',
    severity: 'high',
    explanation: 'Restate the task in a single clear sentence so the model knows exactly what to do.',
  },
  context: {
    dimension: 'context',
    action: 'add',
    severity: 'medium',
    explanation: 'Provide relevant background, domain knowledge, or data context.',
  },
  constraints: {
    dimension: 'constraints',
    action: 'add',
    severity: 'medium',
    explanation: 'Add specific constraints (length, tone, boundaries, scope) to narrow the output.',
  },
  output_format: {
    dimension: 'output_format',
    action: 'add',
    severity: 'medium',
    explanation: 'Define the expected output structure so the model knows what format to produce.',
  },
  capability_fit: {
    dimension: 'capability_fit',
    action: 'change',
    severity: 'medium',
    explanation: 'Reconsider the model class for this task — a different capability may fit better.',
  },
  efficiency: {
    dimension: 'efficiency',
    action: 'change',
    severity: 'medium',
    explanation: 'Trim unnecessary content or decompose the prompt into smaller parts.',
  },
  safety_privacy: {
    dimension: 'safety_privacy',
    action: 'review',
    severity: 'high',
    explanation: 'Review and redact any sensitive content before sending this prompt externally.',
  },
};

/**
 * Safety category guidance for specific categories that produce
 * additional coaching items beyond the issue-label layer.
 */
export const SAFETY_CATEGORY_GUIDANCE: Record<string, GuidanceRuleDefinition> = {
  citation_needed: {
    dimension: 'safety_privacy',
    action: 'add',
    severity: 'medium',
    explanation: 'Add source citations or reference materials to support factual claims.',
  },
  hallucination_risk: {
    dimension: 'safety_privacy',
    action: 'add',
    severity: 'medium',
    explanation: 'Provide verifiable sources or ask the model to cite references to reduce hallucination risk.',
  },
  prompt_injection: {
    dimension: 'safety_privacy',
    action: 'review',
    severity: 'high',
    explanation: 'This prompt may contain injection patterns. Use defensive prompt structure and validate inputs.',
  },
};

/**
 * Redaction-first guidance item produced when the model recommendation
 * safety posture is 'do_not_route_until_redacted'.
 */
export const REDACTION_FIRST_GUIDANCE: GuidanceRuleDefinition = {
  dimension: 'safety_privacy',
  action: 'review',
  severity: 'critical',
  explanation: 'Critical safety issue detected. Redact or remove sensitive content before any other prompt improvements.',
};
