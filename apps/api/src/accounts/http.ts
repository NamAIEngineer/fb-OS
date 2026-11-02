import type { AccountService } from "./service";
import type { AccountStatusResult, AccountSyncInput, DailyLimits } from "./types";

export interface AccountHttpRequest {
  ownerId: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface AccountHttpResponse {
  status: number;
  body: unknown;
}

function bodyObject(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Framework-neutral controller; the API scaffold can mount these exact routes. */
export function createAccountsController(service: AccountService) {
  return async (request: AccountHttpRequest): Promise<AccountHttpResponse> => {
    const { ownerId, method, path } = request;
    if (!ownerId.trim()) return { status: 401, body: { error: "AUTH_REQUIRED" } };

    if (method === "GET" && path === "/accounts") {
      const status = request.query?.status as Parameters<typeof service.list>[0]["status"];
      return { status: 200, body: { items: await service.list({ ownerId, status }) } };
    }
    if (method === "POST" && path === "/accounts/sync") {
      const result = await service.sync(ownerId, bodyObject(request.body) as AccountSyncInput);
      return { status: result.receipt.allowed ? 200 : 403, body: result };
    }
    if (method === "POST" && path === "/accounts/reconcile-status") {
      const results = bodyObject(request.body).results;
      const receipt = await service.reconcileStatuses(
        ownerId,
        Array.isArray(results) ? (results as AccountStatusResult[]) : [],
      );
      return { status: 200, body: receipt };
    }
    const limitsMatch = path.match(/^\/accounts\/([^/]+)\/limits$/);
    if (method === "PATCH" && limitsMatch) {
      const account = await service.updateLimits(
        ownerId,
        limitsMatch[1],
        bodyObject(request.body) as Partial<DailyLimits>,
      );
      return account
        ? { status: 200, body: account }
        : { status: 404, body: { error: "ACCOUNT_NOT_FOUND" } };
    }
    const idMatch = path.match(/^\/accounts\/([^/]+)$/);
    if (method === "DELETE" && idMatch) {
      const removed = await service.remove(ownerId, idMatch[1]);
      return removed
        ? { status: 204, body: null }
        : { status: 404, body: { error: "ACCOUNT_NOT_FOUND" } };
    }
    return { status: 404, body: { error: "ROUTE_NOT_FOUND" } };
  };
}
