/**
 * cookedPrompts — Integration Demo Flow Module Boundary
 *
 * Public exports for the local V1 demo orchestration pipeline.
 */

export type {
  PipelineStep,
  DemoInput,
  PipelineOptions,
  PromptResult,
  SafetyPostureSummary,
  BatchSummary,
  PipelineMetadata,
  UnifiedDemoOutput,
} from './types.js';

export { computeBatchSummary } from './batch-summary.js';
export { shouldIncludePromptText, makeContentFreeError, BANNED_OUTPUT_FIELDS, isBannedOutputKey } from './privacy-guards.js';
export { ORCHESTRATOR_VERSION, runIntegrationDemo } from './demo-orchestrator.js';
