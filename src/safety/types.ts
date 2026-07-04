/**
 * cookedPrompts — Safety/Redaction Data Contracts
 *
 * Local-first safety scan types.
 *
 * Privacy boundary:
 * - Scan input may contain prompt_text for local inspection.
 * - Scan output must never contain prompt_text, matched substrings,
 *   redacted prompt copies, previews, suffixes, prefixes, or hashes.
 * - No full model answer fields are accepted or emitted.
 */

/** Risk categories a safety scan can flag. */
export type SafetyWarningCategory =
  | 'secret_like'
  | 'credential_like'
  | 'private_key'
  | 'personal_data'
  | 'customer_data'
  | 'company_sensitive'
  | 'private_source_code'
  | 'prompt_injection'
  | 'hallucination_risk'
  | 'citation_needed'
  | 'unsafe_retention_assumption'
  | 'unknown';

/** Severity of a safety warning. */
export type SafetySeverity = 'low' | 'medium' | 'high' | 'critical';

/** Confidence in a safety warning. */
export type SafetyConfidence = 'low' | 'medium' | 'high';

/**
 * A single value-free safety warning.
 * Never contains prompt text, matched substrings, redacted copies,
 * previews, prefixes, suffixes, or hashes of matched values.
 */
export interface SafetyWarning {
  id: string;
  prompt_log_id?: string;
  category: SafetyWarningCategory;
  severity: SafetySeverity;
  confidence: SafetyConfidence;
  message: string;
  location_hint?: string;
  recommendation?: string;
  scanner_version: string;
  created_at: string;
}

/**
 * Input to a local safety scan.
 * May contain prompt_text because the scanner inspects it locally.
 * Never accepts full model answer fields.
 */
export interface SafetyScanInput {
  prompt_log_id?: string;
  prompt_text: string;
  source?: string;
  provider?: string;
  model_used?: string;
  tags?: string[];
}

/**
 * Result of a local safety scan.
 * Contains value-free warnings only — never prompt text or matched values.
 */
export interface SafetyScanResult {
  prompt_log_id?: string;
  warnings: SafetyWarning[];
  highest_severity: SafetySeverity | null;
  scanner_version: string;
  scanned_at: string;
}
