import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redact-secrets';

describe('redactSecrets', () => {
  it('masks provider key formats', () => {
    const text =
      'Anthropic sk-ant-api03-AbCdEf123456_xyz, OpenAI sk-proj-AbCdEf1234567890abcd, Google AIzaSyAbCdEf1234567890abcdefghij, ours mat_AbCdEf1234567890abcd';
    const redacted = redactSecrets(text);
    expect(redacted).toBe(
      'Anthropic sk-ant-[redacted], OpenAI sk-[redacted], Google AIza[redacted], ours mat_[redacted]',
    );
  });

  it('masks an exact secret even when its format is unknown', () => {
    expect(
      redactSecrets('invalid key: custom-provider-key-42 was rejected', [
        'custom-provider-key-42',
      ]),
    ).toBe('invalid key: [redacted] was rejected');
  });

  it('ignores short or missing known secrets', () => {
    expect(redactSecrets('status ok', ['ok', undefined])).toBe('status ok');
  });

  it('leaves ordinary error text alone', () => {
    const message =
      'HTTP 429 - rate limit exceeded for model gpt-5.6-terra; retry in 20s';
    expect(redactSecrets(message)).toBe(message);
  });
});
