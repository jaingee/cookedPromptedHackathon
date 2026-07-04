/**
 * cookedPrompts — Scoring Module Boundary
 *
 * Public exports for the local deterministic prompt scoring engine.
 * Wave 0 defines the module boundary, core types, clock/id helpers,
 * and scoring version only.
 *
 * Local-first: no network, no cloud, no telemetry, no LLM judge.
 */

export type {
  ScoreValue,
  ScoreConfidence,
  ScoringIssueLabel,
  CapabilityClass,
  PromptScore,
  Clock,
  ScoringOptions,
  ScoringConfig,
  ScoringEngine,
  DimensionResult,
  PromptSignals,
} from './types.js';

export { defaultClock, defaultIdFactory } from './clock.js';
export { SCORING_VERSION } from './scoring-version.js';

export { SCORING_ISSUE_LABELS, dedupeIssueLabels } from './rules/issue-labels.js';
export {
  CAPABILITY_CLASSES,
  inferCapabilitiesFromModelMetadata,
} from './rules/capability-classes.js';

export { scorePrompt, scorePrompts } from './score-prompt.js';
export { createScoringEngine } from './scoring-engine.js';
