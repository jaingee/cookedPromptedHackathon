/**
 * cookedPrompts — JSONL Parser
 *
 * Parses raw JSONL text content into RawImportEntry objects.
 * One JSON object per line. Empty lines are skipped.
 * Malformed lines produce parse issues with line numbers.
 *
 * This parser does NOT:
 * - validate field semantics
 * - strip full model answer fields
 * - normalize data
 * - access storage or network
 */

import type { RawImportEntry } from '../types.js';

/** A successfully parsed row from JSONL input. */
export interface JsonlParsedRow {
  row_number: number;
  entry: RawImportEntry;
}

/** A parse issue encountered while reading a JSONL line. */
export interface JsonlParseIssue {
  row_number: number;
  message: string;
}

/** Result of parsing a JSONL string. */
export interface JsonlParseResult {
  rows: JsonlParsedRow[];
  issues: JsonlParseIssue[];
}

/**
 * Parse raw JSONL text content.
 *
 * Each non-empty line must be a valid JSON object.
 * Empty lines are skipped. Non-object JSON values produce issues.
 */
export function parseJsonl(content: string): JsonlParseResult {
  const rows: JsonlParsedRow[] = [];
  const issues: JsonlParseIssue[] = [];

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1; // 1-indexed

    // Skip empty lines
    if (line.trim() === '') {
      continue;
    }

    // Attempt JSON parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      issues.push({
        row_number: lineNumber,
        message: `Line ${lineNumber}: invalid JSON syntax.`,
      });
      continue;
    }

    // Must be a plain object (not array, string, number, boolean, null)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      issues.push({
        row_number: lineNumber,
        message: `Line ${lineNumber}: expected a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}.`,
      });
      continue;
    }

    rows.push({
      row_number: lineNumber,
      entry: parsed as RawImportEntry,
    });
  }

  return { rows, issues };
}
