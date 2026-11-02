import { createCampaignService, CampaignService } from "./service.js";
import type { CampaignContext, CampaignDeleteFilter, CampaignStatus } from "./types.js";

export interface CampaignRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | undefined>;
  context: CampaignContext;
}

export interface CampaignResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

const json = (status: number, body: unknown): CampaignResponse => ({ status, body });

/** Framework-neutral route adapter. Mount this table in Express, Fastify, or the test harness. */
export async function handleCampaignRequest(
  request: CampaignRequest,
  service: CampaignService = createCampaignService(),
): Promise<CampaignResponse> {
  try {
    const { method, path, body = {}, query = {}, context } = request;
    if (method === "GET" && ["/pending", "/fulfilled", "/rejected"].includes(path)) {
      return json(200, await service.listPosts(context, path.slice(1) as CampaignStatus));
    }
    if (method === "GET" && path === "/campaigns") {
      return json(200, await service.listPosts(context, query.status as CampaignStatus | undefined));
    }
    if (method === "POST" && path.startsWith("/campaigns/") && path.endsWith("/save")) {
      return json(200, await service.savePost(context, path.split("/")[2], body.saved !== false));
    }
    if (method === "PATCH" && path.startsWith("/campaigns/") && path.endsWith("/status")) {
      return json(200, await service.updateStatus(context, path.split("/")[2], body.status as CampaignStatus, body.reason as string | undefined));
    }
    if (method === "DELETE" && path === "/campaigns") {
      return json(200, await service.deletePosts(context, (body.filter ?? "all") as CampaignDeleteFilter));
    }
    if (method === "POST" && path.startsWith("/bump/")) {
      return json(202, await service.bump(context, path.split("/")[2], Number(body.upCount ?? 1)));
    }
    if (method === "POST" && path.startsWith("/comment-outreach/")) {
      return json(202, await service.commentOutreach(context, path.split("/")[2], String(body.text ?? "")));
    }
    if (method === "POST" && path.startsWith("/share-link/")) {
      return json(202, await service.shareLink(context, path.split("/")[2], String(body.url ?? "")));
    }
    if (method === "POST" && path.startsWith("/profile-post-share/")) {
      return json(202, await service.shareProfilePostToGroup(context, path.split("/")[2], String(body.groupId ?? "")));
    }
    if (method === "GET" && path === "/group-stats") {
      return json(200, await service.listGroupStats(context, query.q ?? ""));
    }
    if (method === "POST" && path === "/group-stats") {
      return json(200, await service.recordGroupStats(context, body as never));
    }
    if (method === "GET" && path === "/group-collections") {
      return json(200, await service.listCollections(context));
    }
    if (method === "POST" && path === "/group-collections") {
      return json(200, await service.saveCollection(context, body as { id?: string; name: string; groupIds: string[] }));
    }
    if (method === "GET" && path === "/reports/campaigns") {
      const format = query.format === "json" ? "json" : "csv";
      const report = await service.report(context, format);
      return { status: 200, headers: { "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json" }, body: report };
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CAMPAIGN_ERROR";
    const status = message.startsWith("PLAN_REQUIRED") ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 400;
    return json(status, { error: message });
  }
}

export const CAMPAIGN_ROUTE_RECEIPTS = [
  "GET /pending", "GET /fulfilled", "GET /rejected", "POST /campaigns/:id/save", "DELETE /campaigns",
  "POST /bump/:id", "POST /comment-outreach/:id", "POST /share-link/:id", "POST /profile-post-share/:id",
  "GET /group-stats", "GET /group-collections", "POST /group-collections", "GET /reports/campaigns",
] as const;
