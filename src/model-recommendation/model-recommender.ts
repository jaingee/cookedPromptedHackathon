/**
 * cookedPrompts — Deterministic Model Recommender
 *
 * Local-first, vendor-neutral recommendation engine.
 *
 * Privacy boundary:
 * - Uses PromptScore and value-free SafetyScanResult signals.
 * - Does not require prompt text.
 * - Does not return prompt text, model answers, matched safety values,
 *   live provider data, scraped pricing, or banned full-answer fields.
 * - No network, no provider calls, no telemetry, no LLM judge.
 *
 * Scope (Wave 3):
 * - Capability-first recommendation, postures, candidate families, explanation.
 * - No exact token-cost estimation (Wave 4 owns EstimatedModelCost). This engine
 *   uses the broad `cost_class` signal only and does not populate estimated_cost.
 */

import type {
  ModelCapabilityClass,
  ModelCatalogEntry,
  ModelCandidateFamily,
  ModelRecommendation,
  ModelRecommendationInput,
  CostSpeedPosture,
  PrivacyPosture,
  RecommendedEffort,
  SafetyRoutingPosture,
} from './types.js';
import { LOCAL_MODEL_CATALOG, MODEL_CATALOG_KNOWN_AS_OF } from './model-catalog.js';
import { estimateModelCost } from './cost-estimator.js';

/** Version of the deterministic recommender rules. */
export const MODEL_RECOMMENDER_VERSION = '1.0.0';

/** Options for deterministic recommendation (injectable for tests). */
export interface ModelRecommenderOptions {
  now?: () => string;
  catalog?: readonly ModelCatalogEntry[];
}

/** Maximum number of candidate families returned. */
const MAX_CANDIDATE_FAMILIES = 5;

/** Internal, in-memory score-derived signals. Never serialized to output. */
interface ScoreSignals {
  hasScore: boolean;
  overall?: number;
  weakPromptQuality: boolean;
  weakOutputFormat: boolean;
  weakCapabilityFit: boolean;
  needsSearch: boolean;
  needsToolUse: boolean;
  needsLongContext: boolean;
  codingLikely: boolean;
  multimodalLikely: boolean;
  privacySensitive: boolean;
  privacyScoreWeak: boolean;
  possibleSecret: boolean;
  overpoweredModel: boolean;
  highStakes: boolean;
  simpleLowRisk: boolean;
}

/** Internal, in-memory value-free safety signals. Never serialized to output. */
interface SafetySignals {
  hasSafetyResult: boolean;
  warningCount: number;
  highestSeverity: 'low' | 'medium' | 'high' | 'critical' | null;
  hasCritical: boolean;
  hasHigh: boolean;
  hasMedium: boolean;
  hasSecretLike: boolean;
  hasCitationNeed: boolean;
  hasHallucinationRisk: boolean;
  hasPromptInjection: boolean;
  hasSensitiveData: boolean;
}

const CODING_TAGS = [
  'code', 'coding', 'programming', 'debug', 'debugging', 'refactor', 'bug',
  'software', 'api', 'sql', 'compile', 'stacktrace',
];
const MULTIMODAL_TAGS = [
  'image', 'images', 'vision', 'photo', 'audio', 'voice', 'speech', 'video',
  'ocr', 'multimodal', 'diagram',
];
const LONG_CONTEXT_TAGS = [
  'long', 'files', 'codebase', 'document', 'documents', 'pdf', 'repo',
  'repository', 'transcript', 'book',
];
const SEARCH_TAGS = [
  'search', 'current', 'latest', 'news', 'citation', 'citations', 'sources',
  'factual', 'realtime', 'up-to-date',
];
const HIGH_STAKES_TAGS = [
  'legal', 'medical', 'health', 'clinical', 'diagnosis', 'financial', 'finance',
  'tax', 'contract', 'compliance', 'regulatory',
];

function normalizeTags(input: ModelRecommendationInput): string[] {
  const tags = input.prompt_metadata?.tags ?? [];
  return tags.map((t) => t.toLowerCase());
}

function tagsInclude(tags: string[], keywords: string[]): boolean {
  return tags.some((tag) => keywords.some((kw) => tag.includes(kw)));
}

function extractScoreSignals(input: ModelRecommendationInput): ScoreSignals {
  const score = input.score;
  const tags = normalizeTags(input);
  const labels = score?.issue_labels ?? [];

  const hasScore = Boolean(score);
  const overall = score?.overall_score;

  const weakDimension =
    score !== undefined &&
    (score.clarity_score <= 2 ||
      score.context_score <= 2 ||
      score.constraints_score <= 2);
  const weakPromptQuality =
    (overall !== undefined && overall <= 2) || weakDimension;

  const weakOutputFormat =
    (score !== undefined && score.output_format_score <= 2) ||
    labels.includes('missing_output_format');

  const weakCapabilityFit =
    (score !== undefined && score.capability_fit_score <= 2) ||
    labels.includes('wrong_model_class');

  const needsSearch = labels.includes('needs_search') || tagsInclude(tags, SEARCH_TAGS);
  const needsToolUse = labels.includes('needs_tool_use');
  const needsLongContext =
    labels.includes('too_long_for_task') || tagsInclude(tags, LONG_CONTEXT_TAGS);
  const codingLikely = tagsInclude(tags, CODING_TAGS);
  const multimodalLikely = tagsInclude(tags, MULTIMODAL_TAGS);

  const possibleSecret = labels.includes('possible_secret');
  const privacyScoreWeak = score !== undefined && score.safety_privacy_score <= 2;
  const privacySensitive =
    privacyScoreWeak || labels.includes('privacy_risk') || possibleSecret;

  const overpoweredModel = labels.includes('overpowered_model');
  const highStakes = tagsInclude(tags, HIGH_STAKES_TAGS);

  const complexSignals = weakCapabilityFit || needsLongContext || codingLikely;
  const simpleLowRisk =
    !complexSignals &&
    !privacySensitive &&
    (overpoweredModel || (overall !== undefined && overall >= 4));

  return {
    hasScore,
    overall,
    weakPromptQuality,
    weakOutputFormat,
    weakCapabilityFit,
    needsSearch,
    needsToolUse,
    needsLongContext,
    codingLikely,
    multimodalLikely,
    privacySensitive,
    privacyScoreWeak,
    possibleSecret,
    overpoweredModel,
    highStakes,
    simpleLowRisk,
  };
}

function extractSafetySignals(input: ModelRecommendationInput): SafetySignals {
  const result = input.safety_result;
  if (!result) {
    return {
      hasSafetyResult: false,
      warningCount: 0,
      highestSeverity: null,
      hasCritical: false,
      hasHigh: false,
      hasMedium: false,
      hasSecretLike: false,
      hasCitationNeed: false,
      hasHallucinationRisk: false,
      hasPromptInjection: false,
      hasSensitiveData: false,
    };
  }

  const warnings = result.warnings ?? [];
  const categories = new Set(warnings.map((w) => w.category));
  const severities = new Set(warnings.map((w) => w.severity));

  return {
    hasSafetyResult: true,
    warningCount: warnings.length,
    highestSeverity: result.highest_severity ?? null,
    hasCritical: severities.has('critical'),
    hasHigh: severities.has('high'),
    hasMedium: severities.has('medium'),
    hasSecretLike:
      categories.has('secret_like') ||
      categories.has('credential_like') ||
      categories.has('private_key'),
    hasCitationNeed: categories.has('citation_needed'),
    hasHallucinationRisk: categories.has('hallucination_risk'),
    hasPromptInjection: categories.has('prompt_injection'),
    hasSensitiveData:
      categories.has('personal_data') ||
      categories.has('customer_data') ||
      categories.has('company_sensitive') ||
      categories.has('private_source_code'),
  };
}

function chooseCapabilityClass(
  input: ModelRecommendationInput,
  s: ScoreSignals,
  safety: SafetySignals,
): ModelCapabilityClass {
  const constraints = input.user_constraints;

  // 1. Safety hard stop.
  if (safety.hasCritical || safety.hasSecretLike || s.possibleSecret) {
    return 'do_not_send_external';
  }

  // 2. Privacy-sensitive local.
  if (
    constraints?.prefer_local_or_open_weight === true ||
    s.privacyScoreWeak ||
    safety.hasSensitiveData
  ) {
    return 'local_or_open_weight';
  }

  // 3. High-stakes safety-sensitive.
  if (s.highStakes) {
    return 'safety_sensitive';
  }

  // 4. Search / current factual.
  if (s.needsSearch || safety.hasCitationNeed || safety.hasHallucinationRisk) {
    return 'search_grounded';
  }

  // 5. Coding.
  if (s.codingLikely) {
    return 'coding_specialist';
  }

  // 6. Long context.
  if (s.needsLongContext) {
    return 'long_context';
  }

  // 7. Multimodal.
  if (constraints?.require_multimodal === true || s.multimodalLikely) {
    return 'multimodal';
  }

  // 8. High complexity / frontier (only when the prompt itself is not weak).
  if (!s.weakPromptQuality && s.weakCapabilityFit && !s.overpoweredModel) {
    return 'frontier_reasoning';
  }

  // 9. High quality.
  if (constraints?.prefer_quality === true) {
    return 'high_quality';
  }

  // 10. Basic fast.
  if (
    s.simpleLowRisk &&
    (constraints?.prefer_low_cost === true ||
      constraints?.prefer_speed === true ||
      s.overpoweredModel)
  ) {
    return 'basic_fast';
  }

  // 11. Default.
  return 'balanced_general';
}

function chooseEffort(
  cls: ModelCapabilityClass,
  s: ScoreSignals,
  _safety: SafetySignals,
): RecommendedEffort {
  if (cls === 'do_not_send_external') {
    return 'low';
  }

  // Weak prompts should be improved before escalating effort/spend.
  if (s.weakPromptQuality) {
    if (
      cls === 'frontier_reasoning' ||
      cls === 'safety_sensitive' ||
      cls === 'long_context' ||
      cls === 'coding_specialist'
    ) {
      return 'medium';
    }
    return 'low';
  }

  switch (cls) {
    case 'safety_sensitive':
      return 'xhigh';
    case 'frontier_reasoning':
      return s.overall !== undefined && s.overall >= 4 ? 'xhigh' : 'high';
    case 'coding_specialist':
      return 'high';
    case 'long_context':
      return 'high';
    case 'high_quality':
      return s.overall !== undefined && s.overall >= 4 ? 'high' : 'medium';
    case 'search_grounded':
    case 'multimodal':
    case 'balanced_general':
    case 'local_or_open_weight':
      return 'medium';
    case 'basic_fast':
      return 'low';
    default:
      return 'medium';
  }
}

function chooseCostSpeedPosture(
  cls: ModelCapabilityClass,
  input: ModelRecommendationInput,
  _s: ScoreSignals,
): CostSpeedPosture {
  const constraints = input.user_constraints;
  const preferLowCost = constraints?.prefer_low_cost === true;
  const preferSpeed = constraints?.prefer_speed === true;
  const preferQuality = constraints?.prefer_quality === true;

  // Quality-critical classes lean to quality; low-cost preference softens to
  // balanced (the explanation warns quality may suffer) rather than cheapest.
  if (
    cls === 'frontier_reasoning' ||
    cls === 'safety_sensitive' ||
    cls === 'high_quality'
  ) {
    return preferLowCost ? 'balanced' : 'prioritize_quality';
  }

  if (preferQuality) {
    return 'prioritize_quality';
  }
  if (preferLowCost) {
    return 'minimize_cost';
  }
  if (preferSpeed) {
    return 'prioritize_speed';
  }
  if (cls === 'basic_fast') {
    return 'minimize_cost';
  }
  return 'balanced';
}

function choosePrivacyPosture(
  cls: ModelCapabilityClass,
  input: ModelRecommendationInput,
  s: ScoreSignals,
  safety: SafetySignals,
): PrivacyPosture {
  if (
    cls === 'do_not_send_external' ||
    safety.hasCritical ||
    safety.hasSecretLike ||
    s.possibleSecret
  ) {
    return 'external_not_recommended';
  }
  if (
    input.user_constraints?.prefer_local_or_open_weight === true ||
    s.privacyScoreWeak ||
    safety.hasSensitiveData
  ) {
    return 'local_only_recommended';
  }
  return 'external_ok_after_review';
}

function chooseSafetyPosture(
  _input: ModelRecommendationInput,
  s: ScoreSignals,
  safety: SafetySignals,
): SafetyRoutingPosture {
  if (
    safety.hasCritical ||
    safety.hasSecretLike ||
    s.possibleSecret ||
    (s.hasScore && s.privacySensitive && (s.overall !== undefined && s.overall <= 1))
  ) {
    return 'do_not_route_until_redacted';
  }
  if (
    safety.hasHigh ||
    safety.hasMedium ||
    safety.hasPromptInjection ||
    safety.hasSensitiveData ||
    safety.hasCitationNeed ||
    safety.hasHallucinationRisk
  ) {
    return 'review_before_routing';
  }
  return 'safe_to_route';
}

/** Fallback capability classes used when no direct catalog match exists. */
function fallbackClasses(cls: ModelCapabilityClass): ModelCapabilityClass[] {
  switch (cls) {
    case 'frontier_reasoning':
      return ['high_quality'];
    case 'coding_specialist':
      return ['frontier_reasoning', 'high_quality'];
    case 'safety_sensitive':
      return ['high_quality', 'frontier_reasoning'];
    case 'search_grounded':
      return ['high_quality', 'balanced_general'];
    case 'basic_fast':
      return ['balanced_general'];
    default:
      return ['balanced_general'];
  }
}

function entryHasModality(
  entry: ModelCatalogEntry,
  modality: ModelCatalogEntry['modality_tags'][number],
): boolean {
  return entry.modality_tags.includes(modality);
}

function entryMatchesClass(
  entry: ModelCatalogEntry,
  cls: ModelCapabilityClass,
): boolean {
  if (entry.capability_tags.includes(cls)) {
    return true;
  }
  // Class-specific structural matches beyond capability tags.
  if (cls === 'long_context') {
    return (
      entry.context_window_class === 'long' ||
      entry.context_window_class === 'very_long'
    );
  }
  if (cls === 'multimodal') {
    return (
      entryHasModality(entry, 'vision') ||
      entryHasModality(entry, 'audio') ||
      entryHasModality(entry, 'video')
    );
  }
  if (cls === 'search_grounded') {
    return entryHasModality(entry, 'search');
  }
  if (cls === 'do_not_send_external' || cls === 'local_or_open_weight') {
    return entry.access_type === 'open_weight';
  }
  return false;
}

function passesConstraints(
  entry: ModelCatalogEntry,
  input: ModelRecommendationInput,
): boolean {
  const c = input.user_constraints;
  if (!c) {
    return true;
  }
  if (c.allow_china_models === false && entry.region_or_origin === 'china') {
    return false;
  }
  if (
    c.allow_global_frontier_models === false &&
    entry.quality_class === 'frontier' &&
    entry.license_or_distribution === 'proprietary' &&
    (entry.region_or_origin === 'global' ||
      entry.region_or_origin === 'us' ||
      entry.region_or_origin === 'eu')
  ) {
    return false;
  }
  return true;
}

function constraintBoost(
  entry: ModelCatalogEntry,
  input: ModelRecommendationInput,
): number {
  const c = input.user_constraints;
  if (!c) {
    return 0;
  }
  let boost = 0;
  if (c.prefer_local_or_open_weight === true && entry.access_type === 'open_weight') {
    boost += 2;
  }
  if (c.require_search_grounding === true && entryHasModality(entry, 'search')) {
    boost += 2;
  }
  if (
    c.require_multimodal === true &&
    (entryHasModality(entry, 'vision') ||
      entryHasModality(entry, 'audio') ||
      entryHasModality(entry, 'video'))
  ) {
    boost += 2;
  }
  if (c.prefer_low_cost === true && entry.cost_class === 'low') {
    boost += 1;
  }
  if (c.prefer_speed === true && entry.speed_class === 'fast') {
    boost += 1;
  }
  return boost;
}

function candidateReason(
  directMatch: boolean,
  boost: number,
  cls: ModelCapabilityClass,
): string {
  const base = directMatch
    ? 'Matches the recommended capability class.'
    : 'Related capability-class fallback from the local catalog.';
  const prefNote = boost > 0 ? ' Also fits your stated preferences.' : '';
  const localNote =
    cls === 'do_not_send_external'
      ? ' Local/open-weight option suitable when external routing is not recommended.'
      : '';
  return `${base}${prefNote}${localNote}`;
}

function selectCandidateFamilies(
  cls: ModelCapabilityClass,
  input: ModelRecommendationInput,
  catalog: readonly ModelCatalogEntry[],
): ModelCandidateFamily[] {
  // do_not_send_external: only local/open-weight options, never hosted external.
  const restrictToOpenWeight = cls === 'do_not_send_external';

  interface Ranked {
    entry: ModelCatalogEntry;
    directMatch: boolean;
    boost: number;
    index: number;
  }

  const ranked: Ranked[] = [];
  catalog.forEach((entry, index) => {
    if (restrictToOpenWeight && entry.access_type !== 'open_weight') {
      return;
    }
    if (!passesConstraints(entry, input)) {
      return;
    }

    const directMatch = entryMatchesClass(entry, cls);
    const fallbackMatch =
      !directMatch &&
      fallbackClasses(cls).some((fc) => entryMatchesClass(entry, fc));

    if (!directMatch && !fallbackMatch) {
      return;
    }

    ranked.push({
      entry,
      directMatch,
      boost: constraintBoost(entry, input),
      index,
    });
  });

  ranked.sort((a, b) => {
    if (a.directMatch !== b.directMatch) {
      return a.directMatch ? -1 : 1;
    }
    if (a.boost !== b.boost) {
      return b.boost - a.boost;
    }
    return a.index - b.index;
  });

  return ranked.slice(0, MAX_CANDIDATE_FAMILIES).map((r) => ({
    catalog_id: r.entry.id,
    provider: r.entry.provider,
    model_family: r.entry.model_family,
    representative_model_ids: r.entry.representative_model_ids,
    reason: candidateReason(r.directMatch, r.boost, cls),
    pricing_known_as_of: r.entry.pricing?.pricing_known_as_of,
  }));
}

function dominantReason(cls: ModelCapabilityClass): string {
  switch (cls) {
    case 'do_not_send_external':
      return 'safety signals indicate the prompt should be redacted before any external routing';
    case 'local_or_open_weight':
      return 'privacy-sensitive signals suggest keeping the prompt on local or open-weight models';
    case 'safety_sensitive':
      return 'the task appears high-stakes and needs careful, well-sourced handling';
    case 'search_grounded':
      return 'the task appears to need current facts or citations';
    case 'coding_specialist':
      return 'the task appears code-oriented';
    case 'long_context':
      return 'the task appears to need long-context handling';
    case 'multimodal':
      return 'the task appears to need multimodal input';
    case 'frontier_reasoning':
      return 'the score suggests a complex task that may benefit from stronger reasoning';
    case 'high_quality':
      return 'the task would benefit from a strong general model';
    case 'basic_fast':
      return 'the task appears simple and low-risk';
    case 'balanced_general':
    default:
      return 'the prompt appears suitable for a general model';
  }
}

function buildExplanation(
  cls: ModelCapabilityClass,
  effort: RecommendedEffort,
  costPosture: CostSpeedPosture,
  privacyPosture: PrivacyPosture,
  safetyPosture: SafetyRoutingPosture,
  s: ScoreSignals,
  safety: SafetySignals,
  candidateCount: number,
): string {
  const parts: string[] = [];
  parts.push(
    `Recommended ${cls} with ${effort} effort because ${dominantReason(cls)}.`,
  );

  if (safetyPosture !== 'safe_to_route') {
    parts.push(`Safety posture: ${safetyPosture}.`);
  } else if (safety.hasSafetyResult) {
    parts.push('No critical safety routing issue was detected.');
  }

  if (privacyPosture !== 'external_ok_after_review') {
    parts.push(`Privacy posture: ${privacyPosture}.`);
  }

  parts.push(`Cost/speed posture: ${costPosture}.`);

  if (s.weakPromptQuality) {
    parts.push(
      'Consider improving the prompt (clarity, context, or constraints) before spending on a stronger model.',
    );
  }

  if (candidateCount > 0) {
    parts.push(
      `Candidate families are local catalog examples (known_as_of ${MODEL_CATALOG_KNOWN_AS_OF}), not provider endorsements.`,
    );
  } else {
    parts.push('No catalog candidate families were selected for this recommendation.');
  }

  return parts.join(' ');
}

function chooseConfidence(
  s: ScoreSignals,
  safety: SafetySignals,
): 'low' | 'medium' | 'high' {
  if (s.hasScore && safety.hasSafetyResult) {
    return 'high';
  }
  if (s.hasScore || safety.hasSafetyResult) {
    return 'medium';
  }
  return 'low';
}

/**
 * Produce a deterministic, capability-first model recommendation from local
 * signals only. Same input + same `now` + same catalog → same output.
 */
export function recommendModel(
  input: ModelRecommendationInput,
  options?: ModelRecommenderOptions,
): ModelRecommendation {
  const now = options?.now ?? (() => new Date().toISOString());
  const catalog = options?.catalog ?? LOCAL_MODEL_CATALOG;

  const scoreSignals = extractScoreSignals(input);
  const safetySignals = extractSafetySignals(input);

  const recommendedClass = chooseCapabilityClass(input, scoreSignals, safetySignals);
  const recommendedEffort = chooseEffort(recommendedClass, scoreSignals, safetySignals);
  const costSpeedPosture = chooseCostSpeedPosture(recommendedClass, input, scoreSignals);
  const privacyPosture = choosePrivacyPosture(
    recommendedClass,
    input,
    scoreSignals,
    safetySignals,
  );
  const safetyPosture = chooseSafetyPosture(input, scoreSignals, safetySignals);
  const candidateFamilies = selectCandidateFamilies(recommendedClass, input, catalog);
  const estimatedCost = estimateModelCost(
    candidateFamilies,
    catalog,
    input.token_estimate,
  );
  const explanation = buildExplanation(
    recommendedClass,
    recommendedEffort,
    costSpeedPosture,
    privacyPosture,
    safetyPosture,
    scoreSignals,
    safetySignals,
    candidateFamilies.length,
  );

  return {
    recommended_class: recommendedClass,
    recommended_effort: recommendedEffort,
    cost_speed_posture: costSpeedPosture,
    privacy_posture: privacyPosture,
    safety_posture: safetyPosture,
    explanation,
    candidate_families: candidateFamilies,
    ...(estimatedCost ? { estimated_cost: estimatedCost } : {}),
    confidence: chooseConfidence(scoreSignals, safetySignals),
    recommender_version: MODEL_RECOMMENDER_VERSION,
    created_at: now(),
  };
}
