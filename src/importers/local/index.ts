/**
 * cookedPrompts Local Importer — Module Barrel
 *
 * Exports all public contracts from the local importer module.
 * Parser, validator, normalizer, controller, and other implementation
 * exports will be added here as they are created in later tasks.
 */

export type * from './types';
export { BANNED_FULL_ANSWER_FIELDS } from './constants';
export { parseJsonl, parseCsv } from './parsers/index.js';
export type {
  JsonlParsedRow,
  JsonlParseIssue,
  JsonlParseResult,
  CsvParsedRow,
  CsvParseIssue,
  CsvParseResult,
} from './parsers/index.js';
export { validateFile, validateRow } from './validators/index.js';
export type {
  FileValidationResult,
  FileValidationInput,
  RowValidationResult,
} from './validators/index.js';
export { stripFullAnswerFields } from './strippers/full-answer-stripper.js';
export type { StripResult } from './strippers/full-answer-stripper.js';
export { computePromptHash } from './services/prompt-hash-service.js';
export { normalizePromptLog } from './normalizer/prompt-log-normalizer.js';
export { loadDemoDataset } from './demo/demo-dataset-loader.js';
export { StubSafetyHandoffAdapter } from './adapters/safety-handoff-adapter.js';
export type { SafetyHandoffAdapter } from './adapters/safety-handoff-adapter.js';
export type { StorageHandoffPort, StorageSaveResult } from './ports/storage-handoff-port.js';
export { buildImportPreview as assembleImportPreview } from './preview/index.js';
export type { PreviewBuilderInput } from './preview/index.js';
export { buildImportPreview, commitImportPreview } from './controller/index.js';
export type { ImportSourceType, BuildImportPreviewInput } from './controller/index.js';
