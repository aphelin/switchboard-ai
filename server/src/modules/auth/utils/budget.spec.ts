import { describe, expect, it } from 'vitest';
import { isOverBudget, startOfUtcDay } from './budget';

describe('startOfUtcDay', () => {
  it('truncates to midnight UTC regardless of local time', () => {
    const date = new Date('2026-09-14T23:59:59.999+04:00');
    expect(startOfUtcDay(date).toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('keeps midnight UTC unchanged', () => {
    const midnight = new Date('2026-09-14T00:00:00.000Z');
    expect(startOfUtcDay(midnight).toISOString()).toBe(midnight.toISOString());
  });
});

describe('isOverBudget', () => {
  it('is never over budget without a limit', () => {
    expect(isOverBudget(1000, null)).toBe(false);
  });

  it('blocks once spend reaches the limit', () => {
    expect(isOverBudget(0.49, 0.5)).toBe(false);
    expect(isOverBudget(0.5, 0.5)).toBe(true);
    expect(isOverBudget(0.51, 0.5)).toBe(true);
  });
});
