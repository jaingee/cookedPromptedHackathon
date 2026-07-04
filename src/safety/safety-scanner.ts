/**
 * cookedPrompts — Safety Scanner
 *
 * Runs deterministic local rules over a scan input and produces value-free
 * warnings. Never returns prompt text, matched substrings, redacted copies,
 * previews, prefixes, suffixes, or hashes. No network, no storage, no LLM.
 */

import type {
  SafetyScanInput,
  SafetyScanResult,
  SafetyWarning,
  SafetySeverity,
} from './types.js';
import { SAFETY_RULES, SAFETY_SCANNER_VERSION } from './rules.js';

/** Optional injectable clock for deterministic timestamps in tests. */
export interface SafetyScannerOptions {
  now?: () => string;
}

const SEVERITY_RANK: Record<SafetySeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function getHighestSeverity(
  warnings: readonly SafetyWarning[],
): SafetySeverity | null {
  let highest: SafetySeverity | null = null;
  for (const w of warnings) {
    if (highest === null || SEVERITY_RANK[w.severity] > SEVERITY_RANK[highest]) {
      highest = w.severity;
    }
  }
  return highest;
}

function createWarningId(
  promptLogId: string | undefined,
  ruleId: string,
  index: number,
): string {
  const scope =
    promptLogId && promptLogId.trim().length > 0 ? promptLogId : 'local';
  return `safety:${scope}:${ruleId}:${index}`;
}

export function scanPromptSafety(
  input: SafetyScanInput,
  options?: SafetyScannerOptions,
): SafetyScanResult {
  const now = options?.now ?? (() => new Date().toISOString());
  const scanned_at = now();

  // Guard against malformed runtime input without leaking content.
  const promptText =
    typeof input?.prompt_text === 'string' ? input.prompt_text : '';
  const safeInput: SafetyScanInput = {
    prompt_log_id: input?.prompt_log_id,
    prompt_text: promptText,
    source: input?.source,
    provider: input?.provider,
    model_used: input?.model_used,
    tags: Array.isArray(input?.tags) ? input.tags : undefined,
  };

  const warnings: SafetyWarning[] = [];

  if (
    promptText.trim().length > 0 ||
    (safeInput.tags && safeInput.tags.length > 0)
  ) {
    let index = 0;
    for (const rule of SAFETY_RULES) {
      let fired = false;
      try {
        fired = rule.matches(safeInput);
      } catch {
        fired = false; // never leak content through errors
      }
      if (fired) {
        warnings.push({
          id: createWarningId(safeInput.prompt_log_id, rule.id, index),
          prompt_log_id: safeInput.prompt_log_id,
          category: rule.category,
          severity: rule.severity,
          confidence: rule.confidence,
          message: rule.message,
          location_hint: rule.location_hint,
          recommendation: rule.recommendation,
          scanner_version: SAFETY_SCANNER_VERSION,
          created_at: scanned_at,
        });
        index += 1;
      }
    }
  }

  return {
    prompt_log_id: safeInput.prompt_log_id,
    warnings,
    highest_severity: getHighestSeverity(warnings),
    scanner_version: SAFETY_SCANNER_VERSION,
    scanned_at,
  };
}
