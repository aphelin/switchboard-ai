/** Budgets reset at midnight UTC so the limit means the same thing for every user. */
export const startOfUtcDay = (now: Date = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const isOverBudget = (
  spentUsd: number,
  dailyBudgetUsd: number | null,
): boolean => dailyBudgetUsd !== null && spentUsd >= dailyBudgetUsd;
