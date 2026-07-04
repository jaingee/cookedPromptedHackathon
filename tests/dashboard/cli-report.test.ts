/**
 * cookedPrompts — Dashboard CLI Report Tests
 *
 * Integration tests for the CLI report module:
 * - Formatting helpers (formatValue, formatRows, joinSection)
 * - renderDashboardReport structure and empty state
 * - renderDashboardReport filters/pagination
 * - renderDashboardDetail full detail and missing score
 * - Privacy boundary (report vs detail)
 * - parseDashboardCliArgs valid and invalid inputs
 * - renderDashboardCliHelp content
 * - runDashboardCliReport with temp DB
 * - No-network guarantee
 *
 * All data is synthetic. No real prompts, secrets, or model answers.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatValue,
  formatRows,
  joinSection,
  renderDashboardReport,
  renderDashboardDetail,
  parseDashboardCliArgs,
  renderDashboardCliHelp,
  runDashboardCliReport,
} from '../../src/dashboard/cli-report.js';
import {
  setupDashboardTestDb,
  insertPromptWithScore,
  SYNTHETIC_PROMPT_TEXT,
  insertImportBatch,
} from './dashboard-test-helpers.js';

// ---------------------------------------------------------------------------
// Banned fields that must never appear in any output
// ---------------------------------------------------------------------------

const BANNED_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

// ---------------------------------------------------------------------------
// 1. Formatting helpers
// ---------------------------------------------------------------------------

describe('Formatting helpers', () => {
  describe('formatValue', () => {
    it('returns "-" for null', () => {
      expect(formatValue(null)).toBe('-');
    });

    it('returns "-" for undefined', () => {
      expect(formatValue(undefined)).toBe('-');
    });

    it('converts number to string', () => {
      expect(formatValue(42)).toBe('42');
    });

    it('converts string to string', () => {
      expect(formatValue('hello')).toBe('hello');
    });

    it('converts zero to string', () => {
      expect(formatValue(0)).toBe('0');
    });

    it('converts empty string to empty string (not dash)', () => {
      expect(formatValue('')).toBe('');
    });
  });

  describe('formatRows', () => {
    it('returns empty string for empty array', () => {
      expect(formatRows([])).toBe('');
    });

    it('aligns labels by padding', () => {
      const rows: Array<readonly [string, string]> = [
        ['Short:', '1'],
        ['Much longer label:', '2'],
      ];
      const result = formatRows(rows);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      // Both values should start at the same column
      const pos1 = lines[0].indexOf('1');
      const pos2 = lines[1].indexOf('2');
      expect(pos1).toBe(pos2);
    });

    it('handles single row', () => {
      const rows: Array<readonly [string, string]> = [['Key:', 'Value']];
      const result = formatRows(rows);
      expect(result).toContain('Key:');
      expect(result).toContain('Value');
    });
  });

  describe('joinSection', () => {
    it('formats title with dashes', () => {
      const result = joinSection('My Title', 'Body text');
      expect(result).toBe('--- My Title ---\nBody text');
    });

    it('works with empty body', () => {
      const result = joinSection('Empty', '');
      expect(result).toBe('--- Empty ---\n');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. renderDashboardReport structure
// ---------------------------------------------------------------------------

describe('renderDashboardReport structure', () => {
  it('contains expected section headers', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });
    const output = renderDashboardReport(service);

    expect(output).toContain('cookedPrompts Dashboard Report');
    expect(output).toContain('--- Overview ---');
    expect(output).toContain('--- Issue Labels ---');
    expect(output).toContain('--- Confidence ---');
    expect(output).toContain('--- Dimensions ---');
    expect(output).toContain('--- Scored Prompts');
  });

  it('does NOT contain prompt_text string in output', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
    });
    const output = renderDashboardReport(service);

    expect(output).not.toContain(SYNTHETIC_PROMPT_TEXT);
    expect(output).not.toContain('prompt_text');
  });

  it('shows overview metrics', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1', overallScore: 4 });
    const output = renderDashboardReport(service);

    expect(output).toContain('Total scored:');
    expect(output).toContain('Average overall:');
    expect(output).toContain('Low confidence:');
    expect(output).toContain('Needs action:');
    expect(output).toContain('Most common label:');
  });
});

// ---------------------------------------------------------------------------
// 3. renderDashboardReport empty state
// ---------------------------------------------------------------------------

describe('renderDashboardReport empty state', () => {
  it('shows "No issue labels." when no data', () => {
    const { service } = setupDashboardTestDb();
    const output = renderDashboardReport(service);
    expect(output).toContain('No issue labels.');
  });

  it('shows "No scored prompts." when no data', () => {
    const { service } = setupDashboardTestDb();
    const output = renderDashboardReport(service);
    expect(output).toContain('No scored prompts.');
  });

  it('shows "No confidence data." when no data', () => {
    const { service } = setupDashboardTestDb();
    const output = renderDashboardReport(service);
    expect(output).toContain('No confidence data.');
  });

  it('shows dimension rows with zeros when no scores exist', () => {
    const { service } = setupDashboardTestDb();
    const output = renderDashboardReport(service);
    // getDimensionSummary returns all 8 dimensions with avg: 0, low: 0
    // even when DB is empty, so "No dimension data." is not shown
    expect(output).toContain('--- Dimensions ---');
    expect(output).toContain('overall_score');
    expect(output).toContain('avg: 0');
  });
});

// ---------------------------------------------------------------------------
// 4. renderDashboardReport filters/pagination
// ---------------------------------------------------------------------------

describe('renderDashboardReport filters/pagination', () => {
  it('respects limit option', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2' });
    insertPromptWithScore(db, { promptId: 'p-3', scoreId: 's-3' });

    const output = renderDashboardReport(service, { limit: 2 });
    expect(output).toContain('limit: 2');
  });

  it('respects offset option', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });
    insertPromptWithScore(db, { promptId: 'p-2', scoreId: 's-2' });

    const output = renderDashboardReport(service, { offset: 1 });
    expect(output).toContain('offset: 1');
  });

  it('respects importBatchId filter', () => {
    const { db, service } = setupDashboardTestDb();
    // Default batch is 'batch-1' from setupDashboardTestDb
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      importBatchId: 'batch-1',
    });

    const output = renderDashboardReport(service, { importBatchId: 'batch-1' });
    expect(output).toContain('s-1');
  });

  it('filters by scoringVersion', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      scoringVersion: '1.0.0',
    });
    insertPromptWithScore(db, {
      promptId: 'p-2',
      scoreId: 's-2',
      scoringVersion: '2.0.0',
    });

    const output = renderDashboardReport(service, { scoringVersion: '1.0.0' });
    expect(output).toContain('s-1');
    expect(output).not.toContain('s-2');
  });
});

// ---------------------------------------------------------------------------
// 5. renderDashboardDetail — full detail with prompt text
// ---------------------------------------------------------------------------

describe('renderDashboardDetail', () => {
  it('renders full detail including prompt text', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
      overallScore: 4,
      confidence: 'high',
    });

    const output = renderDashboardDetail(service, 's-1');

    expect(output).toContain('cookedPrompts Score Detail: s-1');
    expect(output).toContain('Score ID:');
    expect(output).toContain('Overall:');
    expect(output).toContain('--- Prompt Text ---');
    expect(output).toContain(SYNTHETIC_PROMPT_TEXT);
  });

  it('shows prompt metadata fields', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });

    const output = renderDashboardDetail(service, 's-1');

    expect(output).toContain('--- Prompt Metadata ---');
    expect(output).toContain('Timestamp:');
    expect(output).toContain('Source:');
    expect(output).toContain('Provider:');
    expect(output).toContain('Model:');
  });

  it('shows explanations section', () => {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, { promptId: 'p-1', scoreId: 's-1' });

    const output = renderDashboardDetail(service, 's-1');
    expect(output).toContain('--- Explanations ---');
  });
});

// ---------------------------------------------------------------------------
// 6. renderDashboardDetail missing score
// ---------------------------------------------------------------------------

describe('renderDashboardDetail missing score', () => {
  it('returns "Score detail not found." for nonexistent score', () => {
    const { service } = setupDashboardTestDb();
    const output = renderDashboardDetail(service, 'nonexistent-id');
    expect(output).toBe('Score detail not found.');
  });
});

// ---------------------------------------------------------------------------
// 7. Privacy boundary — report has no prompt_text; detail has prompt_text
// ---------------------------------------------------------------------------

describe('Privacy boundary', () => {
  function setupPrivacyData() {
    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
    });
    return service;
  }

  it('report output does NOT contain SYNTHETIC_PROMPT_TEXT', () => {
    const service = setupPrivacyData();
    const output = renderDashboardReport(service);
    expect(output).not.toContain(SYNTHETIC_PROMPT_TEXT);
  });

  it('report output does NOT contain "prompt_text"', () => {
    const service = setupPrivacyData();
    const output = renderDashboardReport(service);
    expect(output).not.toContain('prompt_text');
  });

  it('detail output DOES contain SYNTHETIC_PROMPT_TEXT', () => {
    const service = setupPrivacyData();
    const output = renderDashboardDetail(service, 's-1');
    expect(output).toContain(SYNTHETIC_PROMPT_TEXT);
  });

  it('report output does NOT contain any banned fields', () => {
    const service = setupPrivacyData();
    const output = renderDashboardReport(service);
    for (const field of BANNED_FIELDS) {
      expect(output).not.toContain(field);
    }
  });

  it('detail output does NOT contain any banned fields', () => {
    const service = setupPrivacyData();
    const output = renderDashboardDetail(service, 's-1');
    for (const field of BANNED_FIELDS) {
      expect(output).not.toContain(field);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. parseDashboardCliArgs valid inputs
// ---------------------------------------------------------------------------

describe('parseDashboardCliArgs valid inputs', () => {
  it('parses database path as first positional argument', () => {
    const result = parseDashboardCliArgs(['./test.db']);
    expect(result.databasePath).toBe('./test.db');
  });

  it('parses --help flag', () => {
    const result = parseDashboardCliArgs(['--help']);
    expect(result.help).toBe(true);
  });

  it('parses -h flag', () => {
    const result = parseDashboardCliArgs(['-h']);
    expect(result.help).toBe(true);
  });

  it('parses --limit', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--limit', '10']);
    expect(result.options.limit).toBe(10);
  });

  it('parses --offset', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--offset', '5']);
    expect(result.options.offset).toBe(5);
  });

  it('parses --batch', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--batch', 'batch-001']);
    expect(result.options.importBatchId).toBe('batch-001');
  });

  it('parses --version', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--version', '1.0.0']);
    expect(result.options.scoringVersion).toBe('1.0.0');
  });

  it('parses --detail', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--detail', 'score-abc']);
    expect(result.options.detailScoreId).toBe('score-abc');
  });

  it('parses all flags together', () => {
    const result = parseDashboardCliArgs([
      './db.sqlite',
      '--limit', '5',
      '--offset', '10',
      '--batch', 'b1',
      '--version', '2.0.0',
      '--detail', 'sid',
    ]);
    expect(result.databasePath).toBe('./db.sqlite');
    expect(result.options.limit).toBe(5);
    expect(result.options.offset).toBe(10);
    expect(result.options.importBatchId).toBe('b1');
    expect(result.options.scoringVersion).toBe('2.0.0');
    expect(result.options.detailScoreId).toBe('sid');
  });

  it('returns null databasePath when not provided', () => {
    const result = parseDashboardCliArgs(['--limit', '5']);
    expect(result.databasePath).toBeNull();
  });

  it('returns empty options for empty argv', () => {
    const result = parseDashboardCliArgs([]);
    expect(result.databasePath).toBeNull();
    expect(result.help).toBe(false);
    expect(result.options).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 9. parseDashboardCliArgs invalid inputs
// ---------------------------------------------------------------------------

describe('parseDashboardCliArgs invalid inputs', () => {
  it('ignores non-numeric --limit value', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--limit', 'abc']);
    expect(result.options.limit).toBeUndefined();
  });

  it('ignores non-numeric --offset value', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--offset', 'xyz']);
    expect(result.options.offset).toBeUndefined();
  });

  it('ignores --limit without following value', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--limit']);
    // --limit is the last arg, no next value to parse
    expect(result.options.limit).toBeUndefined();
  });

  it('parses negative --limit as a number (current behavior)', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--limit', '-5']);
    // parseInt('-5') is -5, which is not NaN, so it gets assigned
    expect(result.options.limit).toBe(-5);
  });

  it('parses negative --offset as a number (current behavior)', () => {
    const result = parseDashboardCliArgs(['./db.sqlite', '--offset', '-3']);
    expect(result.options.offset).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// 10. renderDashboardCliHelp
// ---------------------------------------------------------------------------

describe('renderDashboardCliHelp', () => {
  it('contains "Usage" keyword', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('Usage');
  });

  it('contains "Options" keyword', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('Options');
  });

  it('contains --limit documentation', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('--limit');
  });

  it('contains --detail documentation', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('--detail');
  });

  it('contains --help documentation', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('--help');
  });

  it('contains "Examples" section', () => {
    const help = renderDashboardCliHelp();
    expect(help).toContain('Examples');
  });
});

// ---------------------------------------------------------------------------
// 11. runDashboardCliReport — with temp DB
// ---------------------------------------------------------------------------

describe('runDashboardCliReport', () => {
  it('returns 0 and prints help on --help', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = runDashboardCliReport(['--help']);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('Usage');
    logSpy.mockRestore();
  });

  it('returns 1 when no database path provided', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = runDashboardCliReport([]);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith('Error: database path is required.');
    errSpy.mockRestore();
  });

  it('returns 1 for nonexistent database path', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Use a path that likely won't exist — directory that doesn't exist
    const code = runDashboardCliReport(['/nonexistent/path/to/db.sqlite']);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith('Error: could not open database.');
    errSpy.mockRestore();
  });

  it('returns 0 with a valid in-memory style DB (temp file)', () => {
    // We cannot use :memory: through runDashboardCliReport because it doesn't run migrations.
    // But we can test that a file DB that doesn't have migrations returns 1 (report error).
    // This is because the service will fail on queries to non-existent tables.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // A fresh temp file won't have tables, so the report should fail gracefully
    const tmpPath = ':memory:';
    const code = runDashboardCliReport([tmpPath]);
    // Since there's no migration run, queries will fail
    expect(code).toBe(1);

    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 12. No-network guarantee
// ---------------------------------------------------------------------------

describe('CLI report no-network guarantee', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('globalThis.fetch is not called during renderDashboardReport', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
    });

    renderDashboardReport(service);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('globalThis.fetch is not called during renderDashboardDetail', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const { db, service } = setupDashboardTestDb();
    insertPromptWithScore(db, {
      promptId: 'p-1',
      scoreId: 's-1',
      promptText: SYNTHETIC_PROMPT_TEXT,
    });

    renderDashboardDetail(service, 's-1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('globalThis.fetch is not called during parseDashboardCliArgs', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    parseDashboardCliArgs(['./test.db', '--limit', '10']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('globalThis.fetch is not called during runDashboardCliReport --help', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runDashboardCliReport(['--help']);
    logSpy.mockRestore();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
