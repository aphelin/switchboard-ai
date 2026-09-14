import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { BudgetExceededException } from '../errors/budget-exceeded.exception';
import { isOverBudget, startOfUtcDay } from '../utils/budget';
import type { AppConfiguration } from '../../../config/configuration.interface';

/**
 * Per-user daily AI spending limit, computed from the LlmCall traces.
 * Sign-up is open, so this is what protects the provider balance.
 *
 * The check runs before a costly call starts, so a user can overshoot by the
 * cost of the requests already in flight; a hard cap would need reservations.
 */
@Injectable()
export class BudgetService {
  readonly dailyBudgetUsd: number | null;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.dailyBudgetUsd = configService.get('auth', {
      infer: true,
    }).dailyBudgetUsd;
  }

  async spentTodayUsd(userId: string): Promise<number> {
    const result = await this.prisma.llmCall.aggregate({
      where: { userId, createdAt: { gte: startOfUtcDay() } },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  }

  async assertWithinBudget(userId: string): Promise<void> {
    if (this.dailyBudgetUsd === null) return;
    const spent = await this.spentTodayUsd(userId);
    if (isOverBudget(spent, this.dailyBudgetUsd)) {
      throw new BudgetExceededException(this.dailyBudgetUsd);
    }
  }
}
