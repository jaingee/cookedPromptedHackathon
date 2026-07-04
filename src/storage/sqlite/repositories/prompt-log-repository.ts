/**
 * cookedPrompts — PromptLogRepository
 *
 * Persists and reads normalized prompt logs. Tags are normalized into
 * prompt_log_tags. Mapping is explicit column-by-column (no object spread),
 * so unknown or banned full-answer fields can never reach SQL.
 *
 * PRIVACY:
 * - Never persists banned full-answer fields.
 * - Never stores a tags blob on prompt_logs.
 * - No prompt content in errors/logs.
 */

import type { PromptLogEntry } from '../../../importers/local/types.js';
import type { SqliteDatabase } from '../sqlite-connection.js';
import { normalizePagination, type SqliteListOptions } from './pagination.js';

/** Options controlling whether soft-deleted rows are included. */
export interface PromptLogReadOptions {
  includeDeleted?: boolean;
}

/** Shape of a raw prompt_logs row. */
interface PromptLogRow {
  id: string;
  timestamp: string;
  source: string;
  provider: string;
  model_used: string;
  prompt_text: string;
  import_batch_id: string;
  prompt_hash: string | null;
  session_id: string | null;
  follow_up_index: number | null;
  parent_prompt_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  solved_status: string | null;
  user_rating: number | null;
  redaction_status: string;
}

export class PromptLogRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /**
   * Insert a normalized prompt log. Explicit allow-list mapping only.
   * Storage-managed fields (created_at/updated_at/deleted_at/user_id/
   * workspace_id/sync_status) are set here, not taken from the entry.
   * Tags are persisted separately into prompt_log_tags.
   */
  insert(entry: PromptLogEntry): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO prompt_logs (
          id, timestamp, source, provider, model_used, prompt_text,
          import_batch_id, prompt_hash, session_id, follow_up_index,
          parent_prompt_id, input_tokens, output_tokens, total_tokens,
          estimated_cost, latency_ms, solved_status, user_rating,
          redaction_status, created_at, updated_at, deleted_at,
          user_id, workspace_id, sync_status
        ) VALUES (
          @id, @timestamp, @source, @provider, @model_used, @prompt_text,
          @import_batch_id, @prompt_hash, @session_id, @follow_up_index,
          @parent_prompt_id, @input_tokens, @output_tokens, @total_tokens,
          @estimated_cost, @latency_ms, @solved_status, @user_rating,
          @redaction_status, @created_at, @updated_at, @deleted_at,
          @user_id, @workspace_id, @sync_status
        )`,
      )
      .run({
        id: entry.id,
        timestamp: entry.timestamp,
        source: entry.source,
        provider: entry.provider,
        model_used: entry.model_used,
        prompt_text: entry.prompt_text,
        import_batch_id: entry.import_batch_id,
        prompt_hash: entry.prompt_hash ?? null,
        session_id: entry.session_id ?? null,
        follow_up_index: entry.follow_up_index ?? null,
        parent_prompt_id: entry.parent_prompt_id ?? null,
        input_tokens: entry.input_tokens ?? null,
        output_tokens: entry.output_tokens ?? null,
        total_tokens: entry.total_tokens ?? null,
        estimated_cost: entry.estimated_cost ?? null,
        latency_ms: entry.latency_ms ?? null,
        solved_status: entry.solved_status ?? null,
        user_rating: entry.user_rating ?? null,
        redaction_status: entry.redaction_status ?? 'none',
        created_at: now,
        updated_at: now,
        deleted_at: null,
        user_id: null,
        workspace_id: null,
        sync_status: null,
      });

    this.insertTags(entry.id, entry.tags);
  }

  /** Read a prompt log by ID (excludes soft-deleted by default). */
  getById(id: string, options?: PromptLogReadOptions): PromptLogEntry | null {
    const includeDeleted = options?.includeDeleted ?? false;
    const sql = includeDeleted
      ? 'SELECT * FROM prompt_logs WHERE id = ?'
      : 'SELECT * FROM prompt_logs WHERE id = ? AND deleted_at IS NULL';
    const row = this.db.prepare(sql).get(id) as PromptLogRow | undefined;
    if (!row) return null;
    return this.mapRowToEntry(row);
  }

  /** List prompt logs, newest first, with bounded pagination. */
  list(options: SqliteListOptions & PromptLogReadOptions): PromptLogEntry[] {
    const { limit, offset } = normalizePagination(options);
    const includeDeleted = options.includeDeleted ?? false;
    const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const rows = this.db
      .prepare(
        `SELECT * FROM prompt_logs
         ${where}
         ORDER BY timestamp DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as PromptLogRow[];
    return rows.map((row) => this.mapRowToEntry(row));
  }

  /** List prompt logs for one import batch, newest first, bounded. */
  listByBatch(
    importBatchId: string,
    options: SqliteListOptions & PromptLogReadOptions,
  ): PromptLogEntry[] {
    const { limit, offset } = normalizePagination(options);
    const includeDeleted = options.includeDeleted ?? false;
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const rows = this.db
      .prepare(
        `SELECT * FROM prompt_logs
         WHERE import_batch_id = ? ${deletedClause}
         ORDER BY timestamp DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(importBatchId, limit, offset) as PromptLogRow[];
    return rows.map((row) => this.mapRowToEntry(row));
  }

  /** Return the subset of provided IDs that already exist. Read-only. */
  findExistingIds(ids: string[]): string[] {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT id FROM prompt_logs WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string }>;

    const existing = new Set(rows.map((r) => r.id));
    // Preserve caller order.
    return ids.filter((id) => existing.has(id));
  }

  // --- Internal helpers ---

  /** Persist normalized, de-duplicated tags into prompt_log_tags. */
  private insertTags(promptLogId: string, tags: string[]): void {
    const normalized = Array.from(
      new Set(tags.map((t) => t.trim()).filter((t) => t !== '')),
    );
    if (normalized.length === 0) return;

    const stmt = this.db.prepare(
      'INSERT INTO prompt_log_tags (prompt_log_id, tag) VALUES (?, ?)',
    );
    for (const tag of normalized) {
      stmt.run(promptLogId, tag);
    }
  }

  /** Read tags for a prompt log, ordered deterministically. */
  private getTags(promptLogId: string): string[] {
    const rows = this.db
      .prepare(
        'SELECT tag FROM prompt_log_tags WHERE prompt_log_id = ? ORDER BY tag ASC',
      )
      .all(promptLogId) as Array<{ tag: string }>;
    return rows.map((r) => r.tag);
  }

  /** Map a raw row (+ hydrated tags) to the PromptLogEntry contract. */
  private mapRowToEntry(row: PromptLogRow): PromptLogEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      source: row.source,
      provider: row.provider,
      model_used: row.model_used,
      prompt_text: row.prompt_text,
      import_batch_id: row.import_batch_id,
      prompt_hash: row.prompt_hash,
      session_id: row.session_id,
      follow_up_index: row.follow_up_index,
      parent_prompt_id: row.parent_prompt_id,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.total_tokens,
      estimated_cost: row.estimated_cost,
      latency_ms: row.latency_ms,
      solved_status: row.solved_status as PromptLogEntry['solved_status'],
      user_rating: row.user_rating,
      tags: this.getTags(row.id),
      redaction_status: row.redaction_status as PromptLogEntry['redaction_status'],
    };
  }
}
