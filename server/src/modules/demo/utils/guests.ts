const HOUR_MS = 60 * 60 * 1000;

export const guestExpiresAt = (createdAt: Date, ttlHours: number): Date =>
  new Date(createdAt.getTime() + ttlHours * HOUR_MS);

/** Guests created before this moment have expired. */
export const guestCutoff = (ttlHours: number, now: Date = new Date()): Date =>
  new Date(now.getTime() - ttlHours * HOUR_MS);

/** The stored image file of a generation, if it has one (see GenerationProcessor). */
export const storageKeyOf = (parameters: unknown): string | null => {
  if (!parameters || typeof parameters !== 'object') return null;
  const key = (parameters as { storageKey?: unknown }).storageKey;
  return typeof key === 'string' && key.length > 0 ? key : null;
};
