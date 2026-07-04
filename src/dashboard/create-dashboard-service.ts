/**
 * cookedPrompts — Dashboard Service Composition
 *
 * Factory function that creates a DashboardDataService from a SqliteDatabase.
 * Does not modify existing storage factory/adapter. Does not open or close
 * the database. Does not run migrations. Does not read prompt data.
 *
 * Local-first: no network, no cloud, no telemetry.
 */

import type { SqliteDatabase } from '../storage/sqlite/sqlite-connection.js';
import { PromptLogRepository } from '../storage/sqlite/repositories/prompt-log-repository.js';
import { PromptScoreRepository } from '../storage/sqlite/repositories/prompt-score-repository.js';
import { DashboardDataService } from './dashboard-data-service.js';

/**
 * Create a DashboardDataService wired to repositories from the given database.
 *
 * Caller owns the database lifecycle. Does not run migrations or
 * modify the existing storage factory/adapter.
 */
export function createDashboardDataService(db: SqliteDatabase): DashboardDataService {
  return new DashboardDataService(
    new PromptScoreRepository(db),
    new PromptLogRepository(db),
  );
}
