import { BadRequestException, Injectable } from '@nestjs/common';
import { PollinationsService } from '../../pollinations/services/pollinations.service';
import { TraceService } from '../../observability/services/trace.service';
import { PricingService } from '../../llm/services/pricing.service';
import { BudgetService } from '../../auth/services/budget.service';
import { redactSecrets } from '../../../shared/ai/redact-secrets';
import {
  CHAT,
  TRANSCRIPTION_MODEL,
} from '../../../shared/constants/app.constants';
import type { UploadedFileLike } from '../../documents/types/documents.types';
import type { TranscriptionResult } from '../types/chat.types';

/** Formats Pollinations accepts, with the extension it reads the format from. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
};

/**
 * Speech to text for the chat microphone. Runs on the app's Pollinations key,
 * so it is checked against the daily budget first and written to the ledger
 * afterwards, priced by the seconds the provider billed.
 */
@Injectable()
export class TranscriptionService {
  constructor(
    private readonly pollinations: PollinationsService,
    private readonly trace: TraceService,
    private readonly pricing: PricingService,
    private readonly budget: BudgetService,
  ) {}

  async transcribe(
    userId: string,
    file: UploadedFileLike,
    conversationId?: string,
  ): Promise<TranscriptionResult> {
    const baseType = file.mimetype.split(';')[0].trim().toLowerCase();
    const extension = AUDIO_EXTENSIONS[baseType];
    if (!extension) {
      throw new BadRequestException(
        `Unsupported audio format ${file.mimetype}. Send webm, ogg, mp4, m4a, mp3 or wav.`,
      );
    }
    if (file.size > CHAT.MAX_AUDIO_BYTES) {
      throw new BadRequestException('The recording is too large');
    }

    await this.budget.assertWithinBudget(userId);

    const call = {
      name: 'chat.transcribe',
      traceId: conversationId,
      userId,
      provider: 'pollinations',
      model: TRANSCRIPTION_MODEL,
      keySource: 'platform' as const,
    };
    const startedAt = Date.now();
    try {
      const result = await this.pollinations.transcribe({
        data: file.buffer,
        filename: `recording.${extension}`,
        contentType: baseType,
        model: TRANSCRIPTION_MODEL,
      });
      const seconds = result.seconds ?? 0;
      const costUsd = this.pricing.estimateAudioCost(
        TRANSCRIPTION_MODEL,
        seconds,
      );
      await this.trace.record({
        ...call,
        costUsd,
        latencyMs: Date.now() - startedAt,
        status: 'ok',
        metadata: { seconds, bytes: file.size, mimeType: baseType },
      });
      return { text: result.text, seconds, costUsd };
    } catch (error) {
      await this.trace.record({
        ...call,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        error: redactSecrets(
          error instanceof Error ? error.message : String(error),
        ),
        metadata: { bytes: file.size, mimeType: baseType },
      });
      throw error;
    }
  }
}
