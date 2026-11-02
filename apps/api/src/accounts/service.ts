import {
  accountPlan,
  DEFAULT_DAILY_LIMITS,
  type AccountGateReceipt,
  type AccountPlan,
  type AccountRecord,
  type AccountRepository,
  type AccountStatusReceipt,
  type AccountStatusResult,
  type AccountSyncInput,
  type AccountListQuery,
  type DailyLimits,
  type PlanTier,
} from "./types";

export interface AccountServiceOptions {
  now?: () => Date;
  id?: () => string;
  planForOwner?: (ownerId: string) => Promise<AccountPlan>;
}

function cleanIdentity(input: AccountSyncInput): AccountSyncInput | null {
  const uid = input.uid.trim();
  const name = input.name.trim();
  if (!uid || !name || uid.length > 128 || name.length > 240) return null;
  return {
    uid,
    name,
    avatar: input.avatar?.trim() || null,
    profileInstanceId: input.profileInstanceId?.trim() || null,
    status: input.status ?? "active",
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

function iso(now: () => Date): string {
  return now().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `account_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class AccountService {
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly planForOwner: (ownerId: string) => Promise<AccountPlan>;

  constructor(
    private readonly repository: AccountRepository,
    options: AccountServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? createId;
    this.planForOwner =
      options.planForOwner ?? (async () => accountPlan("BASIC"));
  }

  async list(query: AccountListQuery): Promise<AccountRecord[]> {
    return this.repository.list(query);
  }

  async sync(ownerId: string, input: AccountSyncInput): Promise<{
    account: AccountRecord | null;
    receipt: AccountGateReceipt;
  }> {
    const plan = await this.planForOwner(ownerId);
    const clean = cleanIdentity(input);
    const baseReceipt = {
      ownerId,
      accountId: null,
      currentCount: await this.repository.count(ownerId),
      maxAccounts: plan.maxAccounts,
      plan: plan.tier,
    } satisfies Omit<AccountGateReceipt, "allowed" | "code">;

    if (!clean) {
      return {
        account: null,
        receipt: { ...baseReceipt, allowed: false, code: "INVALID_ACCOUNT_IDENTITY" },
      };
    }

    const existing = await this.repository.findByUid(ownerId, clean.uid);
    const now = iso(this.now);
    if (existing) {
      const updated: AccountRecord = {
        ...existing,
        name: clean.name,
        avatar: clean.avatar,
        profileInstanceId: clean.profileInstanceId,
        status: clean.status ?? existing.status,
        lastSyncedAt: now,
        updatedAt: now,
        meta: { ...existing.meta, ...(clean.meta ?? {}) },
      };
      await this.repository.save(updated);
      return {
        account: updated,
        receipt: {
          ...baseReceipt,
          allowed: true,
          code: "ACCOUNT_UPDATED",
          accountId: updated.id,
        },
      };
    }

    if (baseReceipt.currentCount >= plan.maxAccounts) {
      return {
        account: null,
        receipt: { ...baseReceipt, allowed: false, code: "ACCOUNT_LIMIT_REACHED" },
      };
    }

    const account: AccountRecord = {
      id: this.id(),
      ownerId,
      uid: clean.uid,
      name: clean.name,
      avatar: clean.avatar,
      profileInstanceId: clean.profileInstanceId,
      status: clean.status ?? "active",
      lastSyncedAt: now,
      lastReconciledAt: null,
      dailyLimits: { ...DEFAULT_DAILY_LIMITS },
      meta: { ...(clean.meta ?? {}) },
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.save(account);
    return {
      account,
      receipt: {
        ...baseReceipt,
        allowed: true,
        code: "ACCOUNT_SYNCED",
        accountId: account.id,
        currentCount: baseReceipt.currentCount + 1,
      },
    };
  }

  async reconcileStatuses(
    ownerId: string,
    results: AccountStatusResult[],
  ): Promise<AccountStatusReceipt> {
    const now = iso(this.now);
    const updated: AccountRecord[] = [];
    const missing: string[] = [];
    for (const result of results) {
      const row = await this.repository.findByUid(ownerId, result.uid.trim());
      if (!row) {
        missing.push(result.uid);
        continue;
      }
      const next: AccountRecord = {
        ...row,
        name: result.name?.trim() || row.name,
        avatar: result.avatar?.trim() || row.avatar,
        status: result.valid ? result.status ?? "active" : "disconnected",
        lastReconciledAt: now,
        updatedAt: now,
      };
      await this.repository.save(next);
      updated.push(next);
    }
    return { ownerId, updated: updated.length, missing, results: updated };
  }

  async updateLimits(
    ownerId: string,
    accountId: string,
    limits: Partial<DailyLimits>,
  ): Promise<AccountRecord | null> {
    const row = await this.repository.findById(ownerId, accountId);
    if (!row) return null;
    const dailyLimits = { ...row.dailyLimits };
    for (const [key, value] of Object.entries(limits)) {
      if (key in dailyLimits && Number.isFinite(value) && Number(value) >= 0) {
        dailyLimits[key as keyof DailyLimits] = Math.floor(Number(value));
      }
    }
    const updated = { ...row, dailyLimits, updatedAt: iso(this.now) };
    return this.repository.save(updated);
  }

  async remove(ownerId: string, accountId: string): Promise<boolean> {
    return this.repository.remove(ownerId, accountId);
  }

  static plan(tier: PlanTier): AccountPlan {
    return accountPlan(tier);
  }
}
