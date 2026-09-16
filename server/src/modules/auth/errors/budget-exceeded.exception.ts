import { HttpException, HttpStatus } from '@nestjs/common';

export class BudgetExceededException extends HttpException {
  constructor(dailyBudgetUsd: number, isGuest = false) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Budget Exceeded',
        message: isGuest
          ? `This demo session has used its $${dailyBudgetUsd.toFixed(2)} of free models for today. Create an account to keep going.`
          : `Daily AI budget of $${dailyBudgetUsd.toFixed(2)} reached. It resets at midnight UTC.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** All guests together reached DEMO_TOTAL_DAILY_BUDGET_USD: the shared platform key is protected. */
export class DemoBudgetExhaustedException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Budget Exceeded',
        message:
          "Demo sessions have used today's shared budget for free models. Create an account to keep going, or try again after midnight UTC.",
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
