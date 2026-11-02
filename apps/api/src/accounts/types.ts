/**
 * Account contracts. These models intentionally contain identity and status
 * metadata only. Session cookies, browser storage, and other credentials never
 * cross this boundary or enter product persistence.
 */

export type PlanTier = "BASIC" | "PLUS" | "PRO" | "MAX";

export type AccountConnectionStatus =
  | "active"
  | "disconnected"
  | "pending"
  | "unknown";

export type DailyQuotaKind =
  | "post"
  | "comment"
  | "message"
  | "addFriend"
  | "interact"
  | "joinGroup";

export type DailyLimits = Record<DailyQuotaKind, number>;

export interface AccountIdentity {
  /** Facebook UID as reported by the app-owned browser profile. */
  uid: string;
  name: string;
  avatar?: string | null;
  profileInstanceId?: string | null;
}

export interface AccountRecord extends AccountIdentity {
  id: string;
  ownerId: string;
  status: AccountConnectionStatus;
  lastSyncedAt: string | null;
  lastReconciledAt: string | null;
  dailyLimits: DailyLimits;
  meta: {
    groups?: number;
    friends?: number;
    requestedFriends?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AccountSyncInput extends AccountIdentity {
  status?: AccountConnectionStatus;
  meta?: AccountRecord["meta"];
}

export interface AccountStatusResult {
  uid: string;
  valid: boolean;
  status?: AccountConnectionStatus;
  name?: string;
  avatar?: string | null;
  reason?: string | null;
}

export interface AccountListQuery {
  ownerId: string;
  status?: AccountConnectionStatus;
}

export interface AccountRepository {
  list(query: AccountListQuery): Promise<AccountRecord[]>;
  findById(ownerId: string, id: string): Promise<AccountRecord | null>;
  findByUid(ownerId: string, uid: string): Promise<AccountRecord | null>;
  count(ownerId: string): Promise<number>;
  save(account: AccountRecord): Promise<AccountRecord>;
  remove(ownerId: string, id: string): Promise<boolean>;
}

export interface AccountPlan {
  tier: PlanTier;
  maxAccounts: number;
}

export interface AccountGateReceipt {
  allowed: boolean;
  code:
    | "ACCOUNT_SYNCED"
    | "ACCOUNT_UPDATED"
    | "ACCOUNT_LIMIT_REACHED"
    | "INVALID_ACCOUNT_IDENTITY"
    | "ACCOUNT_NOT_FOUND";
  ownerId: string;
  accountId: string | null;
  currentCount: number;
  maxAccounts: number;
  plan: PlanTier;
}

export interface AccountStatusReceipt {
  ownerId: string;
  updated: number;
  missing: string[];
  results: AccountRecord[];
}

export const DEFAULT_DAILY_LIMITS: Readonly<DailyLimits> = Object.freeze({
  post: 25,
  comment: 100,
  message: 20,
  addFriend: 20,
  interact: 200,
  joinGroup: 50,
});

export const PLAN_ACCOUNT_LIMITS: Readonly<Record<PlanTier, number>> =
  Object.freeze({ BASIC: 3, PLUS: 5, PRO: 5, MAX: 10 });

export function accountPlan(tier: PlanTier): AccountPlan {
  return { tier, maxAccounts: PLAN_ACCOUNT_LIMITS[tier] };
}
