/**
 * cookedPrompts - Demo Report Redaction Helpers
 *
 * Deterministic report-layer masking helpers for future prompt display.
 * These helpers never return raw matches, offsets, hashes, or warning text.
 */

export const PROMPT_EXCERPT_WITHHELD = '[Prompt excerpt withheld after redaction]';

export const REDACTION_PLACEHOLDERS = [
  '[REDACTED_SECRET]',
  '[REDACTED_PASSWORD]',
  '[REDACTED_TOKEN]',
  '[REDACTED_INTERNAL_HOST]',
  '[REDACTED_CUSTOMER_DATA]',
  '[REDACTED_PERSONAL_DATA]',
] as const;

export type RedactionPlaceholder = (typeof REDACTION_PLACEHOLDERS)[number];

export interface RedactionResult {
  redacted_prompt: string;
  placeholder_counts: Record<RedactionPlaceholder, number>;
}

export interface RedactedExcerptOptions {
  max_chars?: number;
}

export interface RedactedExcerptResult extends RedactionResult {
  redacted_excerpt: string;
  was_truncated: boolean;
  used_fallback: boolean;
}

interface RedactionRule {
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  placeholder: RedactionPlaceholder;
}

const PRIVATE_KEY_BLOCK =
  /-----BEGIN[\s\S]{0,40}?PRIVATE KEY-----[\s\S]*?-----END[\s\S]{0,40}?PRIVATE KEY-----/gi;
const OPENAI_SECRET_PREFIX = ['sk', ''].join('-');
const KNOWN_SECRET_TOKEN = new RegExp(
  `\\b(?:${OPENAI_SECRET_PREFIX}[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{8,}|AIza[0-9A-Za-z_-]{12,})\\b`,
  'g',
);
const API_KEY_ASSIGNMENT =
  /\b((?:api[_ -]?key|apikey|secret[_ -]?key))(\s*[:=]\s*)(["']?)([^\s"',;]+)\3/gi;
const BEARER_TOKEN =
  /\b(Bearer)(\s+)([A-Za-z0-9._~+\/=-]{8,})\b/gi;
const TOKEN_ASSIGNMENT =
  /\b((?:access|refresh|auth)(?:[_ -]?token))(\s*[:=]\s*)(["']?)([^\s"',;]+)\3/gi;
const PASSWORD_ASSIGNMENT =
  /\b((?:password|passwd|pwd))(\s*[:=]\s*)(["']?)(?!string\b|number\b|boolean\b|unknown\b|any\b)([^\s"',;]+)\3/gi;
const PASSWORD_PHRASE =
  /\b((?:password|passwd|pwd)\s+(?:is|was)\s+)(["']?)([^\s"',.;]+)\2/gi;
const INTERNAL_HOST =
  /\b(?:[a-z0-9-]+\.)+(?:internal|corp|lan|local)(?:\.[a-z0-9-]+)*(?::\d{2,5})?\b/gi;
const CUSTOMER_ASSIGNMENT =
  /\b((?:customer|client|account|acct)(?:[_ -]?(?:id|name|email|number|no))?)(\s*[:=]\s*)(["']?)([^\s"',;]+)\3/gi;
const EMAIL_LIKE =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_LIKE =
  /\b(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}\b/g;

const REDACTION_RULES: readonly RedactionRule[] = [
  {
    pattern: PRIVATE_KEY_BLOCK,
    replacement: '[REDACTED_SECRET]',
    placeholder: '[REDACTED_SECRET]',
  },
  {
    pattern: API_KEY_ASSIGNMENT,
    replacement: (_match, label: string, separator: string) =>
      `${label}${separator}[REDACTED_SECRET]`,
    placeholder: '[REDACTED_SECRET]',
  },
  {
    pattern: KNOWN_SECRET_TOKEN,
    replacement: '[REDACTED_SECRET]',
    placeholder: '[REDACTED_SECRET]',
  },
  {
    pattern: BEARER_TOKEN,
    replacement: (_match, prefix: string, whitespace: string) =>
      `${prefix}${whitespace}[REDACTED_TOKEN]`,
    placeholder: '[REDACTED_TOKEN]',
  },
  {
    pattern: TOKEN_ASSIGNMENT,
    replacement: (_match, label: string, separator: string) =>
      `${label}${separator}[REDACTED_TOKEN]`,
    placeholder: '[REDACTED_TOKEN]',
  },
  {
    pattern: PASSWORD_ASSIGNMENT,
    replacement: (_match, label: string, separator: string) =>
      `${label}${separator}[REDACTED_PASSWORD]`,
    placeholder: '[REDACTED_PASSWORD]',
  },
  {
    pattern: PASSWORD_PHRASE,
    replacement: (_match, prefix: string) => `${prefix}[REDACTED_PASSWORD]`,
    placeholder: '[REDACTED_PASSWORD]',
  },
  {
    pattern: INTERNAL_HOST,
    replacement: '[REDACTED_INTERNAL_HOST]',
    placeholder: '[REDACTED_INTERNAL_HOST]',
  },
  {
    pattern: CUSTOMER_ASSIGNMENT,
    replacement: (_match, label: string, separator: string) =>
      `${label}${separator}[REDACTED_CUSTOMER_DATA]`,
    placeholder: '[REDACTED_CUSTOMER_DATA]',
  },
  {
    pattern: EMAIL_LIKE,
    replacement: '[REDACTED_PERSONAL_DATA]',
    placeholder: '[REDACTED_PERSONAL_DATA]',
  },
  {
    pattern: PHONE_LIKE,
    replacement: '[REDACTED_PERSONAL_DATA]',
    placeholder: '[REDACTED_PERSONAL_DATA]',
  },
];

const DEFAULT_MAX_EXCERPT_CHARS = 220;
const MIN_VISIBLE_CHARS_AFTER_REDACTION = 24;

export function redactPromptForReport(prompt: string): RedactionResult {
  const input = typeof prompt === 'string' ? prompt : '';
  const placeholder_counts = createPlaceholderCounts();

  let redacted_prompt = input;
  for (const rule of REDACTION_RULES) {
    redacted_prompt = redacted_prompt.replace(rule.pattern, (...args) => {
      placeholder_counts[rule.placeholder] += 1;
      if (typeof rule.replacement === 'function') {
        return rule.replacement(args[0], ...(args.slice(1, -2) as string[]));
      }
      return rule.replacement;
    });
  }

  return {
    redacted_prompt,
    placeholder_counts,
  };
}

export function buildRedactedExcerpt(
  prompt: string,
  options?: RedactedExcerptOptions,
): RedactedExcerptResult {
  const max_chars = options?.max_chars ?? DEFAULT_MAX_EXCERPT_CHARS;
  const redaction = redactPromptForReport(prompt);
  const normalized = normalizeExcerptWhitespace(redaction.redacted_prompt);
  const totalPlaceholderCount = Object.values(redaction.placeholder_counts)
    .reduce((sum, count) => sum + count, 0);

  if (shouldWithholdExcerpt(normalized, totalPlaceholderCount)) {
    return {
      ...redaction,
      redacted_excerpt: PROMPT_EXCERPT_WITHHELD,
      was_truncated: false,
      used_fallback: true,
    };
  }

  const truncated = truncateSafely(normalized, max_chars);
  return {
    ...redaction,
    redacted_excerpt: truncated.text,
    was_truncated: truncated.was_truncated,
    used_fallback: false,
  };
}

function createPlaceholderCounts(): Record<RedactionPlaceholder, number> {
  return {
    '[REDACTED_SECRET]': 0,
    '[REDACTED_PASSWORD]': 0,
    '[REDACTED_TOKEN]': 0,
    '[REDACTED_INTERNAL_HOST]': 0,
    '[REDACTED_CUSTOMER_DATA]': 0,
    '[REDACTED_PERSONAL_DATA]': 0,
  };
}

function normalizeExcerptWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function shouldWithholdExcerpt(
  text: string,
  totalPlaceholderCount: number,
): boolean {
  if (text.length === 0) {
    return true;
  }

  const visibleText = text
    .replace(/\[REDACTED_[A-Z_]+\]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '');

  if (visibleText.length === 0) {
    return true;
  }

  if (totalPlaceholderCount >= 3 && visibleText.length < 48) {
    return true;
  }

  return totalPlaceholderCount >= 2 &&
    visibleText.length < MIN_VISIBLE_CHARS_AFTER_REDACTION;
}

function truncateSafely(
  text: string,
  max_chars: number,
): { text: string; was_truncated: boolean } {
  if (text.length <= max_chars) {
    return { text, was_truncated: false };
  }

  const ellipsis = '...';
  const hardLimit = Math.max(0, max_chars - ellipsis.length);
  let cut = hardLimit;

  const lastWhitespace = text.lastIndexOf(' ', hardLimit);
  if (lastWhitespace >= Math.floor(hardLimit * 0.6)) {
    cut = lastWhitespace;
  }

  const openBracket = text.lastIndexOf('[', cut);
  const closeBracket = text.lastIndexOf(']', cut);
  if (openBracket > closeBracket) {
    cut = openBracket;
  }

  const finalText = text.slice(0, cut).trimEnd();
  return {
    text: finalText.length > 0 ? `${finalText}${ellipsis}` : PROMPT_EXCERPT_WITHHELD,
    was_truncated: true,
  };
}
