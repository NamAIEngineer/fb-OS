import type { AutoCommentPost, AutoCommentScanRequest, AutoCommentScriptInput } from "../../../../packages/shared/contracts-interactions.js";
import { AutoCommentService, createAutoCommentService } from "./service.js";

export interface AutoCommentRequest {
  method: string;
  path: string;
  accountId: string;
  planTier?: "BASIC" | "PLUS" | "PRO";
  body?: Record<string, unknown>;
  query?: Record<string, string | undefined>;
}

export interface AutoCommentResponse { status: number; body: unknown }

const json = (status: number, body: unknown): AutoCommentResponse => ({ status, body });
const payload = (body: Record<string, unknown>): AutoCommentScriptInput => ({
  name: String(body.name ?? ""),
  keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [],
  tabContents: Array.isArray(body.tabContents) ? body.tabContents as AutoCommentScriptInput["tabContents"] : [],
});

/** Mount in Express or call directly from mock E2E; no external calls occur. */
export async function handleAutoCommentRequest(
  request: AutoCommentRequest,
  service: AutoCommentService = createAutoCommentService(),
): Promise<AutoCommentResponse> {
  try {
    const body = request.body ?? {};
    const planTier = request.planTier ?? "PRO";
    const scriptPath = request.path.startsWith("/auto-comment-script-templates") || request.path.startsWith("/auto-comment/scripts");
    if (request.method === "GET" && scriptPath) return json(200, await service.listScripts(request.accountId, request.query?.search));
    if (request.method === "POST" && (request.path === "/auto-comment-script-templates" || request.path === "/auto-comment/scripts")) {
      return json(201, await service.createScript(request.accountId, payload(body), planTier));
    }
    const parts = request.path.split("/").filter(Boolean);
    const scriptId = parts.at(-1);
    if (scriptId && request.method === "PATCH" && scriptPath && !request.path.endsWith("/name")) {
      return json(200, await service.updateScript(request.accountId, scriptId, payload(body), planTier));
    }
    if (scriptId && request.method === "PATCH" && request.path.endsWith("/name")) {
      return json(200, await service.renameScript(request.accountId, parts.at(-2) as string, String(body.name ?? ""), planTier));
    }
    if (scriptId && request.method === "DELETE" && scriptPath) {
      await service.deleteScript(request.accountId, scriptId, planTier);
      return json(204, null);
    }
    if (request.method === "POST" && request.path === "/auto-comment/scan") {
      const scan = body.request as AutoCommentScanRequest;
      const posts = (body.posts ?? []) as AutoCommentPost[];
      return json(202, await service.scan(scan, posts, planTier));
    }
    if (request.method === "GET" && request.path === "/auto-comment/receipts") {
      return json(200, await service.receipts(request.accountId));
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AUTO_COMMENT_ERROR";
    return json(message.startsWith("Gói ") ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 400, { error: message });
  }
}

export const AUTO_COMMENT_ROUTE_RECEIPTS = [
  "GET /auto-comment-script-templates",
  "POST /auto-comment-script-templates",
  "PATCH /auto-comment-script-templates/:id",
  "PATCH /auto-comment-script-templates/:id/name",
  "DELETE /auto-comment-script-templates/:id",
  "POST /auto-comment/scan",
  "GET /auto-comment/receipts",
] as const;
