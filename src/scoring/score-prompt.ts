/**
 * cookedPrompts — Scoring Pipeline (scorePrompt / scorePrompts)
 *
 * Orchestrates the deterministic scoring pipeline: extract signals once, run
 * the seven pure dimension scorers, derive the overall score (weighted average
 * + safety gate), aggregate labels/explanations, and derive confidence.
 *
 * PRIVACY:
 * - `PromptScore` never copies `prompt_text` or `PromptSignals.lowered`.
 * - No logging of prompt content, no network, no storage, no LLM.
 * - Only non-deterministic inputs (`scored_at`, `id`) are injectable.
 */

import type { PromptLogEntry } from '../importers/local/types.js';
import type {
  PromptScore,
  PromptSignals,
  ScoreConfidence,
  ScoreValue,
  ScoringOptions,
} from './types.js';

import { defaultClock, defaultIdFactory } from './clock.js';
import { SCORING_VERSION } from './scoring-version.js';
import { dedupeIssueLabels } from './rules/issue-labels.js';
import { extractSignals } from './signals.js';

import { scoreClarity } from './dimensions/clarity.js';
import { scoreContext } from './dimensions/context.js';
import { scoreConstraints } from './dimensions/constraints.js';
import { scoreOutputFormat } from './dimensions/output-format.js';
import { scoreCapabilityFit } from './dimensions/capability-fit.js';
import { scoreEfficiency } from './dimensions/efficiency.js';
import { scoreSafetyPrivacy } from './dimensions/safety-privacy.js';

import { buildExplanations } from './explanations/explanation-builder.js';

/** Clamp/round a weighted number into a 0–5 ScoreValue. */
function toScoreValue(value: number): ScoreValue {
  const rounded = Math.round(value);
  const clamped = Math.max(0, Math.min(5, rounded));
  return clamped as ScoreValue;
}

/** Derive coarse confidence from metadata presence (does not affect scores). */
function deriveConfidence(signals: PromptSignals): ScoreConfidence {
  if (signals.hasModelMetadata && signals.hasUsageMetadata) return 'high';
  if (signals.hasModelMetadata || signals.hasUsageMetadata) return 'medium';
  return 'low';
}

/**
 * Score a single normalized prompt log entry into a PromptScore.
 * Deterministic except for the injectable clock/idFactory.
 */
export function scorePrompt(
  entry: PromptLogEntry,
  options: ScoringOptions = {},
): PromptScore {
  const clock = options.clock ?? defaultClock;
  const idFactory = options.idFactory ?? defaultIdFactory;

  const signals = extractSignals(entry);

  const clarity = scoreClarity(entry, signals);
  const context = scoreContext(entry, signals);
  const constraints = scoreConstraints(entry, signals);
  const outputFormat = scoreOutputFormat(entry, signals);
  const capabilityFit = scoreCapabilityFit(entry, signals);
  const efficiency = scoreEfficiency(entry, signals);
  const safetyPrivacy = scoreSafetyPrivacy(entry, signals);

  const dimensionResults = [
    clarity,
    context,
    constraints,
    outputFormat,
    capabilityFit,
    efficiency,
    safetyPrivacy,
  ];

  // Weighted average (weights sum to 1.0).
  const weighted =
    clarity.score * 0.2 +
    context.score * 0.2 +
    constraints.score * 0.15 +
    outputFormat.score * 0.15 +
    capabilityFit.score * 0.1 +
    efficiency.score * 0.1 +
    safetyPrivacy.score * 0.1;

  let overallScore = toScoreValue(weighted);

  // Safety gate: a critical safety/privacy risk caps overall at 1.
  if (safetyPrivacy.score <= 1) {
    overallScore = 1;
  }

  const issueLabels = dedupeIssueLabels(
    dimensionResults.flatMap((result) => result.labels),
  );
  const explanations = buildExplanations(dimensionResults);
  const confidence = deriveConfidence(signals);

  return {
    id: idFactory(),
    prompt_log_id: entry.id,
    overall_score: overallScore,
    clarity_score: clarity.score,
    context_score: context.score,
    constraints_score: constraints.score,
    output_format_score: outputFormat.score,
    capability_fit_score: capabilityFit.score,
    efficiency_score: efficiency.score,
    safety_privacy_score: safetyPrivacy.score,
    issue_labels: issueLabels,
    explanations,
    confidence,
    scoring_version: SCORING_VERSION,
    scored_at: clock.now(),
  };
}

/**
 * Score a list of entries, preserving input order. Empty input returns [].
 * The same options are applied to every entry.
 */
export function scorePrompts(
  entries: readonly PromptLogEntry[],
  options: ScoringOptions = {},
): PromptScore[] {
  return entries.map((entry) => scorePrompt(entry, options));
}
