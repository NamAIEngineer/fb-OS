import type { AccountRepository } from "../accounts/types";
import type { DailyQuotaKind } from "../accounts/types";
import { DEFAULT_DAILY_LIMITS } from "../accounts/types";
import type { UsageStore } from "./types";

export interface UsageHttpRequest {
  ownerId: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

export interface UsageHttpResponse {
  status: number;
  body: unknown;
}

function objectBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Framework-neutral daily usage routes mirrored from the captured bundle. */
export function createUsageController(
  usage: UsageStore,
  accounts?: AccountRepository,
) {
  return async (request: UsageHttpRequest): Promise<UsageHttpResponse> => {
    if (!request.ownerId.trim()) return { status: 401, body: { error: "AUTH_REQUIRED" } };
    if (request.method === "GET" && request.path === "/accounts/daily-usage/today") {
      return {
        status: 200,
        body: {
          date: new Date().toISOString().slice(0, 10),
          items: await usage.today(request.ownerId),
        },
      };
    }
    if (request.method === "POST" && request.path === "/accounts/daily-usage/increment") {
      const body = objectBody(request.body);
      const accountId = typeof body.accountId === "string" ? body.accountId : "";
      const kind = typeof body.type === "string" ? (body.type as DailyQuotaKind) : "post";
      if (!accountId || !(kind in DEFAULT_DAILY_LIMITS)) {
        return { status: 400, body: { error: "INVALID_USAGE_REQUEST" } };
      }
      const account = accounts ? await accounts.findById(request.ownerId, accountId) : null;
      const limit = account?.dailyLimits[kind] ?? DEFAULT_DAILY_LIMITS[kind];
      const receipt = await usage.reserve(request.ownerId, accountId, kind, limit);
      return { status: receipt.allowed ? 200 : 429, body: receipt };
    }
    return { status: 404, body: { error: "ROUTE_NOT_FOUND" } };
  };
}
