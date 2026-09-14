import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const VERSION = 'v1';

/**
 * Authenticated encryption for secrets stored in the database (users' provider
 * API keys). AES-256-GCM with a random IV per value. Each payload is bound to a
 * context string (owner + provider) as associated data, so a ciphertext copied
 * into another user's row fails to decrypt instead of working for them.
 *
 * Format: `v1.<iv>.<auth tag>.<ciphertext>`, each part base64. The version
 * prefix leaves room for key rotation (a new version = a new key).
 */
export class SecretBox {
  private constructor(private readonly key: Buffer) {}

  static fromBase64Key(value: string): SecretBox {
    const key = Buffer.from(value, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `CREDENTIALS_ENCRYPTION_KEY must be ${KEY_BYTES} random bytes, base64-encoded (openssl rand -base64 32)`,
      );
    }
    return new SecretBox(key);
  }

  encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  /** Throws when the payload was tampered with, belongs to another context or was sealed with another key. */
  decrypt(payload: string, context: string): string {
    const [version, iv, tag, ciphertext, ...rest] = payload.split('.');
    if (
      version !== VERSION ||
      !iv ||
      !tag ||
      ciphertext === undefined ||
      rest.length > 0
    ) {
      throw new Error('Unsupported encrypted secret format');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64'),
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
