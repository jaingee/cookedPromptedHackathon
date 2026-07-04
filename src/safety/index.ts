/**
 * cookedPrompts — Safety/Redaction Module Boundary
 *
 * Public exports for local safety/redaction contracts and scanner.
 */

export type {
  SafetyWarningCategory,
  SafetySeverity,
  SafetyConfidence,
  SafetyWarning,
  SafetyScanInput,
  SafetyScanResult,
} from './types.js';

export type { SafetyRule } from './rules.js';
export { SAFETY_SCANNER_VERSION, SAFETY_RULES } from './rules.js';

export type { SafetyScannerOptions } from './safety-scanner.js';
export { scanPromptSafety } from './safety-scanner.js';
