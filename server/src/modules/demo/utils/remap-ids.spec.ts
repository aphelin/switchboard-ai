import { describe, expect, it } from 'vitest';
import { createIdRemapper } from './remap-ids';

const OLD_GENERATION = '6f1c2f7e-2b0a-4a8e-9a57-0d8f5b1f3c21';
const NEW_GENERATION = 'b3f0a9d2-6c1e-4f7b-8e2d-5a4c3b2a1f90';
const OLD_CONVERSATION = 'Xk3q9TzPq1LmN8vB';
const NEW_CONVERSATION = '0c6d8e2a-1b3f-4a5c-9d7e-2f1a0b9c8d7e';

describe('createIdRemapper', () => {
  const remap = createIdRemapper(
    new Map([
      [OLD_GENERATION, NEW_GENERATION],
      [OLD_CONVERSATION, NEW_CONVERSATION],
    ]),
  );

  it('rewrites ids nested anywhere in a JSON value', () => {
    const parts = [
      { type: 'text', text: 'Queued it.' },
      {
        type: 'tool-generate_image',
        output: {
          generationId: OLD_GENERATION,
          imageUrl: `http://localhost:4000/api/generations/${OLD_GENERATION}/image?v=1`,
        },
      },
    ];
    expect(remap(parts)).toEqual([
      { type: 'text', text: 'Queued it.' },
      {
        type: 'tool-generate_image',
        output: {
          generationId: NEW_GENERATION,
          imageUrl: `http://localhost:4000/api/generations/${NEW_GENERATION}/image?v=1`,
        },
      },
    ]);
  });

  it('rewrites plain strings and leaves other values alone', () => {
    expect(remap(`/api/generations/${OLD_GENERATION}/image`)).toBe(
      `/api/generations/${NEW_GENERATION}/image`,
    );
    expect(remap({ conversationId: OLD_CONVERSATION, steps: 3 })).toEqual({
      conversationId: NEW_CONVERSATION,
      steps: 3,
    });
    expect(remap(null)).toBeNull();
    expect(remap(undefined)).toBeUndefined();
  });

  it('never rewrites short ids, which could be ordinary words', () => {
    const short = createIdRemapper(new Map([['vault', 'replaced']]));
    expect(short({ text: 'Freeze the vault first' })).toEqual({
      text: 'Freeze the vault first',
    });
  });

  it('does not mutate its input', () => {
    const input = { id: OLD_GENERATION };
    remap(input);
    expect(input.id).toBe(OLD_GENERATION);
  });
});
