import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { DEMO } from '../../../shared/constants/app.constants';
import { startOfUtcDay } from '../../auth/utils/budget';
import { guestCutoff, guestExpiresAt, storageKeyOf } from '../utils/guests';
import type {
  AppConfiguration,
  DemoConfig,
} from '../../../config/configuration.interface';
import type { DemoStatus, GuestBlock } from '../types/demo.types';

/**
 * Lifecycle of one-click guest sessions: whether a new one may open, when it
 * expires, and the sweep that deletes expired guests with everything they own.
 */
@Injectable()
export class DemoGuestsService {
  private readonly logger = new Logger(DemoGuestsService.name);
  private readonly config: DemoConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.config = configService.get('demo', { infer: true });
  }

  status(): DemoStatus {
    return {
      enabled: this.config.enabled,
      guestTtlHours: this.config.guestTtlHours,
      guestDailyBudgetUsd: this.config.guestDailyBudgetUsd,
    };
  }

  /** Checked before Better Auth creates a guest. Per-IP limits are Better Auth's rate limiter. */
  async creationBlock(): Promise<GuestBlock | null> {
    if (!this.config.enabled) {
      return {
        status: 'FORBIDDEN',
        message:
          'The demo is turned off on this server. Create an account instead.',
      };
    }
    const guestsToday = await this.prisma.user.count({
      where: { isAnonymous: true, createdAt: { gte: startOfUtcDay() } },
    });
    if (guestsToday >= this.config.maxGuestsPerDay) {
      return {
        status: 'TOO_MANY_REQUESTS',
        message:
          "Today's demo sessions are all taken. Create an account instead, or try again after midnight UTC.",
      };
    }
    return null;
  }

  /** When a guest and its data will be deleted; null for regular accounts. */
  async expiresAt(userId: string): Promise<Date | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAnonymous: true, createdAt: true },
    });
    return user?.isAnonymous
      ? guestExpiresAt(user.createdAt, this.config.guestTtlHours)
      : null;
  }

  /**
   * Deletes guests past their lifetime. Rows go with the user (onDelete: Cascade);
   * image files are deleted afterwards, unless another generation still points at
   * them (copies share the template's files). Returns the number of guests deleted.
   */
  async deleteExpired(now: Date = new Date()): Promise<number> {
    const guests = await this.prisma.user.findMany({
      where: {
        isAnonymous: true,
        createdAt: { lt: guestCutoff(this.config.guestTtlHours, now) },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: DEMO.CLEANUP_BATCH,
    });
    if (guests.length === 0) return 0;

    const ids = guests.map((guest) => guest.id);
    const generations = await this.prisma.generation.findMany({
      where: { userId: { in: ids } },
      select: { parameters: true },
    });
    const storageKeys = new Set(
      generations
        .map((generation) => storageKeyOf(generation.parameters))
        .filter((key): key is string => key !== null),
    );

    const { count } = await this.prisma.user.deleteMany({
      where: { id: { in: ids }, isAnonymous: true },
    });

    let filesDeleted = 0;
    for (const key of storageKeys) {
      const stillUsed = await this.prisma.generation.count({
        where: { parameters: { path: ['storageKey'], equals: key } },
      });
      if (stillUsed === 0) {
        await this.storage.delete(key);
        filesDeleted++;
      }
    }

    this.logger.log(
      `Deleted ${count} expired guest(s) and ${filesDeleted} image file(s)`,
    );
    return count;
  }
}
