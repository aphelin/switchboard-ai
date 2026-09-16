import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BudgetExceededException,
  DemoBudgetExhaustedException,
} from '../errors/budget-exceeded.exception';
import { isOverBudget, startOfUtcDay } from '../utils/budget';
import type {
  AppConfiguration,
  DemoConfig,
} from '../../../config/configuration.interface';

/**
 * Per-user daily AI spending limit, computed from the LlmCall traces.
 * Sign-up is open, so this is what protects the provider balance.
 *
 * Guests get a smaller limit, and all guests together share one more, so
 * one-click sessions can't drain the platform key. Traces copied into a guest
 * from the demo template (`copiedFromId`) are history, not spend, and never count.
 *
 * The check runs before a costly call starts, so a user can overshoot by the
 * cost of the requests already in flight; a hard cap would need reservations.
 */
@Injectable()
export class BudgetService {
  readonly dailyBudgetUsd: number | null;
  private readonly demo: DemoConfig;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.dailyBudgetUsd = configService.get('auth', {
      infer: true,
    }).dailyBudgetUsd;
    this.demo = configService.get('demo', { infer: true });
  }

  /** The daily limit that applies to a user; null = unlimited. */
  dailyBudgetFor(isGuest: boolean): number | null {
    return isGuest ? this.demo.guestDailyBudgetUsd : this.dailyBudgetUsd;
  }

  /** Today's spend on the app's provider key. Calls on the user's own keys are billed to them and never count. */
  spentTodayUsd(userId: string): Promise<number> {
    return this.sumToday({ userId, keySource: 'platform' });
  }

  /** Estimated cost of today's calls on the user's own provider keys (informational only). */
  ownKeysSpentTodayUsd(userId: string): Promise<number> {
    return this.sumToday({ userId, keySource: 'user' });
  }

  async assertWithinBudget(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAnonymous: true },
    });
    const isGuest = user?.isAnonymous === true;

    const limit = this.dailyBudgetFor(isGuest);
    if (
      limit !== null &&
      isOverBudget(await this.spentTodayUsd(userId), limit)
    ) {
      throw new BudgetExceededException(limit, isGuest);
    }

    if (isGuest && this.demo.totalDailyBudgetUsd !== null) {
      const allGuests = await this.sumToday({
        keySource: 'platform',
        user: { is: { isAnonymous: true } },
      });
      if (isOverBudget(allGuests, this.demo.totalDailyBudgetUsd)) {
        throw new DemoBudgetExhaustedException();
      }
    }
  }

  private async sumToday(where: Prisma.LlmCallWhereInput): Promise<number> {
    const result = await this.prisma.llmCall.aggregate({
      where: {
        ...where,
        copiedFromId: null,
        createdAt: { gte: startOfUtcDay() },
      },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  }
}
