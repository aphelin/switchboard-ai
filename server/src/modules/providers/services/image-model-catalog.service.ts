import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BYOK_IMAGE_MODELS,
  DEFAULT_PLATFORM_IMAGE_MODEL_ID,
  FALLBACK_PLATFORM_IMAGE_MODELS,
  findEditModel,
  findImageModel,
  parsePollinationsImageModels,
  type ImageCatalogModel,
  type PollinationsModelInfo,
} from '../../llm/catalog/image-catalog';
import type { AppConfiguration } from '../../../config/configuration.interface';

const MODELS_FETCH_TIMEOUT_MS = 15_000;
const MODELS_RETRY_DELAY_MS = 30_000;
const MODELS_MAX_ATTEMPTS = 3;

/**
 * The image models users can pick. Pollinations' list is loaded live, because
 * it changes often (several model ids this app once hardcoded now fail); the
 * Gemini models on users' own keys come from the static catalog.
 */
@Injectable()
export class ImageModelCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ImageModelCatalogService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private platformModels = FALLBACK_PLATFORM_IMAGE_MODELS;

  constructor(configService: ConfigService<AppConfiguration, true>) {
    const pollinations = configService.get('pollinations', { infer: true });
    this.baseUrl = pollinations.baseUrl;
    this.apiKey = pollinations.apiKey;
  }

  onModuleInit(): void {
    // Not awaited: startup must not wait on Pollinations; the built-in list serves meanwhile.
    void this.load();
  }

  platform(): ImageCatalogModel[] {
    return this.platformModels;
  }

  all(): ImageCatalogModel[] {
    return [...this.platformModels, ...BYOK_IMAGE_MODELS];
  }

  /** The default included model, or the first one if Pollinations stops listing it. */
  defaultModel(): ImageCatalogModel {
    return (
      findImageModel(this.platformModels, DEFAULT_PLATFORM_IMAGE_MODEL_ID) ??
      this.platformModels[0]
    );
  }

  /** The included model an edit runs on when none is named; undefined if Pollinations lists none. */
  defaultEditModel(): ImageCatalogModel | undefined {
    return findEditModel(this.platformModels);
  }

  find(choice: string): ImageCatalogModel | undefined {
    return findImageModel(this.all(), choice);
  }

  private async load(attempt = 1): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/image/models`, {
        headers: this.apiKey
          ? { Authorization: `Bearer ${this.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const models = parsePollinationsImageModels(
        (await response.json()) as PollinationsModelInfo[],
      );
      if (models.length === 0) throw new Error('no image models listed');
      this.platformModels = models;
      this.logger.log(`Loaded ${models.length} Pollinations image models`);
    } catch (error) {
      this.logger.warn(
        `Could not load Pollinations image models (attempt ${attempt}/${MODELS_MAX_ATTEMPTS}; using the built-in list): ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attempt < MODELS_MAX_ATTEMPTS) {
        setTimeout(() => {
          void this.load(attempt + 1);
        }, MODELS_RETRY_DELAY_MS).unref();
      }
    }
  }
}
