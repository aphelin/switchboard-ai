import { describe, expect, it } from 'vitest';
import { guestCutoff, guestExpiresAt, storageKeyOf } from './guests';

describe('guest lifetime', () => {
  const createdAt = new Date('2026-09-15T08:00:00.000Z');

  it('expires a guest ttlHours after it was created', () => {
    expect(guestExpiresAt(createdAt, 24).toISOString()).toBe(
      '2026-09-16T08:00:00.000Z',
    );
  });

  it('treats guests created before the cutoff as expired', () => {
    const now = new Date('2026-09-16T09:00:00.000Z');
    const cutoff = guestCutoff(24, now);
    expect(cutoff.toISOString()).toBe('2026-09-15T09:00:00.000Z');
    expect(createdAt < cutoff).toBe(true);
  });
});

describe('storageKeyOf', () => {
  it('reads the stored image key from generation parameters', () => {
    expect(
      storageKeyOf({ model: 'platform:flux', storageKey: 'images/a.png' }),
    ).toBe('images/a.png');
  });

  it('returns null when there is no stored file', () => {
    expect(storageKeyOf(null)).toBeNull();
    expect(storageKeyOf({ temperature: 0.7 })).toBeNull();
    expect(storageKeyOf({ storageKey: '' })).toBeNull();
    expect(storageKeyOf('images/a.png')).toBeNull();
  });
});
