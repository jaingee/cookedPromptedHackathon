/**
 * cookedPrompts — Signal Extraction
 *
 * Computes reusable, deterministic derived facts from a PromptLogEntry once,
 * so dimension scorers (Wave 2) do not each re-scan the prompt text.
 *
 * PRIVACY:
 * - Pure function. No I/O, no logging, no persistence, no network.
 * - `PromptSignals.lowered` is an INTERNAL, in-memory-only field. It must
 *   never be logged, persisted, serialized, or included in public output.
 * - `extractSignals` is intentionally NOT exported from the public barrel
 *   (`src/scoring/index.ts`); tests import it directly from this module.
 */

import type { PromptLogEntry } from '../importers/local/types.js';
import type { CapabilityClass, PromptSignals } from './types.js';

/** Output format markers indicating the user specified an expected shape. */
const FORMAT_MARKERS = [
  'table',
  'json',
  'bullet',
  'bullets',
  'list',
  'markdown',
  'code',
  'email',
  'steps',
  'schema',
  'csv',
  'outline',
];

/** Constraint markers indicating length/tone/audience/scope boundaries. */
const CONSTRAINT_MARKERS = [
  'limit',
  'under',
  'within',
  'tone',
  'audience',
  'scope',
  'avoid',
  'must',
  'do not',
  "don't",
  'concise',
  'professional',
  'friendly',
  'no more than',
  'at most',
  'word',
  'words',
  'characters',
];

/** Context markers indicating background/domain/input detail. */
const CONTEXT_MARKERS = [
  'context',
  'background',
  'project',
  'audience',
  'data',
  'input',
  'file',
  'attached',
  'requirements',
  'constraints',
  'current state',
  'goal',
  'given',
  'based on',
];

/** Very short vague requests with no clear object. */
const VAGUE_PHRASES = [
  'help',
  'fix this',
  'fix it',
  'make it better',
  'improve this',
  'improve it',
  'do this',
  'do the thing',
  'what do you think',
  'thoughts',
];

const VAGUE_TASK_MAX_LENGTH = 40;

/** Task-intent capability keyword groups (order irrelevant; deduped by Set). */
const CAPABILITY_KEYWORDS: ReadonlyArray<{
  capability: CapabilityClass;
  patterns: readonly string[];
}> = [
  {
    capability: 'search_required',
    patterns: [
      'latest',
      'today',
      'current',
      'recent',
      'news',
      'price',
      'schedule',
      'weather',
      'law',
      'regulation',
    ],
  },
  {
    capability: 'tool_using',
    patterns: [
      'run ',
      'call api',
      'call an api',
      'fetch',
      'browse',
      'read file',
      'use tool',
      'connect',
      'send',
      'create calendar',
    ],
  },
  {
    capability: 'coding',
    patterns: [
      'code',
      'typescript',
      'javascript',
      'python',
      'sql',
      'debug',
      'error',
      'test',
      'refactor',
    ],
  },
  {
    capability: 'deep_reasoning',
    patterns: [
      'architecture',
      'design',
      'plan',
      'prove',
      'analyze',
      'tradeoff',
      'reasoning',
    ],
  },
  {
    capability: 'long_context',
    patterns: ['long document', 'report', 'pdf', 'transcript', 'full file'],
  },
  {
    capability: 'multimodal',
    patterns: ['image', 'photo', 'screenshot', 'audio', 'video'],
  },
  {
    capability: 'privacy_sensitive_local',
    patterns: [
      'sensitive',
      'private',
      'confidential',
      'secret',
      'customer',
      'personal',
    ],
  },
  {
    capability: 'cheap_fast',
    patterns: [
      'simple rewrite',
      'format',
      'summarize',
      'grammar',
      'title',
      'caption',
    ],
  },
];

/** True when `text` contains any of the given markers. */
function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

/** Infer task-intent capability classes from lowered prompt text + tags. */
function inferRequiredCapabilities(
  lowered: string,
  tags: readonly string[],
): CapabilityClass[] {
  const haystack = `${lowered} ${tags.join(' ').toLowerCase()}`;
  const found = new Set<CapabilityClass>();

  for (const group of CAPABILITY_KEYWORDS) {
    if (containsAny(haystack, group.patterns)) {
      found.add(group.capability);
    }
  }

  // Fallback: general_purpose when no specific intent detected.
  if (found.size === 0) {
    found.add('general_purpose');
  }

  return Array.from(found);
}

/** True when the value is a finite number. */
function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Compute reusable signals from a normalized prompt log entry.
 *
 * Pure and deterministic. Reads `prompt_text`, `tags`, `model_used`, and
 * usage metadata only. Never logs or persists prompt content.
 */
export function extractSignals(entry: PromptLogEntry): PromptSignals {
  const promptText = entry.prompt_text ?? '';
  const lowered = promptText.toLowerCase();
  const trimmed = lowered.trim();

  const hasFormatMarker = containsAny(lowered, FORMAT_MARKERS);
  const hasConstraintMarker = containsAny(lowered, CONSTRAINT_MARKERS);
  const hasContextMarker = containsAny(lowered, CONTEXT_MARKERS);

  const vagueTaskOnly =
    trimmed.length > 0 &&
    trimmed.length <= VAGUE_TASK_MAX_LENGTH &&
    VAGUE_PHRASES.some(
      (phrase) => trimmed === phrase || trimmed.startsWith(`${phrase} `) || trimmed.startsWith(phrase),
    );

  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const requiredCapabilities = inferRequiredCapabilities(lowered, tags);

  const hasModelMetadata =
    typeof entry.model_used === 'string' && entry.model_used.trim().length > 0;

  const hasUsageMetadata =
    isFiniteNumber(entry.input_tokens) ||
    isFiniteNumber(entry.output_tokens) ||
    isFiniteNumber(entry.total_tokens) ||
    isFiniteNumber(entry.estimated_cost) ||
    isFiniteNumber(entry.latency_ms);

  return {
    length: promptText.length,
    lowered,
    hasFormatMarker,
    hasConstraintMarker,
    hasContextMarker,
    vagueTaskOnly,
    requiredCapabilities,
    hasModelMetadata,
    hasUsageMetadata,
  };
}
