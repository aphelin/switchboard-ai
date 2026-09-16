/** What the landing page needs to offer (or hide) the one-click demo. */
export interface DemoStatus {
  enabled: boolean;
  guestTtlHours: number;
  guestDailyBudgetUsd: number | null;
}

/** Why a guest session can't be opened right now; mapped to a Better Auth APIError. */
export interface GuestBlock {
  status: 'FORBIDDEN' | 'TOO_MANY_REQUESTS';
  message: string;
}

export interface CopiedCounts {
  generations: number;
  documents: number;
  conversations: number;
  llmCalls: number;
}
