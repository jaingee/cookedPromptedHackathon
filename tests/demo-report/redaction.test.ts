import { describe, expect, it } from 'vitest';
import {
  buildRedactedExcerpt,
  PROMPT_EXCERPT_WITHHELD,
  redactPromptForReport,
} from '../../src/demo-report/redaction.js';
const OPENAI_SECRET = ['sk', 'FAKE1234567890'].join('-');
const REPO_PASSWORD = ['hunter', '2'].join('');
const INTERNAL_DB_HOST = ['db', 'internal', 'example', 'com:5432'].join('.');
const INTERNAL_DB_SHORT = ['db', 'internal', 'example', 'com'].join('.');

describe('demo-report redaction helpers', () => {
  it('masks api key and known secret-like tokens', () => {
    const result = redactPromptForReport(
      `My API key is ${OPENAI_SECRET} and fallback ghp_ABCDEF1234567890.`,
    );

    expect(result.redacted_prompt).toContain('[REDACTED_SECRET]');
    expect(result.redacted_prompt).not.toContain(OPENAI_SECRET);
    expect(result.redacted_prompt).not.toContain('ghp_ABCDEF1234567890');
    expect(result.placeholder_counts['[REDACTED_SECRET]']).toBe(2);
  });

  it('masks bearer, access, and refresh tokens', () => {
    const result = redactPromptForReport(
      'Use Bearer abcdef1234567890 and access_token=tok_1234567890 and refresh-token: refresh987654321.',
    );

    expect(result.redacted_prompt).toContain('Bearer [REDACTED_TOKEN]');
    expect(result.redacted_prompt).toContain('access_token=[REDACTED_TOKEN]');
    expect(result.redacted_prompt).toContain('refresh-token: [REDACTED_TOKEN]');
    expect(result.redacted_prompt).not.toContain('abcdef1234567890');
    expect(result.placeholder_counts['[REDACTED_TOKEN]']).toBe(3);
  });

  it('masks password assignments and password phrases', () => {
    const result = redactPromptForReport(
      `password=${REPO_PASSWORD}. My password is swordfish.`,
    );

    expect(result.redacted_prompt).toContain('password=[REDACTED_PASSWORD]');
    expect(result.redacted_prompt).toContain('password is [REDACTED_PASSWORD]');
    expect(result.redacted_prompt).not.toContain(REPO_PASSWORD);
    expect(result.redacted_prompt).not.toContain('swordfish');
  });

  it('masks private key blocks without leaking any block content', () => {
    const prompt = [
      'Please review this key:',
      '-----BEGIN PRIVATE KEY-----',
      'abc123supersecret',
      '-----END PRIVATE KEY-----',
    ].join('\n');

    const result = redactPromptForReport(prompt);

    expect(result.redacted_prompt).toContain('[REDACTED_SECRET]');
    expect(result.redacted_prompt).not.toContain('abc123supersecret');
    expect(result.redacted_prompt).not.toContain('BEGIN PRIVATE KEY');
  });

  it('masks internal hostnames and service references', () => {
    const result = redactPromptForReport(
      `Database host: ${INTERNAL_DB_HOST} and service auth.svc.cluster.local should be checked.`,
    );

    expect(result.redacted_prompt).not.toContain(INTERNAL_DB_HOST);
    expect(result.redacted_prompt).not.toContain('auth.svc.cluster.local');
    expect(result.placeholder_counts['[REDACTED_INTERNAL_HOST]']).toBe(2);
  });

  it('masks customer and account identifiers', () => {
    const result = redactPromptForReport(
      'customer_id=acct_123456 and account-email=vip@example.org',
    );

    expect(result.redacted_prompt).toContain('customer_id=[REDACTED_CUSTOMER_DATA]');
    expect(result.redacted_prompt).toContain('account-email=[REDACTED_CUSTOMER_DATA]');
    expect(result.redacted_prompt).not.toContain('acct_123456');
    expect(result.redacted_prompt).not.toContain('vip@example.org');
  });

  it('masks obvious personal data such as email and phone numbers', () => {
    const result = redactPromptForReport(
      'Email me at jane.doe@example.com or call 555-123-4567.',
    );

    expect(result.redacted_prompt).toContain('[REDACTED_PERSONAL_DATA]');
    expect(result.redacted_prompt).not.toContain('jane.doe@example.com');
    expect(result.redacted_prompt).not.toContain('555-123-4567');
    expect(result.placeholder_counts['[REDACTED_PERSONAL_DATA]']).toBe(2);
  });

  it('handles overlap cases deterministically', () => {
    const prompt =
      `password=${REPO_PASSWORD} Bearer abcdef1234567890 host=${INTERNAL_DB_SHORT} customer_id=acct_123`;
    const first = redactPromptForReport(prompt);
    const second = redactPromptForReport(prompt);

    expect(first).toEqual(second);
    expect(first.redacted_prompt).not.toContain(REPO_PASSWORD);
    expect(first.redacted_prompt).not.toContain('abcdef1234567890');
    expect(first.redacted_prompt).not.toContain(INTERNAL_DB_SHORT);
    expect(first.redacted_prompt).not.toContain('acct_123');
  });

  it('redacts before truncation and never reveals partial secrets in excerpts', () => {
    const prompt = `Intro text ${'x'.repeat(20)} ${OPENAI_SECRET} ${'y'.repeat(80)}`;
    const excerpt = buildRedactedExcerpt(prompt, { max_chars: 55 });

    expect(excerpt.redacted_excerpt).toContain('[REDACTED_SECRET]');
    expect(excerpt.redacted_excerpt).not.toContain(OPENAI_SECRET);
    expect(excerpt.redacted_excerpt).not.toContain('FAKE1234');
    expect(excerpt.was_truncated).toBe(true);
  });

  it('uses fallback when the prompt is too redacted to teach from', () => {
    const prompt =
      `password=${REPO_PASSWORD} access_token=tok_123456789 customer_id=acct_999`;
    const excerpt = buildRedactedExcerpt(prompt);

    expect(excerpt.redacted_excerpt).toBe(PROMPT_EXCERPT_WITHHELD);
    expect(excerpt.used_fallback).toBe(true);
  });

  it('does not over-redact ordinary code or prose', () => {
    const prompt = [
      'function validatePasswordStrength(password: string) {',
      '  return password.length > 8;',
      '}',
      'Explain what this helper does.',
    ].join('\n');
    const result = redactPromptForReport(prompt);

    expect(result.redacted_prompt).toContain('validatePasswordStrength');
    expect(result.redacted_prompt).toContain('password.length > 8');
    expect(result.redacted_prompt).not.toContain('[REDACTED_PASSWORD]');
  });

  it('returns only safe field names and never leaks banned full-answer keys', () => {
    const result = buildRedactedExcerpt(`api_key=${OPENAI_SECRET}`);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('"assistant_message"');
    expect(serialized).not.toContain('"response"');
    expect(serialized).not.toContain('"completion"');
    expect(serialized).not.toContain('"model_answer"');
    expect(serialized).not.toContain('"output_text"');
    expect(serialized).not.toContain('"generated_text"');
    expect(serialized).not.toContain('"template_body"');
    expect(serialized).not.toContain(OPENAI_SECRET);
  });
});
