/**
 * cookedPrompts — Dashboard UI Test Helpers
 *
 * Synthetic local database fixtures and loopback request helpers for dashboard UI tests.
 */

import http from 'node:http';

import { openSqliteConnection, runSqliteMigrations } from '../../src/storage/sqlite/index.js';
import { createTempDbPath } from '../storage/sqlite/test-helpers.js';
import {
  insertImportBatch,
  insertPromptWithScore,
  SYNTHETIC_PROMPT_TEXT,
} from '../dashboard/dashboard-test-helpers.js';

export { SYNTHETIC_PROMPT_TEXT };

export function createDashboardUiDbFile(options?: {
  withScores?: boolean;
  promptText?: string;
}): {
  databasePath: string;
  cleanup: () => void;
} {
  const withScores = options?.withScores ?? true;
  const { databasePath, cleanup } = createTempDbPath();
  const db = openSqliteConnection({ databasePath });

  try {
    runSqliteMigrations(db);
    insertImportBatch(db);

    if (withScores) {
      insertPromptWithScore(db, {
        promptId: 'prompt-1',
        scoreId: 'score-1',
        promptText: options?.promptText ?? SYNTHETIC_PROMPT_TEXT,
      });
    }
  } finally {
    db.close();
  }

  return { databasePath, cleanup };
}

export function createDashboardUiDbFileWithManyScores(scoreCount: number): {
  databasePath: string;
  cleanup: () => void;
} {
  const { databasePath, cleanup } = createTempDbPath();
  const db = openSqliteConnection({ databasePath });

  try {
    runSqliteMigrations(db);
    insertImportBatch(db);

    for (let i = 1; i <= scoreCount; i += 1) {
      insertPromptWithScore(db, {
        promptId: `prompt-${i}`,
        scoreId: `score-${i}`,
        promptText: `${SYNTHETIC_PROMPT_TEXT}-${i}`,
        overallScore: (i % 6) as 0 | 1 | 2 | 3 | 4 | 5,
        confidence: i % 3 === 0 ? 'low' : i % 2 === 0 ? 'high' : 'medium',
        issueLabels:
          i % 4 === 0
            ? ['wrong_model_class', 'missing_output_format']
            : i % 5 === 0
              ? ['privacy_risk']
              : ['missing_constraints'],
        timestamp: `2026-01-${String(Math.min(i, 28)).padStart(2, '0')}T00:00:00.000Z`,
        scoredAt: `2026-01-${String(Math.min(i, 28)).padStart(2, '0')}T00:00:00.000Z`,
      });
    }
  } finally {
    db.close();
  }

  return { databasePath, cleanup };
}

export async function requestDashboardUi(
  baseUrl: string,
  pathname: string,
): Promise<{ statusCode: number; body: string }> {
  const url = new URL(pathname, baseUrl);

  return await new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    request.on('error', reject);
  });
}
