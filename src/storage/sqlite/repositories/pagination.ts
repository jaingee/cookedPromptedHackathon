/**
 * cookedPrompts — Repository Pagination Helpers
 *
 * Bounded-query validation shared by SQLite repositories.
 * Error messages reference only option names and expected ranges —
 * never prompt content or row data.
 */

/** Options for bounded list queries. */
export interface SqliteListOptions {
  /** Required positive integer max rows to return. */
  limit: number;
  /** Optional non-negative integer row offset (defaults to 0). */
  offset?: number;
}

/** Maximum allowed limit for a single bounded query. */
export const MAX_LIST_LIMIT = 1000;

/** Validated, normalized pagination values. */
export interface NormalizedPagination {
  limit: number;
  offset: number;
}

/**
 * Validate and normalize list options.
 *
 * - `limit` must be a positive integer, capped at MAX_LIST_LIMIT.
 * - `offset` defaults to 0 and must be a non-negative integer.
 */
export function normalizePagination(options: SqliteListOptions): NormalizedPagination {
  const { limit } = options;
  const offset = options.offset ?? 0;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('list option "limit" must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('list option "offset" must be a non-negative integer');
  }

  // Cap oversized limits to a safe maximum rather than throwing.
  const cappedLimit = Math.min(limit, MAX_LIST_LIMIT);

  return { limit: cappedLimit, offset };
}
