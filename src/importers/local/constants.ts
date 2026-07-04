/**
 * cookedPrompts Local Importer — Constants
 *
 * Centralized constants for the local importer module.
 */

/**
 * Banned full model answer field names.
 *
 * cookedPrompts V1 does not store full model answers. During import,
 * any fields matching these names (case-insensitive) will be stripped
 * from raw entries and a warning will be emitted to the user.
 *
 * The stripping logic is implemented in a later task (Wave 4).
 * This constant centralizes the list so all components reference
 * one source of truth for banned field detection.
 */
export const BANNED_FULL_ANSWER_FIELDS: readonly string[] = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
] as const;
