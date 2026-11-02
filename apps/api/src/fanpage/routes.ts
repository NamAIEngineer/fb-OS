import type { AutoCommentScript, PageCommentRequest } from "../../../../packages/shared/contracts-interactions.js";
import { FanpageService, createFanpageService } from "./service.js";

export interface FanpageRequest {
  method: string;
  path: string;
  planTier?: "BASIC" | "PLUS" | "PRO";
  body?: Record<string, unknown>;
}

export interface FanpageResponse { status: number; body: unknown }
const json = (status: number, body: unknown): FanpageResponse => ({ status, body });

export async function handleFanpageRequest(
  request: FanpageRequest,
  service: FanpageService = createFanpageService(),
): Promise<FanpageResponse> {
  try {
    const body = request.body ?? {};
    const parts = request.path.split("/").filter(Boolean);
    const accountId = String(body.accountId ?? "");
    const planTier = request.planTier ?? "PRO";
    if (request.method === "GET" && parts[0] === "pages" && parts[2] === "comments") {
      return json(200, await service.listComments(accountId, parts[1] as string));
    }
    if (request.method === "POST" && request.path === "/pages/comments/interact") {
      return json(202, await service.interact(body.request as PageCommentRequest, (body.scripts ?? []) as AutoCommentScript[], planTier));
    }
    if (request.method === "POST" && request.path === "/pages/comments/keyword-script") {
      const comments = (body.comments ?? []) as Awaited<ReturnType<FanpageService["listComments"]>>;
      return json(202, await service.runKeywordScript(
        accountId,
        String(body.pageId ?? ""),
        body.action === "like" ? "like" : "reply",
        comments,
        (body.scripts ?? []) as AutoCommentScript[],
        planTier,
      ));
    }
    if (request.method === "GET" && parts[0] === "pages" && parts[2] === "receipts") {
      return json(200, await service.receipts(accountId, parts[1]));
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FANPAGE_ERROR";
    return json(message.startsWith("Gói ") ? 403 : 400, { error: message });
  }
}

export const FANPAGE_ROUTE_RECEIPTS = [
  "GET /pages/:pageId/comments",
  "POST /pages/comments/interact",
  "POST /pages/comments/keyword-script",
  "GET /pages/:pageId/receipts",
] as const;
