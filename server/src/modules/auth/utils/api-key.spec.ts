import { describe, expect, it } from 'vitest';
import { extractApiKey } from './api-key';

describe('extractApiKey', () => {
  it('reads the x-api-key header', () => {
    expect(extractApiKey(new Headers({ 'x-api-key': ' mat_abc ' }))).toBe(
      'mat_abc',
    );
  });

  it('reads a prefixed bearer token', () => {
    expect(
      extractApiKey(new Headers({ authorization: 'Bearer mat_xyz' })),
    ).toBe('mat_xyz');
  });

  it('ignores bearer tokens without the key prefix', () => {
    expect(
      extractApiKey(new Headers({ authorization: 'Bearer eyJhbGciOi' })),
    ).toBeNull();
  });

  it('prefers x-api-key over Authorization', () => {
    const headers = new Headers({
      'x-api-key': 'mat_header',
      authorization: 'Bearer mat_bearer',
    });
    expect(extractApiKey(headers)).toBe('mat_header');
  });

  it('returns null when no key is present', () => {
    expect(extractApiKey(new Headers())).toBeNull();
  });
});
