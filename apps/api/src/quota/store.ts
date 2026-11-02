import { DEFAULT_DAILY_LIMITS, type DailyLimits, type DailyQuotaKind } from "../accounts/types";
import type { DailyUsage, QuotaReservation, UsageStore } from "./types";

const QUOTA_KINDS: DailyQuotaKind[] = [
  "post",
  "comment",
  "message",
  "addFriend",
  "interact",
  "joinGroup",
];

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function cloneUsage(row: DailyUsage): DailyUsage {
  return { ...row, counts: { ...row.counts }, limits: { ...row.limits } };
}

export class InMemoryUsageStore implements UsageStore {
  private readonly rows = new Map<string, DailyUsage>();

  private key(ownerId: string, accountId: string, date: string): string {
    return `${ownerId}:${accountId}:${date}`;
  }

  private getOrCreate(ownerId: string, accountId: string, date: string): DailyUsage {
    const key = this.key(ownerId, accountId, date);
    let row = this.rows.get(key);
    if (!row) {
      row = {
        ownerId,
        accountId,
        date,
        counts: Object.fromEntries(QUOTA_KINDS.map((kind) => [kind, 0])) as DailyUsage["counts"],
        limits: { ...DEFAULT_DAILY_LIMITS },
      };
      this.rows.set(key, row);
    }
    return row;
  }

  async today(ownerId: string, date = dayKey()): Promise<DailyUsage[]> {
    return [...this.rows.values()]
      .filter((row) => row.ownerId === ownerId && row.date === date)
      .map(cloneUsage);
  }

  async usage(ownerId: string, accountId: string, date = dayKey()): Promise<DailyUsage> {
    return cloneUsage(this.getOrCreate(ownerId, accountId, date));
  }

  async reserve(
    ownerId: string,
    accountId: string,
    kind: DailyQuotaKind,
    limit: number,
    date = dayKey(),
  ): Promise<QuotaReservation> {
    const row = this.getOrCreate(ownerId, accountId, date);
    row.limits[kind] = Math.max(0, Math.floor(limit));
    const used = row.counts[kind];
    if (used >= row.limits[kind]) {
      return {
        allowed: false,
        ownerId,
        accountId,
        kind,
        date,
        used,
        limit: row.limits[kind],
        remaining: 0,
        reason: "DAILY_QUOTA_REACHED",
      };
    }
    row.counts[kind] = used + 1;
    return {
      allowed: true,
      ownerId,
      accountId,
      kind,
      date,
      used: used + 1,
      limit: row.limits[kind],
      remaining: row.limits[kind] - used - 1,
    };
  }

  async setLimits(ownerId: string, accountId: string, limits: DailyLimits): Promise<void> {
    for (const [date, row] of this.rows) {
      if (row.ownerId === ownerId && row.accountId === accountId) {
        row.limits = { ...limits };
        this.rows.set(date, row);
      }
    }
    // Ensure a newly configured account has a row for today's usage.
    const row = this.getOrCreate(ownerId, accountId, dayKey());
    row.limits = { ...limits };
  }
}

export { dayKey };
