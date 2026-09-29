import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGenerationDto } from './create-generation.dto';

/** Same options as the global ValidationPipe in main.ts. */
async function errorsFor(body: Record<string, unknown>): Promise<string> {
  const dto = plainToInstance(CreateGenerationDto, body, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return JSON.stringify(errors);
}

describe('CreateGenerationDto', () => {
  it('accepts text options on a text generation', async () => {
    expect(
      await errorsFor({
        prompt: 'Write a haiku',
        type: 'TEXT',
        parameters: { systemPrompt: 'You are a poet.', temperature: 0.7 },
      }),
    ).toBe('[]');
  });

  it('accepts image options on an image generation', async () => {
    expect(
      await errorsFor({
        prompt: 'A lighthouse',
        type: 'IMAGE',
        parameters: { width: 512, height: 512, negativePrompt: 'blurry' },
      }),
    ).toBe('[]');
  });

  it('rejects an oversized system prompt', async () => {
    const errors = await errorsFor({
      prompt: 'Write a haiku',
      type: 'TEXT',
      parameters: { systemPrompt: 'x'.repeat(4001) },
    });
    expect(errors).toContain('systemPrompt');
    expect(errors).toContain('maxLength');
  });

  it('rejects an oversized negative prompt', async () => {
    const errors = await errorsFor({
      prompt: 'A lighthouse',
      type: 'IMAGE',
      parameters: { negativePrompt: 'x'.repeat(1001) },
    });
    expect(errors).toContain('negativePrompt');
    expect(errors).toContain('maxLength');
  });
});
