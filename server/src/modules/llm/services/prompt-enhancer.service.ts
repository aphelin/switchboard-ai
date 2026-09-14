import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from './llm.service';
import type { TraceContext } from '../types/llm.types';

export const EnhancedPromptSchema = z.object({
  enhancedPrompt: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      'The improved image prompt: subject, setting, lighting, style, composition, medium',
    ),
  // Strict JSON-schema mode (OpenAI) requires every field; "no value" is expressed as null.
  negativePrompt: z
    .string()
    .max(500)
    .nullable()
    .describe(
      'Comma-separated things the image must avoid (artifacts, unwanted elements), or null',
    ),
  styleTags: z
    .array(z.string().max(40))
    .max(8)
    .describe('Short tags summarising the visual style'),
});

export type EnhancedPrompt = z.infer<typeof EnhancedPromptSchema>;

const INSTRUCTIONS = `You are an expert prompt engineer for text-to-image models.
Rewrite the user's image prompt to be vivid and specific: keep the original subject and intent,
add concrete details about composition, lighting, style, medium and mood. Do not add text overlays,
watermarks or unrelated subjects. Keep it under 120 words.`;

/**
 * "Enhance prompt" as a schema-validated call instead of free text: the output
 * is guaranteed to have the fields the pipeline needs, or the caller falls back
 * to the original prompt.
 */
@Injectable()
export class PromptEnhancerService {
  private readonly logger = new Logger(PromptEnhancerService.name);

  constructor(private readonly llm: LlmService) {}

  async enhance(
    prompt: string,
    context: TraceContext = {},
  ): Promise<EnhancedPrompt | null> {
    try {
      return await this.llm.generateObject(EnhancedPromptSchema, {
        name: 'prompt.enhance',
        traceId: context.traceId,
        userId: context.userId,
        model: 'fast',
        instructions: INSTRUCTIONS,
        prompt: `Original prompt: "${prompt}"`,
      });
    } catch (error) {
      this.logger.warn(
        `Prompt enhancement failed, using original prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
