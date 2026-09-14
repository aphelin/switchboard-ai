/**
 * API key shapes. Upstream error messages sometimes echo the key that was
 * sent, so anything matching is masked before it is traced, logged or
 * returned to a client.
 */
const KEY_PATTERNS: Array<{ pattern: RegExp; prefix: string }> = [
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{8,}/g, prefix: 'sk-ant-' }, // Anthropic
  { pattern: /\bsk-[A-Za-z0-9_-]{16,}/g, prefix: 'sk-' }, // OpenAI (sk-..., sk-proj-...)
  { pattern: /\bAIza[0-9A-Za-z_-]{20,}/g, prefix: 'AIza' }, // Google
  { pattern: /\bmat_[A-Za-z0-9_-]{16,}/g, prefix: 'mat_' }, // this API's own keys
];

/** Shorter values are too likely to match ordinary words. */
const MIN_KNOWN_SECRET_LENGTH = 8;

/** Masks known key formats plus any exact secrets passed in (e.g. the key used for the failed call). */
export function redactSecrets(
  text: string,
  knownSecrets: Array<string | undefined> = [],
): string {
  let result = text;
  for (const secret of knownSecrets) {
    if (secret && secret.length >= MIN_KNOWN_SECRET_LENGTH) {
      result = result.split(secret).join('[redacted]');
    }
  }
  for (const { pattern, prefix } of KEY_PATTERNS) {
    result = result.replace(pattern, `${prefix}[redacted]`);
  }
  return result;
}
