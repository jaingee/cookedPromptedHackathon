/**
 * cookedPrompts — Scoring Persistence Privacy Tests (Wave 4, Task 4.8)
 *
 * Proves persistence does not leak prompt text, banned fields, or network calls.
 * Uses source text assertions and returned object assertions.
 *
 * All data synthetic. No real prompts, secrets, or model answers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SqliteDatabase } from '../../../src/storage/sqlite/index.js';
import { PromptScoreRepository } from '../../../src/storage/sqlite/repositories/prompt-score-repository.js';
import type { ScoringIssueLabel } from '../../../src/scoring/types.js';
import {
  createMigratedMemoryDb,
  insertImportBatch,
  insertPromptLog,
  makeScore,
  setupTestDb,
} from './prompt-score-test-helpers.js';

const BANNED_FIELDS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
  'prompt_text',
];

describe('Scoring persistence privacy', () => {
  let db: SqliteDatabase;
  let repo: PromptScoreRepository;

  beforeEach(() => {
    const setup = setupTestDb(3);
    db = setup.db;
    repo = setup.repo;
  });

  it('repository results from getById do not include prompt_text or banned fields', () => {
    repo.save(makeScore());
    const result = repo.getById('score-1')!;
    for (const field of BANNED_FIELDS) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('repository results from getByPromptLogId do not include prompt_text or banned fields', () => {
    repo.save(makeScore());
    const result = repo.getByPromptLogId('prompt-1')!;
    for (const field of BANNED_FIELDS) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('repository results from getByPromptLogIds do not include prompt_text or banned fields', () => {
    repo.save(makeScore({ id: 'score-1', prompt_log_id: 'prompt-1' }));
    repo.save(makeScore({ id: 'score-2', prompt_log_id: 'prompt-2' }));
    const results = repo.getByPromptLogIds(['prompt-1', 'prompt-2']);
    for (const result of results) {
      for (const field of BANNED_FIELDS) {
        expect(result).not.toHaveProperty(field);
      }
    }
  });

  it('repository results from list do not include prompt_text or banned fields', () => {
    repo.save(makeScore({ id: 'score-1', prompt_log_id: 'prompt-1' }));
    repo.save(makeScore({ id: 'score-2', prompt_log_id: 'prompt-2' }));
    const results = repo.list({ limit: 100 });
    for (const result of results) {
      for (const field of BANNED_FIELDS) {
        expect(result).not.toHaveProperty(field);
      }
    }
  });

  it('repository errors do not include prompt content', () => {
    const fakePromptText = 'SUPER_SECRET_PROMPT_CONTENT_xyz123';
    // Insert a prompt log with known content
    insertPromptLog(db, { id: 'prompt-secret', prompt_text: fakePromptText });
    const invalidScore = makeScore({
      id: 'score-secret',
      prompt_log_id: 'prompt-secret',
      confidence: 'invalid' as any,
    });
    try {
      repo.save(invalidScore);
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).not.toContain(fakePromptText);
      expect(msg).not.toContain('SUPER_SECRET');
    }
  });
});

describe('Scoring persistence no-network', () => {
  it('no network/fetch behavior during save/read/list/count', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => { fetchCalled = true; }) as unknown as typeof fetch;
    try {
      const { db, repo } = setupTestDb(2);
      // save
      repo.save(makeScore({ id: 'score-1', prompt_log_id: 'prompt-1' }));
      repo.save(makeScore({ id: 'score-2', prompt_log_id: 'prompt-2' }));
      // read
      repo.getById('score-1');
      repo.getByPromptLogId('prompt-1');
      repo.getByPromptLogIds(['prompt-1', 'prompt-2']);
      // list
      repo.list({ limit: 100 });
      // count
      repo.countByIssueLabel();
      repo.countByConfidence();
      // Verify no fetch called
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Scoring persistence source code assertions', () => {
  const repoSource = readFileSync(
    resolve('src/storage/sqlite/repositories/prompt-score-repository.ts'),
    'utf-8',
  );

  it('query code does not use SELECT *', () => {
    // Ensure no raw SELECT * patterns that might hydrate prompt_text
    expect(repoSource).not.toMatch(/SELECT\s+\*/i);
  });

  it('query code does not select prompt_logs.prompt_text', () => {
    // Check only non-comment lines for prompt_text selection patterns
    const lines = repoSource.split('\n');
    const codeLines = lines.filter((l) => {
      const trimmed = l.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/**');
    });
    const codeText = codeLines.join('\n');
    // No SQL-like references to prompt_logs.prompt_text or pl.prompt_text
    expect(codeText).not.toMatch(/pl\.prompt_text/);
    expect(codeText).not.toMatch(/prompt_logs\.prompt_text/);
  });

  it('source does not reference banned full-answer field names as columns', () => {
    const bannedColumns = [
      'assistant_message',
      'response',
      'completion',
      'model_answer',
      'output_text',
      'generated_text',
    ];
    for (const banned of bannedColumns) {
      // Check it's not used as a column selection or SQL field
      // (it may appear in the BANNED_ANSWER_FIELDS validation array, which is fine)
      const lines = repoSource.split('\n');
      const sqlLines = lines.filter(
        (l) => l.includes('SELECT') || l.includes('INSERT') || l.includes('FROM'),
      );
      for (const line of sqlLines) {
        expect(line).not.toContain(banned);
      }
    }
  });
});
