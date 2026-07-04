/**
 * cookedPrompts — Safety Scanner Rules
 *
 * Deterministic local heuristics. Each rule inspects prompt text/metadata
 * in memory and returns ONLY a boolean. Rules never return, store, or expose
 * matched substrings, prompt text, previews, prefixes, suffixes, or hashes.
 *
 * PRIVACY: module-level regexes are private. No matched values leave a rule.
 * No network, no storage, no LLM.
 */

import type {
  SafetyWarningCategory,
  SafetySeverity,
  SafetyConfidence,
  SafetyScanInput,
} from './types.js';

export interface SafetyRule {
  id: string;
  category: SafetyWarningCategory;
  severity: SafetySeverity;
  confidence: SafetyConfidence;
  message: string;
  location_hint: string;
  recommendation?: string;
  matches(input: SafetyScanInput): boolean;
}

export const SAFETY_SCANNER_VERSION = '1.0.0';

// --- Private module-level regexes (never exported, never leak values) ---

const PRIVATE_KEY_BLOCK = /-----begin[a-z ]*private key-----/i;

const SECRET_KEYWORD = /\b(?:api[_-]?key|apikey|secret[_-]?key)\b/i;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/;

const CREDENTIAL_ASSIGNMENT = /\b(?:password|passwd|pwd|secret)\b\s*[:=]/i;
const CREDENTIAL_TOKEN = /\b(?:access[_-]?token|bearer|auth[_-]?token|refresh[_-]?token)\b/i;

const EMAIL_LIKE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

const CUSTOMER_REFERENCE = /\b(?:customer|client|account|acct)\b/i;

const COMPANY_SENSITIVE = /\b(?:confidential|internal only|internal-use|proprietary|do not share|nda)\b/i;

const PRIVATE_SOURCE_CODE =
  /\b(?:private repo(?:sitory)?|proprietary source|internal source code|do not publish)\b/i;

const PROMPT_INJECTION =
  /\b(?:ignore (?:all )?previous instructions|disregard (?:the )?(?:system|above)|reveal (?:your )?hidden instructions|override your (?:rules|instructions))\b/i;

const HALLUCINATION_RISK =
  /\b(?:are you (?:100% )?(?:sure|certain)|guarantee (?:this is )?correct|exact (?:current )?(?:number|figure|statistic))\b/i;

const CITATION_NEEDED =
  /\b(?:statistics?|studies show|legal advice|medical advice|financial advice|according to research)\b/i;

const UNSAFE_RETENTION =
  /\b(?:store this permanently|remember this (?:secret|password|forever)|save this (?:private )?data forever|keep this forever)\b/i;

/** Test a regex against any tag values without leaking matched text. */
function tagsMatch(input: SafetyScanInput, pattern: RegExp): boolean {
  if (!Array.isArray(input.tags)) {
    return false;
  }
  for (const tag of input.tags) {
    if (typeof tag === 'string' && pattern.test(tag)) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministic canonical order:
 * secrets/credentials first, then privacy/sensitive, then behavioral risks.
 */
export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    id: 'private_key',
    category: 'private_key',
    severity: 'critical',
    confidence: 'high',
    message: 'Prompt may contain a private key block.',
    location_hint: 'contains private-key-like block',
    recommendation:
      'Remove or replace the private key before analysis, export, or sharing.',
    matches(input) {
      return PRIVATE_KEY_BLOCK.test(input.prompt_text);
    },
  },
  {
    id: 'secret_like',
    category: 'secret_like',
    severity: 'high',
    confidence: 'medium',
    message: 'Prompt may contain a secret-like value.',
    location_hint: 'contains token-like value',
    recommendation:
      'Remove or replace sensitive values before analysis, export, or sharing.',
    matches(input) {
      return (
        SECRET_KEYWORD.test(input.prompt_text) || LONG_TOKEN.test(input.prompt_text)
      );
    },
  },
  {
    id: 'credential_like',
    category: 'credential_like',
    severity: 'high',
    confidence: 'medium',
    message: 'Prompt may contain credential-like material.',
    location_hint: 'contains credential-like value',
    recommendation:
      'Remove or replace credentials before analysis, export, or sharing.',
    matches(input) {
      return (
        CREDENTIAL_ASSIGNMENT.test(input.prompt_text) ||
        CREDENTIAL_TOKEN.test(input.prompt_text)
      );
    },
  },
  {
    id: 'personal_data',
    category: 'personal_data',
    severity: 'medium',
    confidence: 'medium',
    message: 'Prompt may contain personal data.',
    location_hint: 'contains personal-data-like value',
    recommendation:
      'Remove or anonymize personal data before analysis, export, or sharing.',
    matches(input) {
      return EMAIL_LIKE.test(input.prompt_text);
    },
  },
  {
    id: 'customer_data',
    category: 'customer_data',
    severity: 'medium',
    confidence: 'low',
    message: 'Prompt may reference customer data.',
    location_hint: 'contains customer-data-like reference',
    recommendation:
      'Confirm no real customer data is included before analysis, export, or sharing.',
    matches(input) {
      return (
        CUSTOMER_REFERENCE.test(input.prompt_text) ||
        tagsMatch(input, CUSTOMER_REFERENCE)
      );
    },
  },
  {
    id: 'company_sensitive',
    category: 'company_sensitive',
    severity: 'medium',
    confidence: 'medium',
    message: 'Prompt may contain company-sensitive material.',
    location_hint: 'contains company-sensitive marker',
    recommendation: 'Confirm sharing is permitted before analysis, export, or sharing.',
    matches(input) {
      return (
        COMPANY_SENSITIVE.test(input.prompt_text) ||
        tagsMatch(input, COMPANY_SENSITIVE)
      );
    },
  },
  {
    id: 'private_source_code',
    category: 'private_source_code',
    severity: 'medium',
    confidence: 'low',
    message: 'Prompt may reference private source code.',
    location_hint: 'contains private-source-code reference',
    recommendation: 'Confirm the source may be shared before analysis or export.',
    matches(input) {
      return (
        PRIVATE_SOURCE_CODE.test(input.prompt_text) ||
        tagsMatch(input, PRIVATE_SOURCE_CODE)
      );
    },
  },
  {
    id: 'prompt_injection',
    category: 'prompt_injection',
    severity: 'high',
    confidence: 'medium',
    message: 'Prompt may include a prompt-injection attempt.',
    location_hint: 'contains prompt-injection-like instruction',
    recommendation:
      'Review the prompt for injection attempts before trusting its output.',
    matches(input) {
      return PROMPT_INJECTION.test(input.prompt_text);
    },
  },
  {
    id: 'hallucination_risk',
    category: 'hallucination_risk',
    severity: 'low',
    confidence: 'low',
    message: 'Prompt may carry hallucination risk.',
    location_hint: 'prompt_text',
    recommendation:
      'Ask for sources or acknowledge uncertainty before relying on factual output.',
    matches(input) {
      return HALLUCINATION_RISK.test(input.prompt_text);
    },
  },
  {
    id: 'citation_needed',
    category: 'citation_needed',
    severity: 'low',
    confidence: 'low',
    message: 'Prompt may need a citation requirement.',
    location_hint: 'prompt_text',
    recommendation:
      'Add a source or citation instruction before relying on factual output.',
    matches(input) {
      return CITATION_NEEDED.test(input.prompt_text);
    },
  },
  {
    id: 'unsafe_retention_assumption',
    category: 'unsafe_retention_assumption',
    severity: 'medium',
    confidence: 'low',
    message: 'Prompt may assume unsafe data retention.',
    location_hint: 'prompt_text',
    recommendation: 'Do not assume long-term retention of sensitive data.',
    matches(input) {
      return UNSAFE_RETENTION.test(input.prompt_text);
    },
  },
];
