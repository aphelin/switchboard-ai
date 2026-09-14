/**
 * Keeps only the most recent messages so long conversations stay inside the
 * model's context budget. The window always starts at a user message: a
 * dangling assistant/tool message without its preceding turn confuses models
 * and breaks tool-call/result pairing.
 *
 * A fuller implementation would summarise the dropped messages instead of
 * forgetting them.
 */
export function trimHistory<T extends { role: string }>(
  messages: T[],
  max: number,
): T[] {
  if (messages.length <= max) return messages;

  let start = messages.length - max;
  while (start < messages.length && messages[start].role !== 'user') start++;
  return messages.slice(start);
}

/** Concatenated text of a UI message's text parts. */
export function textOfMessage(
  message: { parts: Array<{ type: string; text?: string }> } | undefined,
): string {
  if (!message) return '';
  return message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join(' ')
    .trim();
}
