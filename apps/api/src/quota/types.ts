import type { DailyLimits, DailyQuotaKind } from "../accounts/types";

export interface DailyUsage {
  ownerId: string;
  accountId: string;
  date: string;
  counts: Record<DailyQuotaKind, number>;
  limits: DailyLimits;
}

export interface QuotaReservation {
  allowed: boolean;
  ownerId: string;
  accountId: string;
  kind: DailyQuotaKind;
  date: string;
  used: number;
  limit: number;
  remaining: number;
  reason?: "DAILY_QUOTA_REACHED";
}

export interface UsageQuery {
  ownerId: string;
  accountId?: string;
  date?: string;
}

export interface UsageStore {
  today(ownerId: string, date?: string): Promise<DailyUsage[]>;
  usage(ownerId: string, accountId: string, date?: string): Promise<DailyUsage>;
  reserve(
    ownerId: string,
    accountId: string,
    kind: DailyQuotaKind,
    limit: number,
    date?: string,
  ): Promise<QuotaReservation>;
  setLimits(ownerId: string, accountId: string, limits: DailyLimits): Promise<void>;
}
