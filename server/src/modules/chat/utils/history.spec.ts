import { describe, expect, it } from 'vitest';
import { textOfMessage, trimHistory } from './history';

const msg = (role: string, id: number) => ({ id: `m${id}`, role });

describe('trimHistory', () => {
  it('returns the same array when it fits in the window', () => {
    const messages = [msg('user', 1), msg('assistant', 2)];
    expect(trimHistory(messages, 10)).toBe(messages);
    expect(trimHistory(messages, 2)).toBe(messages);
  });

  it('keeps only the most recent messages', () => {
    const messages = [
      msg('user', 1),
      msg('assistant', 2),
      msg('user', 3),
      msg('assistant', 4),
      msg('user', 5),
      msg('assistant', 6),
    ];
    expect(trimHistory(messages, 4).map((m) => m.id)).toEqual([
      'm3',
      'm4',
      'm5',
      'm6',
    ]);
  });

  it('always starts the window at a user message', () => {
    const messages = [
      msg('user', 1),
      msg('assistant', 2),
      msg('user', 3),
      msg('assistant', 4),
      msg('user', 5),
      msg('assistant', 6),
    ];
    // A window of 3 would start at the assistant message m4; it must skip to m5.
    const trimmed = trimHistory(messages, 3);
    expect(trimmed[0].role).toBe('user');
    expect(trimmed.map((m) => m.id)).toEqual(['m5', 'm6']);
  });

  it('returns an empty array when no user message is inside the window', () => {
    const messages = [msg('user', 1), msg('assistant', 2), msg('assistant', 3)];
    expect(trimHistory(messages, 2)).toEqual([]);
  });
});

describe('textOfMessage', () => {
  it('joins the text parts and ignores other part types', () => {
    const message = {
      parts: [
        { type: 'step-start' },
        { type: 'text', text: 'Hello' },
        { type: 'tool-search_documents', text: 'should be ignored' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(textOfMessage(message)).toBe('Hello world');
  });

  it('returns an empty string for undefined or text-less messages', () => {
    expect(textOfMessage(undefined)).toBe('');
    expect(textOfMessage({ parts: [{ type: 'file' }] })).toBe('');
    expect(textOfMessage({ parts: [{ type: 'text', text: '   ' }] })).toBe('');
  });
});
