/**
 * cookedPrompts — Local Safety/Privacy Pattern Matcher
 *
 * Deterministic, local regex heuristics that classify a prompt into safety
 * categories. Detection is category-level only.
 *
 * PRIVACY: This module NEVER returns matched substrings or their values.
 * It returns only a category + severity. No real secrets appear in source
 * or comments. No network, no storage, no LLM.
 */

export type SafetyPatternSeverity = 'high' | 'medium';

export type SafetyPatternCategory =
  | 'api_key_like'
  | 'access_token_like'
  | 'private_key_marker'
  | 'password_assignment'
  | 'email_or_personal_data'
  | 'company_sensitive'
  | 'prompt_injection';

export interface SafetyPatternMatch {
  severity: SafetyPatternSeverity;
  category: SafetyPatternCategory;
}

interface SafetyRule {
  severity: SafetyPatternSeverity;
  category: SafetyPatternCategory;
  pattern: RegExp;
}

/**
 * Local heuristic rules. Patterns are intentionally broad and safe.
 * Order here defines the canonical output order for deduped matches.
 */
const SAFETY_RULES: readonly SafetyRule[] = [
  // High severity — potential secrets/credentials.
  {
    severity: 'high',
    category: 'private_key_marker',
    pattern: /-----begin[a-z ]*private key-----/i,
  },
  {
    severity: 'high',
    category: 'api_key_like',
    // Long random-looking token with a key-ish prefix, or "api key" phrasing.
    pattern: /\b(?:api[_-]?key|apikey|secret[_-]?key)\b|\b[A-Za-z0-9_-]{32,}\b/i,
  },
  {
    severity: 'high',
    category: 'access_token_like',
    pattern: /\b(?:access[_-]?token|bearer|auth[_-]?token|refresh[_-]?token)\b/i,
  },
  {
    severity: 'high',
    category: 'password_assignment',
    // e.g. "password = ...", "pwd: ...", "secret=..."
    pattern: /\b(?:password|passwd|pwd|secret)\b\s*[:=]/i,
  },
  // Medium severity — personal/company-sensitive/injection.
  {
    severity: 'medium',
    category: 'email_or_personal_data',
    pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
  },
  {
    severity: 'medium',
    category: 'company_sensitive',
    pattern: /\b(?:confidential|internal only|internal-use|proprietary|do not share|nda)\b/i,
  },
  {
    severity: 'medium',
    category: 'prompt_injection',
    pattern:
      /\b(?:ignore (?:all )?previous instructions|disregard (?:the )?(?:system|above)|override your (?:rules|instructions))\b/i,
  },
];

/**
 * Return category + severity for each matched safety rule, deduped by
 * category in canonical rule order. Never returns matched text.
 */
export function matchSafetyPatterns(text: string): SafetyPatternMatch[] {
  const seen = new Set<SafetyPatternCategory>();
  const matches: SafetyPatternMatch[] = [];

  for (const rule of SAFETY_RULES) {
    if (seen.has(rule.category)) continue;
    if (rule.pattern.test(text)) {
      seen.add(rule.category);
      matches.push({ severity: rule.severity, category: rule.category });
    }
  }

  return matches;
}
