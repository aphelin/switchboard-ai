import { API_KEY_HEADER, API_KEY_PREFIX } from '../auth.constants';

/**
 * Reads an API key from `x-api-key`, or from `Authorization: Bearer <key>` when
 * the token has our key prefix (so other bearer tokens are never mistaken for keys).
 */
export function extractApiKey(headers: Headers): string | null {
  const explicit = headers.get(API_KEY_HEADER)?.trim();
  if (explicit) return explicit;

  const match = headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
  if (match && match[1].startsWith(API_KEY_PREFIX)) return match[1];

  return null;
}
