/**
 * cookedPrompts — CSV Parser
 *
 * Parses raw comma-delimited CSV text into RawImportEntry objects.
 * First row is the header. Supports RFC 4180-style quoted fields.
 *
 * This parser does NOT:
 * - validate field semantics
 * - strip full model answer fields
 * - normalize data
 * - access storage or network
 */

import type { RawImportEntry } from '../types.js';

/** A successfully parsed row from CSV input. */
export interface CsvParsedRow {
  row_number: number;
  entry: RawImportEntry;
}

/** A parse issue encountered while reading CSV. */
export interface CsvParseIssue {
  row_number: number;
  message: string;
}

/** Result of parsing a CSV string. */
export interface CsvParseResult {
  rows: CsvParsedRow[];
  issues: CsvParseIssue[];
  headers: string[];
}

/**
 * Parse raw CSV text content (comma-delimited, RFC 4180 quoting).
 *
 * Header row is required. Column names are trimmed and lowercased.
 * Row numbers are 1-indexed (header = row 1, first data row = row 2).
 */
export function parseCsv(content: string): CsvParseResult {
  const rows: CsvParsedRow[] = [];
  const issues: CsvParseIssue[] = [];

  if (content.trim() === '') {
    issues.push({ row_number: 1, message: 'CSV content is empty.' });
    return { rows, issues, headers: [] };
  }

  const rawRows = splitCsvRows(content);

  if (rawRows.length === 0) {
    issues.push({ row_number: 1, message: 'CSV content is empty.' });
    return { rows, issues, headers: [] };
  }

  // Parse header row
  const headerParseResult = parseRow(rawRows[0]!);
  if (headerParseResult.error) {
    issues.push({ row_number: 1, message: `Header row: ${headerParseResult.error}` });
    return { rows, issues, headers: [] };
  }

  const headers = headerParseResult.fields.map((h) => h.trim().toLowerCase());

  if (headers.length === 0 || headers.every((h) => h === '')) {
    issues.push({ row_number: 1, message: 'Header row contains no field names.' });
    return { rows, issues, headers: [] };
  }

  // Parse data rows
  for (let i = 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i]!;
    const rowNumber = i + 1; // header is row 1

    // Skip completely empty trailing rows
    if (rawRow.trim() === '') {
      continue;
    }

    const result = parseRow(rawRow);
    if (result.error) {
      issues.push({ row_number: rowNumber, message: `Row ${rowNumber}: ${result.error}` });
      continue;
    }

    const fields = result.fields;

    // Check for extra cells beyond header count
    if (fields.length > headers.length) {
      issues.push({
        row_number: rowNumber,
        message: `Row ${rowNumber}: has ${fields.length} cells but header has ${headers.length} columns.`,
      });
      continue;
    }

    // Build entry from header-to-value mapping
    const entry: RawImportEntry = {};
    for (let col = 0; col < headers.length; col++) {
      const key = headers[col]!;
      if (key === '') continue; // skip unnamed columns
      entry[key] = col < fields.length ? fields[col]! : '';
    }

    rows.push({ row_number: rowNumber, entry });
  }

  return { rows, issues, headers };
}

// --- Internal helpers ---

/**
 * Split CSV content into logical rows, respecting quoted fields
 * that may contain newlines.
 */
function splitCsvRows(content: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < content.length && content[i + 1] === '"') {
          current += '""';
          i++; // skip next quote
        } else {
          // End of quoted section
          inQuotes = false;
          current += ch;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === '\r') {
        // Handle CRLF
        if (i + 1 < content.length && content[i + 1] === '\n') {
          i++; // skip LF
        }
        rows.push(current);
        current = '';
      } else if (ch === '\n') {
        rows.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // Push remaining content
  if (current !== '' || rows.length === 0) {
    rows.push(current);
  }

  return rows;
}

/**
 * Parse a single CSV row string into field values.
 * Handles RFC 4180 quoting.
 */
function parseRow(row: string): { fields: string[]; error?: string } {
  const fields: string[] = [];
  let i = 0;

  while (i <= row.length) {
    if (i === row.length) {
      // Trailing comma produced an empty final field
      // Only add if we already started (comma at end)
      break;
    }

    if (row[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = '';
      let closed = false;

      while (i < row.length) {
        if (row[i] === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            closed = true;
            break;
          }
        } else {
          value += row[i];
          i++;
        }
      }

      if (!closed) {
        return { fields: [], error: 'unclosed quoted field.' };
      }

      fields.push(value);

      // After closing quote, expect comma or end
      if (i < row.length) {
        if (row[i] === ',') {
          i++; // skip comma
        } else {
          return { fields: [], error: 'unexpected character after closing quote.' };
        }
      }
    } else {
      // Unquoted field
      let value = '';
      while (i < row.length && row[i] !== ',') {
        value += row[i];
        i++;
      }
      fields.push(value);

      if (i < row.length && row[i] === ',') {
        i++; // skip comma
        // If comma is at very end, add empty trailing field
        if (i === row.length) {
          fields.push('');
        }
      }
    }
  }

  return { fields };
}
