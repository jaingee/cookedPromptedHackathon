/**
 * cookedPrompts — Migration 002: Scoring Persistence
 *
 * Creates the V1 local scoring schema: prompt_scores and prompt_score_labels.
 *
 * PRIVACY ENFORCEMENT POINT:
 * - No columns for prompt_text or full model answers.
 * - Banned field names (assistant_message, response, completion, model_answer,
 *   output_text, generated_text) have NO column here.
 * - No raw parsed rows, no matched-substring columns.
 * - Labels are normalized in prompt_score_labels (no label blob column).
 * - Explanations are stored as a JSON text array (display-only, safe
 *   category-level strings produced by the scoring engine).
 *
 * Schema is boring and Postgres/Supabase-portable: explicit columns,
 * UUID-style string IDs, ISO 8601 text timestamps, nullable future-auth
 * columns. One active score per (prompt_log_id, scoring_version).
 */

import type { SqliteMigration } from './index.js';

const CREATE_PROMPT_SCORES = `
  CREATE TABLE IF NOT EXISTS prompt_scores (
    id                    TEXT PRIMARY KEY,
    prompt_log_id         TEXT NOT NULL,
    overall_score         INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
    clarity_score         INTEGER NOT NULL CHECK (clarity_score BETWEEN 0 AND 5),
    context_score         INTEGER NOT NULL CHECK (context_score BETWEEN 0 AND 5),
    constraints_score     INTEGER NOT NULL CHECK (constraints_score BETWEEN 0 AND 5),
    output_format_score   INTEGER NOT NULL CHECK (output_format_score BETWEEN 0 AND 5),
    capability_fit_score  INTEGER NOT NULL CHECK (capability_fit_score BETWEEN 0 AND 5),
    efficiency_score      INTEGER NOT NULL CHECK (efficiency_score BETWEEN 0 AND 5),
    safety_privacy_score  INTEGER NOT NULL CHECK (safety_privacy_score BETWEEN 0 AND 5),
    confidence            TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    explanations_json     TEXT NOT NULL,
    scoring_version       TEXT NOT NULL,
    scored_at             TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    user_id               TEXT,
    workspace_id          TEXT,
    sync_status           TEXT,
    UNIQUE (prompt_log_id, scoring_version),
    FOREIGN KEY (prompt_log_id) REFERENCES prompt_logs(id)
  );
`;

const CREATE_PROMPT_SCORE_LABELS = `
  CREATE TABLE IF NOT EXISTS prompt_score_labels (
    prompt_score_id TEXT NOT NULL,
    label           TEXT NOT NULL,
    UNIQUE (prompt_score_id, label),
    FOREIGN KEY (prompt_score_id) REFERENCES prompt_scores(id) ON DELETE CASCADE
  );
`;

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_prompt_scores_prompt_log_id ON prompt_scores(prompt_log_id);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_scores_scoring_version ON prompt_scores(scoring_version);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_scores_confidence ON prompt_scores(confidence);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_scores_overall_score ON prompt_scores(overall_score);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_scores_scored_at ON prompt_scores(scored_at);`,
  `CREATE INDEX IF NOT EXISTS idx_prompt_score_labels_label ON prompt_score_labels(label);`,
];

/** Migration 002 — scoring persistence schema. */
export const migration002Scoring: SqliteMigration = {
  version: 2,
  name: 'scoring_persistence',
  up(db) {
    db.exec(CREATE_PROMPT_SCORES);
    db.exec(CREATE_PROMPT_SCORE_LABELS);
    for (const indexSql of CREATE_INDEXES) {
      db.exec(indexSql);
    }
  },
};
