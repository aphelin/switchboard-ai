/** Rough token estimate (≈4 characters per token for English), for when no tokenizer or provider count is at hand. */
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);
