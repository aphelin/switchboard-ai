import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmService } from '../../llm/services/llm.service';
import { SecretBox } from '../../../shared/crypto/secret-box';
import { upstreamStatusOf } from '../../../shared/errors/upstream.error';
import {
  BYOK_PROVIDER_INFO,
  type ByokProvider,
} from '../../llm/catalog/model-catalog';
import { createUserKeyRoute } from '../utils/user-key-route';
import { credentialContext } from '../utils/credential-context';
import { InvalidProviderKeyException } from '../errors/provider.exceptions';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  SavedProviderKey,
  StoredProviderKey,
} from '../types/providers.types';

/** Enough for any provider to answer "ok" (OpenAI requires at least 16). */
const VERIFY_MAX_OUTPUT_TOKENS = 16;

/**
 * Users' own provider API keys. A key is verified with a tiny request before it
 * is stored, encrypted with AES-256-GCM, and only its last 4 characters are ever
 * returned. The plaintext is decrypted per request, on the server, for the
 * user it belongs to.
 */
@Injectable()
export class ProviderCredentialsService {
  private readonly logger = new Logger(ProviderCredentialsService.name);
  private readonly secretBox: SecretBox | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    const { encryptionKey } = configService.get('credentials', {
      infer: true,
    });
    // A malformed key fails startup, instead of storing secrets nobody can decrypt later.
    this.secretBox = encryptionKey
      ? SecretBox.fromBase64Key(encryptionKey)
      : null;
    if (!this.secretBox) {
      this.logger.warn(
        'CREDENTIALS_ENCRYPTION_KEY is not set: users can only use the included models',
      );
    }
  }

  get enabled(): boolean {
    return this.secretBox !== null;
  }

  list(userId: string): Promise<StoredProviderKey[]> {
    return this.prisma.providerCredential.findMany({
      where: { userId },
      select: { provider: true, keyHint: true, updatedAt: true },
    });
  }

  async save(
    userId: string,
    provider: ByokProvider,
    rawKey: string,
  ): Promise<SavedProviderKey> {
    const secretBox = this.requireSecretBox();
    const apiKey = rawKey.trim();
    const warning = await this.verify(userId, provider, apiKey);

    const encryptedKey = secretBox.encrypt(
      apiKey,
      credentialContext(userId, provider),
    );
    const keyHint = apiKey.slice(-4);
    const saved = await this.prisma.providerCredential.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, encryptedKey, keyHint },
      update: { encryptedKey, keyHint },
      select: { provider: true, keyHint: true, updatedAt: true },
    });
    this.logger.log(`User ${userId} saved a ${provider} key`);
    return { ...saved, warning };
  }

  async remove(userId: string, provider: ByokProvider): Promise<void> {
    await this.prisma.providerCredential.deleteMany({
      where: { userId, provider },
    });
  }

  /** The decrypted key, for server-side calls on behalf of its owner only. Never returned by an endpoint. */
  async getApiKey(
    userId: string,
    provider: ByokProvider,
  ): Promise<string | null> {
    if (!this.secretBox) return null;
    const row = await this.prisma.providerCredential.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { encryptedKey: true },
    });
    if (!row) return null;

    try {
      return this.secretBox.decrypt(
        row.encryptedKey,
        credentialContext(userId, provider),
      );
    } catch {
      this.logger.error(
        `Stored ${provider} key of user ${userId} cannot be decrypted (was CREDENTIALS_ENCRYPTION_KEY changed?)`,
      );
      return null;
    }
  }

  /**
   * One short request on the provider's cheapest model: proves the key works
   * before it is stored. Returns a warning when the key is valid but currently
   * rate limited or out of quota.
   */
  private async verify(
    userId: string,
    provider: ByokProvider,
    apiKey: string,
  ): Promise<string | null> {
    const label = BYOK_PROVIDER_INFO[provider].label;
    try {
      await this.llm.generateText({
        name: 'provider.verify',
        userId,
        route: createUserKeyRoute(provider, apiKey),
        model: 'fast',
        prompt: 'Reply with the single word: ok',
        maxOutputTokens: VERIFY_MAX_OUTPUT_TOKENS,
        metadata: { provider },
      });
      return null;
    } catch (error) {
      const status = upstreamStatusOf(error);
      if (status === 401 || status === 403) {
        throw new InvalidProviderKeyException(
          `${label} rejected this key (HTTP ${status}). Check that it was copied completely and is still active.`,
        );
      }
      if (status === 429) {
        return `${label} accepted the key but is rate limiting it or the account is out of quota, so requests may fail until that is resolved.`;
      }
      if (status !== undefined && status >= 400 && status < 500) {
        // Already redacted by LlmService; usually a model the key has no access to.
        const detail = error instanceof Error ? error.message : String(error);
        throw new InvalidProviderKeyException(
          `${label} refused a test request with this key: ${detail}`,
        );
      }
      throw new BadGatewayException(
        `Could not reach ${label} to verify the key. Nothing was saved; try again.`,
      );
    }
  }

  private requireSecretBox(): SecretBox {
    if (!this.secretBox) {
      throw new ServiceUnavailableException(
        'Using your own provider keys is disabled on this server (CREDENTIALS_ENCRYPTION_KEY is not set).',
      );
    }
    return this.secretBox;
  }
}
