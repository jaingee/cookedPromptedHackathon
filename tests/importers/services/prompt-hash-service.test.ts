import { describe, it, expect } from 'vitest';
import { computePromptHash } from '../../../src/importers/local/services/prompt-hash-service.js';

describe('computePromptHash', () => {
  it('produces a deterministic SHA-256 hex hash', () => {
    const hash1 = computePromptHash('hello world');
    const hash2 = computePromptHash('hello world');

    expect(hash1).toBe(hash2);
  });

  it('produces a 64-character lowercase hex string', () => {
    const hash = computePromptHash('test prompt');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different inputs produce different hashes', () => {
    const hash1 = computePromptHash('prompt A');
    const hash2 = computePromptHash('prompt B');

    expect(hash1).not.toBe(hash2);
  });

  it('empty string produces a deterministic hash', () => {
    const hash = computePromptHash('');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of empty string is well-known
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes prompt text only — no additional inputs required', () => {
    // The function accepts a single string parameter
    const hash = computePromptHash('single argument only');
    expect(typeof hash).toBe('string');
  });
});
