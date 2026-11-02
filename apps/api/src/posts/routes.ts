import type { PostTemplateDraft, PostExecutor } from "../../../../packages/shared/contracts-post.js";
import { PostService, PostServiceError } from "./post-service.js";

export interface PostRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

export interface PostResponse {
  status: number;
  body: unknown;
}

/**
 * Framework-neutral /post API. The shell worker can mount this on Express,
 * Fastify, or Node's native HTTP server without duplicating persistence rules.
 */
export function createPostRoutes(service: PostService, executor: PostExecutor) {
  return async function handle(request: PostRequest): Promise<PostResponse> {
    try {
      const path = request.path.replace(/\/+$/, "") || "/";
      const method = request.method.toUpperCase();
      if (method === "GET" && path === "/api/posts/drafts") {
        return { status: 200, body: { items: await service.listDrafts(request.query?.accountId) } };
      }
      if (method === "POST" && path === "/api/posts/drafts") {
        return { status: 201, body: await service.saveDraft(assertObject(request.body)) };
      }
      const draftMatch = path.match(/^\/api\/posts\/drafts\/([^/]+)$/);
      if (draftMatch && method === "GET") {
        const draft = await service.getDraft(decodeURIComponent(draftMatch[1]));
        return draft ? { status: 200, body: draft } : { status: 404, body: { error: "DRAFT_NOT_FOUND" } };
      }
      if (draftMatch && method === "PUT") {
        return { status: 200, body: await service.saveDraft({ ...assertObject(request.body), id: decodeURIComponent(draftMatch[1]) }) };
      }
      if (draftMatch && method === "DELETE") {
        await service.deleteDraft(decodeURIComponent(draftMatch[1]));
        return { status: 204, body: null };
      }
      if (method === "GET" && path === "/api/post-templates") {
        return { status: 200, body: { items: await service.listTemplates(request.query?.search) } };
      }
      if (method === "POST" && path === "/api/post-templates/upsert") {
        const body = assertObject(request.body);
        return { status: 201, body: await service.saveTemplate({ id: asOptionalString(body.id), name: asString(body.name), draft: body.draft as PostTemplateDraft }) };
      }
      const templateMatch = path.match(/^\/api\/post-templates\/([^/]+)$/);
      if (templateMatch && method === "PATCH") {
        return { status: 200, body: await service.renameTemplate(decodeURIComponent(templateMatch[1]), asString(assertObject(request.body).name)) };
      }
      if (templateMatch && method === "DELETE") {
        await service.deleteTemplate(decodeURIComponent(templateMatch[1]));
        return { status: 204, body: null };
      }
      if (method === "POST" && path === "/api/posts/start") {
        const body = assertObject(request.body);
        const job = await service.startJob(asString(body.draftId), executor, {
          groupIds: asStringArray(body.groupIds),
          accountId: asOptionalString(body.accountId),
          maxItems: typeof body.maxItems === "number" ? body.maxItems : undefined,
        });
        return { status: 201, body: job };
      }
      if (method === "GET" && path === "/api/posts/jobs") {
        return { status: 200, body: { items: await service.listJobs() } };
      }
      if (method === "GET" && path === "/api/posts/media") {
        return { status: 200, body: { items: await service.listMedia() } };
      }
      if (method === "POST" && path === "/api/posts/media") {
        return { status: 201, body: await service.saveMedia(assertObject(request.body) as never) };
      }
      if (method === "GET" && path === "/api/posts/receipt") {
        return { status: 200, body: await service.receipt() };
      }
      return { status: 404, body: { error: "POST_ROUTE_NOT_FOUND" } };
    } catch (error) {
      if (error instanceof PostServiceError) {
        return { status: error.statusCode, body: { errors: error.errors } };
      }
      return { status: 500, body: { error: error instanceof Error ? error.message : "POST_ROUTE_ERROR" } };
    }
  };
}

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PostServiceError(400, [{ code: "BODY_OBJECT_REQUIRED", message: "Request body phải là object" }]);
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}
