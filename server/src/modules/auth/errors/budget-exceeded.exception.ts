import { HttpException, HttpStatus } from '@nestjs/common';

export class BudgetExceededException extends HttpException {
  constructor(dailyBudgetUsd: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Budget Exceeded',
        message: `Daily AI budget of $${dailyBudgetUsd.toFixed(2)} reached. It resets at midnight UTC.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
