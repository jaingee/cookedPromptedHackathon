/**
 * cookedPrompts — ImportBatchRepository
 *
 * Persists and reads import batch metadata. Explicit column mapping only.
 * Local-first: no network, no cloud, no auth. No prompt content in errors.
 */

import type { ImportBatch } from '../../../importers/local/types.js';
import type { SqliteDatabase } from '../sqlite-connection.js';
import { normalizePagination, type SqliteListOptions } from './pagination.js';

/** Shape of a raw import_batches row. */
interface ImportBatchRow {
  id: string;
  source_type: string;
  source_filename: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warnings_count: number;
  created_at: string;
}

export class ImportBatchRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Insert import batch metadata (explicit columns only). */
  insert(batch: ImportBatch): void {
    this.db
      .prepare(
        `INSERT INTO import_batches (
          id, source_type, source_filename,
          total_rows, valid_rows, invalid_rows, warnings_count, created_at
        ) VALUES (
          @id, @source_type, @source_filename,
          @total_rows, @valid_rows, @invalid_rows, @warnings_count, @created_at
        )`,
      )
      .run({
        id: batch.id,
        source_type: batch.source_type,
        source_filename: batch.source_filename ?? null,
        total_rows: batch.total_rows,
        valid_rows: batch.valid_rows,
        invalid_rows: batch.invalid_rows,
        warnings_count: batch.warnings_count,
        created_at: batch.created_at,
      });
  }

  /** Read an import batch by ID, or null if absent. */
  getById(id: string): ImportBatch | null {
    const row = this.db
      .prepare('SELECT * FROM import_batches WHERE id = ?')
      .get(id) as ImportBatchRow | undefined;
    return row ? mapRowToBatch(row) : null;
  }

  /** List import batches, newest first, with bounded pagination. */
  list(options: SqliteListOptions): ImportBatch[] {
    const { limit, offset } = normalizePagination(options);
    const rows = this.db
      .prepare(
        `SELECT * FROM import_batches
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as ImportBatchRow[];
    return rows.map(mapRowToBatch);
  }
}

/** Map a raw row to the ImportBatch contract. */
function mapRowToBatch(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    source_type: row.source_type as ImportBatch['source_type'],
    source_filename: row.source_filename,
    total_rows: row.total_rows,
    valid_rows: row.valid_rows,
    invalid_rows: row.invalid_rows,
    warnings_count: row.warnings_count,
    created_at: row.created_at,
  };
}
