import { describe, expect, it } from 'vitest';
import { closestAspectRatio, withNegativePrompt } from './image-request';

describe('closestAspectRatio', () => {
  it('maps pixel sizes to the nearest supported ratio', () => {
    expect(closestAspectRatio(1024, 1024)).toBe('1:1');
    expect(closestAspectRatio(1920, 1080)).toBe('16:9');
    expect(closestAspectRatio(768, 1024)).toBe('3:4');
    expect(closestAspectRatio(1000, 1210)).toBe('4:5');
    expect(closestAspectRatio(2048, 256)).toBe('21:9');
  });

  it('leaves the ratio to the model when a dimension is missing', () => {
    expect(closestAspectRatio(1024, undefined)).toBeUndefined();
    expect(closestAspectRatio()).toBeUndefined();
  });
});

describe('withNegativePrompt', () => {
  it('appends exclusions in plain language', () => {
    expect(withNegativePrompt('a red lighthouse', 'text, watermark')).toBe(
      'a red lighthouse\n\nAvoid: text, watermark',
    );
  });

  it('leaves the prompt alone without exclusions', () => {
    expect(withNegativePrompt('a red lighthouse', '  ')).toBe(
      'a red lighthouse',
    );
    expect(withNegativePrompt('a red lighthouse')).toBe('a red lighthouse');
  });
});
