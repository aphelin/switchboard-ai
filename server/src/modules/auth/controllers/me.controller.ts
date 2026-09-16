import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { BudgetService } from '../services/budget.service';
import { DemoGuestsService } from '../../demo/services/demo-guests.service';
import type { AuthUser } from '../types/auth.types';

@Controller('me')
export class MeController {
  constructor(
    private readonly budget: BudgetService,
    private readonly demoGuests: DemoGuestsService,
  ) {}

  /**
   * The signed-in user and today's AI spend: on the app's key (against the budget)
   * and on their own keys. Guests also get the time their session is deleted.
   */
  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const [spent, ownKeysSpent, guestExpiresAt] = await Promise.all([
      this.budget.spentTodayUsd(user.id),
      this.budget.ownKeysSpentTodayUsd(user.id),
      user.isGuest ? this.demoGuests.expiresAt(user.id) : null,
    ]);
    return {
      user,
      usage: {
        spentTodayUsd: Number(spent.toFixed(6)),
        dailyBudgetUsd: this.budget.dailyBudgetFor(user.isGuest),
        ownKeysSpentTodayUsd: Number(ownKeysSpent.toFixed(6)),
      },
      guest: guestExpiresAt
        ? { expiresAt: guestExpiresAt.toISOString() }
        : null,
    };
  }
}
