/**
 * cookedPrompts — Capability Class Constants and Model Interpretation
 *
 * Vendor-neutral capability classes and a minimal, replaceable heuristic
 * that classifies a `model_used` descriptor into capability classes.
 *
 * IMPORTANT: No provider/model names are hardcoded (no "gpt", "claude",
 * "gemini", etc.). Matching is over generic capability descriptors only,
 * so the heuristic can be replaced later by the model-recommendation spec.
 *
 * No prompt text, no network, no storage, no LLM.
 */

import type { CapabilityClass } from '../types.js';

/** Canonical list of all vendor-neutral capability classes. */
export const CAPABILITY_CLASSES = [
  'cheap_fast',
  'general_purpose',
  'coding',
  'deep_reasoning',
  'long_context',
  'tool_using',
  'search_required',
  'multimodal',
  'privacy_sensitive_local',
] as const satisfies readonly CapabilityClass[];

/**
 * Infer capability classes from a model descriptor string using generic
 * capability keywords only (never provider/model names).
 *
 * Returns `[]` for a missing/blank descriptor. Result is ordered by the
 * canonical CAPABILITY_CLASSES order for determinism.
 *
 * This is intentionally minimal and replaceable.
 */
export function inferCapabilitiesFromModelMetadata(
  modelUsed: string | null | undefined,
): CapabilityClass[] {
  if (!modelUsed || modelUsed.trim().length === 0) {
    return [];
  }

  const lowered = modelUsed.toLowerCase();
  const capabilities = new Set<CapabilityClass>(['general_purpose']);

  if (/\b(code|coding|developer)\b/.test(lowered)) {
    capabilities.add('coding');
  }
  if (/\b(reason|reasoning|think|deep)\b/.test(lowered)) {
    capabilities.add('deep_reasoning');
  }
  if (/\b(long|context|large-context)\b/.test(lowered)) {
    capabilities.add('long_context');
  }
  if (/\b(tool|agent|function)\b/.test(lowered)) {
    capabilities.add('tool_using');
  }
  if (/\b(search|browse|web)\b/.test(lowered)) {
    capabilities.add('search_required');
  }
  if (/\b(vision|image|audio|multimodal)\b/.test(lowered)) {
    capabilities.add('multimodal');
  }
  if (/\b(local|private|offline)\b/.test(lowered)) {
    capabilities.add('privacy_sensitive_local');
  }
  if (/\b(cheap|fast|small|mini|lite)\b/.test(lowered)) {
    capabilities.add('cheap_fast');
  }

  return CAPABILITY_CLASSES.filter((capability) => capabilities.has(capability));
}
