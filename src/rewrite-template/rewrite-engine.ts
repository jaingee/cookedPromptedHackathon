/**
 * cookedPrompts — Rewrite Engine
 *
 * Deterministic, local-first, rule-based coaching guidance engine.
 * Produces structured RewriteSuggestion from prompt scores, safety results,
 * and model recommendations — never including prompt_text in output.
 *
 * Privacy boundary:
 * - prompt_text is accepted on RewriteInput for local in-memory processing only.
 * - prompt_text MUST NOT appear in any output field.
 * - No matched secret substrings in output.
 * - No banned full-answer fields in output.
 * - No network, no cloud, no telemetry, no LLM.
 */

import type {
  RewriteInput,
  RewriteSuggestion,
  GuidanceItem,
  GuidanceSeverity,
  GuidanceDimension,
  RewriteEngineOptions,
} from './types.js';
import type { ScoringIssueLabel } from '../scoring/types.js';
import {
  ISSUE_LABEL_GUIDANCE_RULES,
  DIMENSION_SCORE_RULES,
  SAFETY_CATEGORY_GUIDANCE,
  REDACTION_FIRST_GUIDANCE,
} from './guidance-rules.js';

/** Rewrite engine version identifier. */
export const REWRITE_ENGINE_VERSION = 'rewrite-engine-v1';

/** Severity ordering for comparison (higher index = worse). */
const SEVERITY_ORDER: Record<GuidanceSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Default clock producing ISO 8601 timestamps. */
function defaultNow(): string {
  return new Date().toISOString();
}

/** Default ID factory producing deterministic guidance IDs. */
let idCounter = 0;
function defaultIdFactory(): string {
  idCounter += 1;
  return `guidance-${idCounter}`;
}

/**
 * Map a dimension name to the corresponding score field on PromptScore.
 */
function getDimensionScore(input: RewriteInput, dimension: GuidanceDimension): number {
  const scoreMap: Record<GuidanceDimension, number> = {
    clarity: input.prompt_score.clarity_score,
    context: input.prompt_score.context_score,
    constraints: input.prompt_score.constraints_score,
    output_format: input.prompt_score.output_format_score,
    capability_fit: input.prompt_score.capability_fit_score,
    efficiency: input.prompt_score.efficiency_score,
    safety_privacy: input.prompt_score.safety_privacy_score,
  };
  return scoreMap[dimension];
}

/**
 * Compute the worst (highest) severity from a list of guidance items.
 */
function computeOverallSeverity(items: GuidanceItem[]): GuidanceSeverity {
  if (items.length === 0) return 'low';
  let worst: GuidanceSeverity = 'low';
  for (const item of items) {
    if (SEVERITY_ORDER[item.severity] > SEVERITY_ORDER[worst]) {
      worst = item.severity;
    }
  }
  return worst;
}

/**
 * Build a plain-language summary from guidance items.
 */
function buildSummary(items: GuidanceItem[]): string {
  if (items.length === 0) {
    return 'Prompt quality is strong. No coaching guidance needed.';
  }
  const count = items.length;
  const worst = computeOverallSeverity(items);
  const dimensions = [...new Set(items.map((i) => i.dimension))];
  if (dimensions.length === 1) {
    return `${count} coaching suggestion${count > 1 ? 's' : ''} (${worst} severity) targeting ${dimensions[0]}.`;
  }
  return `${count} coaching suggestions (${worst} severity) across ${dimensions.length} dimensions.`;
}

/**
 * Generate structured rewrite coaching guidance for a scored prompt.
 *
 * Deterministic: same input + same options → same output.
 * Local-only: no network, no LLM, no cloud.
 * Privacy-safe: prompt_text never serialized into output.
 */
export function generateRewriteSuggestion(
  input: RewriteInput,
  options?: RewriteEngineOptions,
): RewriteSuggestion {
  const now = options?.now ?? defaultNow;
  const idFactory = options?.idFactory ?? defaultIdFactory;

  // Collect all guidance items in staging buckets
  const safetyItems: GuidanceItem[] = [];
  const issueLabelItems: GuidanceItem[] = [];
  const dimensionScoreItems: GuidanceItem[] = [];
  const modelRecItems: GuidanceItem[] = [];

  // Track which dimensions are already covered by issue-label items
  const coveredDimensions = new Set<GuidanceDimension>();

  // --- Step 1: Check do_not_route_until_redacted posture ---
  if (input.model_recommendation?.safety_posture === 'do_not_route_until_redacted') {
    const rule = REDACTION_FIRST_GUIDANCE;
    safetyItems.push({
      id: idFactory(),
      dimension: rule.dimension,
      severity: rule.severity,
      priority: 0, // will be reassigned
      action: rule.action,
      explanation: rule.explanation,
    });
    coveredDimensions.add(rule.dimension);
  }

  // --- Step 2: Issue-label guidance (Layer 1) ---
  const issueLabels = input.prompt_score.issue_labels;
  for (const label of issueLabels) {
    const rule = ISSUE_LABEL_GUIDANCE_RULES[label as ScoringIssueLabel];
    if (!rule) continue; // forward-compatible: skip unknown labels

    const item: GuidanceItem = {
      id: idFactory(),
      issue_label: label as ScoringIssueLabel,
      dimension: rule.dimension,
      severity: rule.severity,
      priority: 0, // will be reassigned
      action: rule.action,
      explanation: rule.explanation,
    };

    // Safety/privacy items with critical or high severity go to safety bucket
    if (rule.dimension === 'safety_privacy' && SEVERITY_ORDER[rule.severity] >= SEVERITY_ORDER['high']) {
      safetyItems.push(item);
    } else {
      issueLabelItems.push(item);
    }

    coveredDimensions.add(rule.dimension);
  }

  // --- Step 3: Safety result warnings → safety category guidance ---
  if (input.safety_result) {
    const seenCategories = new Set<string>();
    for (const warning of input.safety_result.warnings) {
      const category = warning.category;
      if (seenCategories.has(category)) continue;
      seenCategories.add(category);

      const categoryRule = SAFETY_CATEGORY_GUIDANCE[category];
      if (categoryRule) {
        // Check if this dimension+action is already covered
        const alreadyCovered = [...safetyItems, ...issueLabelItems].some(
          (i) => i.dimension === categoryRule.dimension && i.explanation === categoryRule.explanation,
        );
        if (!alreadyCovered) {
          const item: GuidanceItem = {
            id: idFactory(),
            dimension: categoryRule.dimension,
            severity: categoryRule.severity,
            priority: 0,
            action: categoryRule.action,
            explanation: categoryRule.explanation,
          };
          if (SEVERITY_ORDER[categoryRule.severity] >= SEVERITY_ORDER['high']) {
            safetyItems.push(item);
          } else {
            issueLabelItems.push(item);
          }
          coveredDimensions.add(categoryRule.dimension);
        }
      }
    }

    // Promote any existing items if safety_result has critical/high warnings
    if (input.safety_result.highest_severity === 'critical' || input.safety_result.highest_severity === 'high') {
      // Safety items already in the safety bucket — they'll be prioritized
    }
  }

  // --- Step 4: Dimension-score rules (Layer 2) ---
  const allDimensions: GuidanceDimension[] = [
    'clarity', 'context', 'constraints', 'output_format',
    'capability_fit', 'efficiency', 'safety_privacy',
  ];

  for (const dimension of allDimensions) {
    if (coveredDimensions.has(dimension)) continue;
    const score = getDimensionScore(input, dimension);
    if (score <= 1) {
      const rule = DIMENSION_SCORE_RULES[dimension];
      const item: GuidanceItem = {
        id: idFactory(),
        dimension: rule.dimension,
        severity: rule.severity,
        priority: 0,
        action: rule.action,
        explanation: rule.explanation,
      };
      if (rule.dimension === 'safety_privacy' && SEVERITY_ORDER[rule.severity] >= SEVERITY_ORDER['high']) {
        safetyItems.push(item);
      } else {
        dimensionScoreItems.push(item);
      }
    }
  }

  // --- Step 5: Model recommendation guidance (lower priority) ---
  if (input.model_recommendation) {
    const rec = input.model_recommendation;

    if (rec.cost_speed_posture === 'minimize_cost') {
      modelRecItems.push({
        id: idFactory(),
        dimension: 'efficiency',
        severity: 'low',
        priority: 0,
        action: 'change',
        explanation: 'Consider simplifying the prompt for a cheaper model class to minimize cost.',
      });
    }

    if (rec.recommended_class === 'frontier_reasoning') {
      modelRecItems.push({
        id: idFactory(),
        dimension: 'context',
        severity: 'low',
        priority: 0,
        action: 'add',
        explanation: 'This prompt warrants deep reasoning. Ensure constraints and context are thorough for best results.',
      });
    }

    if (rec.recommended_class === 'local_or_open_weight') {
      modelRecItems.push({
        id: idFactory(),
        dimension: 'efficiency',
        severity: 'low',
        priority: 0,
        action: 'change',
        explanation: 'This prompt suits a local model. Keep it concise for smaller context windows.',
      });
    }
  }

  // --- Step 6: Sort items within each bucket by severity (worst first) ---
  const sortBySeverity = (a: GuidanceItem, b: GuidanceItem): number =>
    SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];

  safetyItems.sort(sortBySeverity);
  issueLabelItems.sort(sortBySeverity);
  dimensionScoreItems.sort(sortBySeverity);
  // modelRecItems keep insertion order (lower priority bucket)

  // --- Step 7: Assign priority numbers (1 = highest) ---
  const allItems: GuidanceItem[] = [
    ...safetyItems,
    ...issueLabelItems,
    ...dimensionScoreItems,
    ...modelRecItems,
  ];

  for (let i = 0; i < allItems.length; i++) {
    allItems[i].priority = i + 1;
  }

  // --- Step 8: Compute overall severity and priority ---
  const overallSeverity = computeOverallSeverity(allItems);
  const overallPriority = allItems.length > 0 ? 1 : 0;

  // --- Step 9: Build summary ---
  const summary = buildSummary(allItems);

  // --- Step 10: Return RewriteSuggestion (no prompt_text anywhere) ---
  return {
    prompt_log_id: input.prompt_score.prompt_log_id,
    guidance_items: allItems,
    overall_severity: overallSeverity,
    overall_priority: overallPriority,
    summary,
    engine_version: REWRITE_ENGINE_VERSION,
    created_at: now(),
  };
}
