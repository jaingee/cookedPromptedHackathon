/**
 * cookedPrompts — Migration 001: Initial Schema
 *
 * Creates the V1 local schema: import_batches, prompt_logs, prompt_log_tags.
 *
 * PRIVACY ENFORCEMENT POINT:
 * - No columns exist for full model answers or any answer/output content.
 * - Banned field names (assistant_message, response, completion, model_answer,
 *   output_text, generated_text) have NO column here.
 * - No tags blob column on prompt_logs (tags are normalized in prompt_log_tags).
 *
 * Schema is boring and Postgres/Supabase-portable: explicit columns,
 * UUID-style string IDs, ISO 8601 text timestamps, no rowid identity tricks.
 */

import type { SqliteMigration } from './index.js';

const CREATE_IMPORT_BATCHES = `
  CREATE TABLE IF NOT EXISTS import_batches (
    id              TEXT PRIMARY KEY,
    source_type     TEXT NOT NULL CHECK (source_type IN ('jsonl', 'csv', 'demo')),
    source_filename TEXT,
    total_rows      INTEGER NOT NULL CHECK (total_rows >= 0),
    valid_rows      INTEGER NOT NULL CHECK (valid_rows >= 0),
    invalid_rows    INTEGER NOT NULL CHECK (invalid_rows >= 0),
    warnings_count  INTEGER NOT NULL CHECK (warnings_count >= 0),
    created_at      TEXT NOT NULL
  );
`;

const CREATE_PROMPT_LOGS = `
  CREATE TABLE IF NOT EXISTS prompt_logs (
    id               TEXT PRIMARY KEY,
    timestamp        TEXT NOT NULL,
    source           TEXT NOT NULL,
    provider         TEXT NOT NULL,
    model_used       TEXT NOT NULL,
    prompt_text      TEXT NOT NULL,
    import_batch_id  TEXT NOT NULL,
    prompt_hash      TEXT,
    session_id       TEXT,
    follow_up_index  INTEGER CHECK (follow_up_index IS NULL OR follow_up_index >= 0),
    parent_prompt_id TEXT,
    input_tokens     INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens    INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
    total_tokens     INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
    estimated_cost   REAL CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    latency_ms       INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
    solved_status    TEXT CHECK (solved_status IS NULL OR solved_status IN ('solved', 'unsolved', 'partial')),
    user_rating      INTEGER CHECK (user_rating IS NULL OR user_rating BETWEEN 1 AND 5),
    redaction_status TEXT NOT NULL DEFAULT 'none' CHECK (redaction_status IN ('none', 'partial', 'full')),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    deleted_at       TEXT,
    user_id          TEXT,
    workspace_id     TEXT,
    sync_status      TEXT,
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
  );
`;

const CREATE_PROMPT_LOG_TAGS = `
  CREATE TABLE IF NOT EXISTS prompt_log_tags (
    prompt_log_id TEXT NOT NULL,
    tag           TEXT NOT NULL,
    UNIQUE (prompt_log_id, tag),
    FOREIGN KEY (prompt_log_id) REFERENCES prompt_logs(id)
  );
`;

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_prompt_logs_import_batch_id ON prompt_logs(import_batch_id);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_logs_prompt_hash ON prompt_logs(prompt_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_logs_deleted_at ON prompt_logs(deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_log_tags_tag ON prompt_log_tags(tag);`,
];

/** Migration 001 — initial schema. */
export const migration001Initial: SqliteMigration = {
  version: 1,
  name: 'initial_schema',
  up(db) {
    db.exec(CREATE_IMPORT_BATCHES);
    db.exec(CREATE_PROMPT_LOGS);
    db.exec(CREATE_PROMPT_LOG_TAGS);
    for (const indexSql of CREATE_INDEXES) {
      db.exec(indexSql);
    }
  },
};
