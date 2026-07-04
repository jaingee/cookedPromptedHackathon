/**
 * cookedPrompts — Safety Handoff Adapter (Stub)
 *
 * PRIVACY-CRITICAL BOUNDARY MODULE.
 *
 * This adapter defines the contract between the importer and the local
 * safety/redaction system. In V1, the real safety scanner is not yet
 * implemented — this stub returns a deterministic "not yet scanned" result.
 *
 * Guardrails enforced here:
 * - Accepts ONLY normalized PromptLogEntry records (never raw or banned fields).
 * - Never calls external services, AI models, or network endpoints.
 * - Never logs, stores, or echoes prompt text content.
 * - Never includes full model answer content (already stripped upstream).
 * - Returns only entry IDs and status metadata — never sensitive values.
 * - Deterministic and local. Easy to replace with a real scanner later.
 */

import type { PromptLogEntry, SafetyHandoffResult } from '../types.js';

/**
 * Interface for a safety handoff adapter.
 *
 * Future real implementations will perform local-only pattern scanning
 * (API keys, secrets, PII indicators). This interface keeps the contract
 * narrow so implementations can be swapped or tested with fakes.
 */
export interface SafetyHandoffAdapter {
  /**
   * Scan normalized entries for potential safety/redaction concerns.
   *
   * MUST be local-only. MUST NOT call external services.
   * MUST NOT include prompt text or sensitive values in returned warnings.
   *
   * @param entries Normalized entries (banned fields already stripped).
   * @returns Safety scan result with per-entry warnings (field names/types only).
   */
  scan(entries: PromptLogEntry[]): SafetyHandoffResult;
}

/**
 * Stub implementation of the safety handoff adapter.
 *
 * Returns an empty result indicating no safety analysis has been performed.
 * The real implementation will be created in a later task when the safety
 * module is built.
 *
 * This stub is deterministic: same input always produces same output shape
 * (zero warnings, correct scan count).
 */
export class StubSafetyHandoffAdapter implements SafetyHandoffAdapter {
  scan(entries: PromptLogEntry[]): SafetyHandoffResult {
    // No real scanning yet. Return a clean result indicating entries were
    // acknowledged but not deeply analyzed.
    return {
      entries_scanned: entries.length,
      warnings: [],
    };
  }
}
