/**
 * cookedPrompts — Integration Demo Privacy Guards
 *
 * Small deterministic helpers for privacy boundary enforcement
 * and content-free error generation.
 *
 * No network. No side effects. No prompt text handling.
 */

import type { PipelineOptions, PipelineStep } from './types.js';

/**
 * Determine whether prompt_text should be included in PromptResult output.
 * Default: false. Only true when explicitly opted in.
 */
export function shouldIncludePromptText(options?: PipelineOptions): boolean {
  return options?.include_prompt_text === true;
}

/**
 * Produce a content-free error message for a pipeline step failure.
 * Never includes prompt text, stack traces, matched values, or secrets.
 */
export function makeContentFreeError(step: PipelineStep): string {
  return `Pipeline failed at ${step}.`;
}

/** Banned output field names that must never appear in demo output. */
export const BANNED_OUTPUT_FIELDS: readonly string[] = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

/**
 * Check if a key is a banned output field name.
 */
export function isBannedOutputKey(key: string): boolean {
  return BANNED_OUTPUT_FIELDS.includes(key);
}
