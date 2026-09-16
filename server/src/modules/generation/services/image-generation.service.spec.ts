import { describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { MockImageModelV4 } from 'ai/test';
import { ImageGenerationService } from './image-generation.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import {
  BYOK_IMAGE_MODELS,
  FALLBACK_PLATFORM_IMAGE_MODELS,
  findImageModel,
  type ImageCatalogModel,
} from '../../llm/catalog/image-catalog';
import type { PollinationsService } from '../../pollinations/services/pollinations.service';
import type {
  RecordLlmCallInput,
  TraceService,
} from '../../observability/services/trace.service';
import type { UserKeyImageRoute } from '../../llm/types/llm.types';

const GOOGLE_KEY = 'AIzaSyFakeGoogleKeyForTests1234567890';
/** PNG signature bytes: enough for the SDK to detect the media type. */
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);

const catalogModel = (
  models: ImageCatalogModel[],
  id: string,
): ImageCatalogModel => {
  const model = findImageModel(models, id);
  if (!model) throw new Error(`${id} is not in the catalog`);
  return model;
};

type DoGenerate = MockImageModelV4['doGenerate'];

const imageResult = () => ({
  images: [PNG],
  warnings: [],
  response: {
    timestamp: new Date(),
    modelId: 'gemini-3.1-flash-image',
    headers: undefined,
  },
});

const userRoute = (doGenerate: DoGenerate): UserKeyImageRoute => {
  const model = new MockImageModelV4({ provider: 'google', doGenerate });
  return {
    source: 'user',
    provider: 'google',
    model: catalogModel(BYOK_IMAGE_MODELS, 'google:gemini-3.1-flash-image'),
    imageModel: vi.fn(() => model),
  };
};

function setup() {
  const records: RecordLlmCallInput[] = [];
  const trace = {
    record: vi.fn((input: RecordLlmCallInput) => {
      records.push(input);
      return Promise.resolve();
    }),
  } as unknown as TraceService;
  const pollinations = {
    generateImage: vi.fn(() =>
      Promise.resolve({ data: Buffer.from('jpeg'), contentType: 'image/jpeg' }),
    ),
  };
  const service = new ImageGenerationService(
    pollinations as unknown as PollinationsService,
    trace,
    new CircuitBreakerService(),
  );
  return { service, pollinations, records };
}

describe('ImageGenerationService', () => {
  it("runs a Gemini image model on the user's key, traced with the per-image price", async () => {
    const { service, pollinations, records } = setup();
    const calls: Array<Parameters<DoGenerate>[0]> = [];
    const route = userRoute((options) => {
      calls.push(options);
      return Promise.resolve(imageResult());
    });

    const image = await service.generate({
      route,
      prompt: 'a red lighthouse',
      width: 1920,
      height: 1080,
      negativePrompt: 'text, watermark',
      userId: 'user-1',
      traceId: 'generation-1',
    });

    expect(image.contentType).toBe('image/png');
    expect(image.data.byteLength).toBe(PNG.byteLength);
    expect(route.imageModel).toHaveBeenCalledWith('gemini-3.1-flash-image');
    expect(calls[0].aspectRatio).toBe('16:9');
    expect(calls[0].prompt).toBe('a red lighthouse\n\nAvoid: text, watermark');
    expect(pollinations.generateImage).not.toHaveBeenCalled();
    expect(records[0]).toMatchObject({
      name: 'generation.image',
      traceId: 'generation-1',
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      keySource: 'user',
      status: 'ok',
      costUsd: 0.067,
    });
  });

  it('edits on the user key by sending the source image with the prompt', async () => {
    const { service, pollinations, records } = setup();
    const calls: Array<Parameters<DoGenerate>[0]> = [];
    const route = userRoute((options) => {
      calls.push(options);
      return Promise.resolve(imageResult());
    });
    const sourceBytes = Buffer.from(PNG);

    await service.generate({
      route,
      prompt: 'make the sky red',
      source: {
        data: sourceBytes,
        contentType: 'image/png',
        generationId: 'gen-src',
      },
      userId: 'user-1',
      traceId: 'generation-2',
    });

    expect(calls[0].prompt).toBe('make the sky red');
    expect(calls[0].files).toEqual([
      expect.objectContaining({ type: 'file', data: sourceBytes }),
    ]);
    expect(pollinations.generateImage).not.toHaveBeenCalled();
    expect(records[0]).toMatchObject({
      name: 'generation.image-edit',
      keySource: 'user',
      status: 'ok',
      metadata: expect.objectContaining({ sourceGenerationId: 'gen-src' }),
    });
  });

  it('explains a rejected key without leaking it', async () => {
    const { service, records } = setup();
    const route = userRoute(() => {
      throw new APICallError({
        message: `API key not valid: ${GOOGLE_KEY}`,
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
        requestBodyValues: {},
        statusCode: 403,
        isRetryable: false,
      });
    });

    const error = (await service
      .generate({ route, prompt: 'a lighthouse', userId: 'user-1' })
      .catch((e: unknown) => e)) as Error;

    expect(error.message).toMatch(
      /Google Gemini: rejected your API key \(HTTP 403\)/,
    );
    expect(error.message).not.toContain(GOOGLE_KEY);
    expect(records[0]).toMatchObject({ keySource: 'user', status: 'error' });
    expect(records[0].error).not.toContain(GOOGLE_KEY);
  });

  it("runs included models on Pollinations and records the spend on the app's key", async () => {
    const { service, pollinations, records } = setup();

    await service.generate({
      route: {
        source: 'platform',
        model: catalogModel(FALLBACK_PLATFORM_IMAGE_MODELS, 'platform:flux'),
      },
      prompt: 'a lighthouse',
      width: 1024,
      height: 768,
      seed: 7,
      userId: 'user-1',
    });

    expect(pollinations.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'flux',
        width: 1024,
        height: 768,
        seed: 7,
      }),
    );
    expect(records[0]).toMatchObject({
      provider: 'pollinations',
      model: 'flux',
      keySource: 'platform',
      status: 'ok',
      costUsd: 0.002,
    });
  });
});
