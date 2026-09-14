import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { BudgetService } from '../services/budget.service';
import type { AuthUser } from '../types/auth.types';

@Controller('me')
export class MeController {
  constructor(private readonly budget: BudgetService) {}

  /** The signed-in user and today's AI spend: on the app's key (against the budget) and on their own keys. */
  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const [spent, ownKeysSpent] = await Promise.all([
      this.budget.spentTodayUsd(user.id),
      this.budget.ownKeysSpentTodayUsd(user.id),
    ]);
    return {
      user,
      usage: {
        spentTodayUsd: Number(spent.toFixed(6)),
        dailyBudgetUsd: this.budget.dailyBudgetUsd,
        ownKeysSpentTodayUsd: Number(ownKeysSpent.toFixed(6)),
      },
    };
  }
}
