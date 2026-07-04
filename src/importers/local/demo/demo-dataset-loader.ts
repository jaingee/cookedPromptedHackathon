/**
 * cookedPrompts — Demo Dataset Loader
 *
 * Provides the built-in "20 Prompts Later: Your AI Habits Exposed" demo dataset
 * as RawImportEntry objects ready to pass through the same validation and
 * normalization pipeline as real imports.
 *
 * All data is synthetic. No real user prompts, secrets, or model answers.
 */

import type { RawImportEntry } from '../types.js';
import { DEMO_ENTRIES } from './demo-data.js';

/**
 * Load the built-in demo dataset.
 *
 * Returns a fresh copy of the demo entries as mutable RawImportEntry objects.
 * The demo uses source: "demo" and provider: "demo".
 */
export function loadDemoDataset(): RawImportEntry[] {
  // Return deep copies so downstream processing cannot mutate the source data
  return DEMO_ENTRIES.map((entry) => ({ ...entry }));
}
