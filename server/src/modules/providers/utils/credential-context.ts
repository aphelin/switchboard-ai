import type { ByokProvider } from '../../llm/catalog/model-catalog';

/** Associated data for a stored key: the ciphertext only decrypts for this owner and provider. */
export const credentialContext = (userId: string, provider: ByokProvider) =>
  `provider-credential:${userId}:${provider}`;
