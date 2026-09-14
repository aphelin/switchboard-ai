import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AppConfiguration } from '../../../config/configuration.interface';

/**
 * Rows created before auth existed have no owner. With AUTH_CLAIM_LEGACY_DATA
 * enabled, the first account ever created takes them over. This is the "expand"
 * half of an expand/contract migration: once claimed, userId can become NOT NULL.
 */
@Injectable()
export class LegacyDataService {
  private readonly logger = new Logger(LegacyDataService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.enabled = configService.get('auth', { infer: true }).claimLegacyData;
  }

  /** Never throws: a failed claim must not break sign-up. */
  async claimForFirstAccount(userId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const accounts = await this.prisma.account.count();
      if (accounts !== 1) return;

      const where = { userId: null };
      const data = { userId };
      const [generations, documents, conversations, llmCalls] =
        await this.prisma.$transaction([
          this.prisma.generation.updateMany({ where, data }),
          this.prisma.document.updateMany({ where, data }),
          this.prisma.conversation.updateMany({ where, data }),
          this.prisma.llmCall.updateMany({ where, data }),
        ]);

      this.logger.log(
        `First account ${userId} claimed legacy data: ${generations.count} generations, ${documents.count} documents, ${conversations.count} conversations, ${llmCalls.count} LLM calls`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to claim legacy data for ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
