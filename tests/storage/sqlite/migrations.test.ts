/**
 * Wave 6 — Task 6.2: Migration tests.
 *
 * Covers: tables + indexes created, schema_migrations tracking, idempotency,
 * and privacy at the schema level (no banned answer columns, no tags blob).
 */

import { describe, it, expect } from 'vitest';

import {
  IN_MEMORY_SQLITE_DATABASE_PATH,
  openSqliteConnection,
  runSqliteMigrations,
  type SqliteDatabase,
} from '../../../src/storage/sqlite/index.js';

const BANNED_ANSWER_COLUMNS = [
  'assistant_message',
  'response',
  'completion',
  'model_answer',
  'output_text',
  'generated_text',
];

function tableNames(db: SqliteDatabase): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function indexNames(db: SqliteDatabase): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function columnNames(db: SqliteDatabase, table: string): string[] {
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function freshDb(): SqliteDatabase {
  return openSqliteConnection({ databasePath: IN_MEMORY_SQLITE_DATABASE_PATH });
}

describe('runSqliteMigrations', () => {
  it('creates all required tables', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const tables = tableNames(db);
    expect(tables).toContain('schema_migrations');
    expect(tables).toContain('import_batches');
    expect(tables).toContain('prompt_logs');
    expect(tables).toContain('prompt_log_tags');
    db.close();
  });

  it('creates scoring persistence tables (migration 002)', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const tables = tableNames(db);
    expect(tables).toContain('prompt_scores');
    expect(tables).toContain('prompt_score_labels');
    db.close();
  });

  it('records migration versions 1 and 2 in schema_migrations', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const rows = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: number }>;
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
    db.close();
  });

  it('is idempotent — running twice does not duplicate migration rows', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    runSqliteMigrations(db);
    const rows = db
      .prepare('SELECT version FROM schema_migrations')
      .all() as Array<{ version: number }>;
    expect(rows).toHaveLength(2);
    db.close();
  });

  it('creates all required indexes', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const indexes = indexNames(db);
    expect(indexes).toContain('idx_prompt_logs_import_batch_id');
    expect(indexes).toContain('idx_prompt_logs_prompt_hash');
    expect(indexes).toContain('idx_prompt_logs_deleted_at');
    expect(indexes).toContain('idx_prompt_log_tags_tag');
    db.close();
  });

  it('creates scoring persistence indexes (migration 002)', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const indexes = indexNames(db);
    expect(indexes).toContain('idx_prompt_scores_prompt_log_id');
    expect(indexes).toContain('idx_prompt_scores_scoring_version');
    expect(indexes).toContain('idx_prompt_scores_confidence');
    expect(indexes).toContain('idx_prompt_scores_overall_score');
    expect(indexes).toContain('idx_prompt_scores_scored_at');
    expect(indexes).toContain('idx_prompt_score_labels_label');
    db.close();
  });
});

describe('schema privacy enforcement', () => {
  it('prompt_logs has no banned full-answer columns', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const columns = columnNames(db, 'prompt_logs');
    for (const banned of BANNED_ANSWER_COLUMNS) {
      expect(columns).not.toContain(banned);
    }
    db.close();
  });

  it('prompt_logs has no tags blob column (tags live in prompt_log_tags)', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const columns = columnNames(db, 'prompt_logs');
    expect(columns).not.toContain('tags');
    const tagColumns = columnNames(db, 'prompt_log_tags');
    expect(tagColumns).toContain('prompt_log_id');
    expect(tagColumns).toContain('tag');
    db.close();
  });

  it('prompt_scores has no prompt_text or banned full-answer columns', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const columns = columnNames(db, 'prompt_scores');
    expect(columns).not.toContain('prompt_text');
    for (const banned of BANNED_ANSWER_COLUMNS) {
      expect(columns).not.toContain(banned);
    }
    db.close();
  });

  it('prompt_score_labels has no prompt_text or banned full-answer columns', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    const columns = columnNames(db, 'prompt_score_labels');
    expect(columns).not.toContain('prompt_text');
    for (const banned of BANNED_ANSWER_COLUMNS) {
      expect(columns).not.toContain(banned);
    }
    db.close();
  });
});

describe('scoring schema constraints (migration 002)', () => {
  it('score columns enforce 0–5 CHECK constraints', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    // Insert a valid prompt_log first for FK
    db.prepare(
      `INSERT INTO import_batches (id, source_type, source_filename, total_rows, valid_rows, invalid_rows, warnings_count, created_at)
       VALUES ('batch-1', 'jsonl', 'test.jsonl', 1, 1, 0, 0, '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_logs (id, timestamp, source, provider, model_used, prompt_text, import_batch_id, redaction_status, created_at, updated_at)
       VALUES ('pl-1', '2026-01-01T00:00:00.000Z', 'manual', 'synth', 'synth-model', 'test', 'batch-1', 'none', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    // overall_score = 6 should fail CHECK
    expect(() => {
      db.prepare(
        `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
         VALUES ('s1', 'pl-1', 6, 3, 3, 3, 3, 3, 3, 3, 'medium', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      ).run();
    }).toThrow();
    // overall_score = -1 should fail CHECK
    expect(() => {
      db.prepare(
        `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
         VALUES ('s2', 'pl-1', -1, 3, 3, 3, 3, 3, 3, 3, 'medium', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      ).run();
    }).toThrow();
    db.close();
  });

  it('confidence enforces allowed values CHECK', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    db.prepare(
      `INSERT INTO import_batches (id, source_type, source_filename, total_rows, valid_rows, invalid_rows, warnings_count, created_at)
       VALUES ('batch-1', 'jsonl', 'test.jsonl', 1, 1, 0, 0, '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_logs (id, timestamp, source, provider, model_used, prompt_text, import_batch_id, redaction_status, created_at, updated_at)
       VALUES ('pl-1', '2026-01-01T00:00:00.000Z', 'manual', 'synth', 'synth-model', 'test', 'batch-1', 'none', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    expect(() => {
      db.prepare(
        `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
         VALUES ('s1', 'pl-1', 3, 3, 3, 3, 3, 3, 3, 3, 'invalid_confidence', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      ).run();
    }).toThrow();
    db.close();
  });

  it('UNIQUE(prompt_log_id, scoring_version) exists and behaves correctly', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    db.prepare(
      `INSERT INTO import_batches (id, source_type, source_filename, total_rows, valid_rows, invalid_rows, warnings_count, created_at)
       VALUES ('batch-1', 'jsonl', 'test.jsonl', 1, 1, 0, 0, '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_logs (id, timestamp, source, provider, model_used, prompt_text, import_batch_id, redaction_status, created_at, updated_at)
       VALUES ('pl-1', '2026-01-01T00:00:00.000Z', 'manual', 'synth', 'synth-model', 'test', 'batch-1', 'none', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    // First insert succeeds
    db.prepare(
      `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
       VALUES ('s1', 'pl-1', 3, 3, 3, 3, 3, 3, 3, 3, 'medium', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    // Duplicate (prompt_log_id, scoring_version) should fail
    expect(() => {
      db.prepare(
        `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
         VALUES ('s2', 'pl-1', 4, 4, 4, 4, 4, 4, 4, 4, 'high', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      ).run();
    }).toThrow();
    db.close();
  });

  it('prompt_score_labels cascades delete when a prompt score is deleted', () => {
    const db = freshDb();
    runSqliteMigrations(db);
    db.prepare(
      `INSERT INTO import_batches (id, source_type, source_filename, total_rows, valid_rows, invalid_rows, warnings_count, created_at)
       VALUES ('batch-1', 'jsonl', 'test.jsonl', 1, 1, 0, 0, '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_logs (id, timestamp, source, provider, model_used, prompt_text, import_batch_id, redaction_status, created_at, updated_at)
       VALUES ('pl-1', '2026-01-01T00:00:00.000Z', 'manual', 'synth', 'synth-model', 'test', 'batch-1', 'none', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_scores (id, prompt_log_id, overall_score, clarity_score, context_score, constraints_score, output_format_score, capability_fit_score, efficiency_score, safety_privacy_score, confidence, explanations_json, scoring_version, scored_at, created_at, updated_at)
       VALUES ('s1', 'pl-1', 3, 3, 3, 3, 3, 3, 3, 3, 'medium', '[]', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare("INSERT INTO prompt_score_labels (prompt_score_id, label) VALUES ('s1', 'missing_context')").run();
    db.prepare("INSERT INTO prompt_score_labels (prompt_score_id, label) VALUES ('s1', 'unclear_task')").run();
    // Verify labels exist
    const before = db.prepare("SELECT * FROM prompt_score_labels WHERE prompt_score_id = 's1'").all();
    expect(before).toHaveLength(2);
    // Delete the score
    db.prepare("DELETE FROM prompt_scores WHERE id = 's1'").run();
    // Labels should be cascade-deleted
    const after = db.prepare("SELECT * FROM prompt_score_labels WHERE prompt_score_id = 's1'").all();
    expect(after).toHaveLength(0);
    db.close();
  });
});
