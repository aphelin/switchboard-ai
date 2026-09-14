import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request body against a Zod schema. Used for payloads whose shape
 * is defined by a library (the AI SDK chat request) rather than by our own
 * class-validator DTOs; the global ValidationPipe leaves plain `Object`
 * parameters untouched, so this pipe is the only validation on the route.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      throw new BadRequestException(`Validation failed: ${message}`);
    }
    return result.data;
  }
}
