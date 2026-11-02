import type {
  AddToCollectionInput,
  BatchLeaveInput,
  GroupLibraryFilters,
  GroupServiceContext,
  JoinGroupInput,
  LeaveAfterPostToggle,
  LeaveGroupInput,
} from "../../../../packages/shared/contracts-groups.js";
import { GroupService } from "./service.js";

export interface GroupHttpRequest {
  ownerId: string;
  plan: GroupServiceContext["plan"];
  liveGate?: GroupServiceContext["liveGate"];
  method: "GET" | "POST" | "PUT";
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface GroupHttpResponse {
  status: number;
  body: unknown;
}

function objectBody(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

function asBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function filters(query: Record<string, string | undefined> | undefined): GroupLibraryFilters {
  const input = query ?? {};
  const number = (value: string | undefined): number | undefined => {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    keyword: input.keyword,
    topic: input.topic,
    minMembers: number(input.minMembers),
    maxMembers: number(input.maxMembers),
    minPostsPerDay: number(input.minPostsPerDay),
    maxPostsPerDay: number(input.maxPostsPerDay),
    approvalRequired: asBoolean(input.approvalRequired),
    collectionId: input.collectionId,
  };
}

function context(request: GroupHttpRequest): GroupServiceContext {
  if (!request.ownerId.trim()) throw new Error("AUTH_REQUIRED");
  return { userId: request.ownerId, plan: request.plan, liveGate: request.liveGate };
}

/**
 * Framework-neutral HTTP controller. The lead can mount it under `/api` in
 * the existing Express server without widening this worker's ownership.
 */
export function createGroupController(service: GroupService) {
  return async (request: GroupHttpRequest): Promise<GroupHttpResponse> => {
    try {
      const serviceContext = context(request);
      const body = objectBody(request.body);
      if (request.method === "GET" && request.path === "/groups/library") {
        return { status: 200, body: { items: service.listLibrary(serviceContext, filters(request.query)) } };
      }
      if (request.method === "POST" && request.path === "/groups/join") {
        return { status: 201, body: await service.join(serviceContext, body as unknown as JoinGroupInput) };
      }
      if (request.method === "POST" && request.path === "/groups/leave") {
        return { status: 200, body: await service.leave(serviceContext, body as unknown as LeaveGroupInput) };
      }
      if (request.method === "POST" && request.path === "/groups/leave/batch") {
        return { status: 200, body: await service.batchLeave(serviceContext, body as unknown as BatchLeaveInput) };
      }
      if (request.method === "GET" && request.path === "/groups/collections") {
        return { status: 200, body: { items: service.listCollections(serviceContext) } };
      }
      if (request.method === "POST" && request.path === "/groups/collections") {
        return { status: 201, body: await service.addToCollection(serviceContext, body as unknown as AddToCollectionInput) };
      }

      const leaveToggle = request.path.match(/^\/groups\/([^/]+)\/leave-after-post$/);
      if (request.method === "PUT" && leaveToggle) {
        return { status: 200, body: await service.setLeaveAfterPost(serviceContext, { groupId: leaveToggle[1], enabled: Boolean(asBoolean(body.enabled) ?? body.enabled) } satisfies LeaveAfterPostToggle) };
      }

      const pending = request.path.match(/^\/groups\/([^/]+)\/pending-members$/);
      if (request.method === "GET" && pending) {
        return { status: 200, body: { items: service.listPending(serviceContext, pending[1]) } };
      }

      const autoApprove = request.path.match(/^\/groups\/([^/]+)\/auto-approve$/);
      if (request.method === "PUT" && autoApprove) {
        return { status: 200, body: await service.configureAutoApprove(serviceContext, { groupId: autoApprove[1], enabled: Boolean(asBoolean(body.enabled) ?? body.enabled), approveSuspectedSpam: Boolean(asBoolean(body.approveSuspectedSpam) ?? body.approveSuspectedSpam) }) };
      }

      const runAutoApprove = request.path.match(/^\/groups\/([^/]+)\/auto-approve\/run$/);
      if (request.method === "POST" && runAutoApprove) {
        return { status: 200, body: await service.runAutoApprove(serviceContext, String(body.accountId ?? ""), runAutoApprove[1]) };
      }

      const invites = request.path.match(/^\/groups\/([^/]+)\/invite-new-members$/);
      if (request.method === "POST" && invites) {
        return { status: 200, body: await service.inviteNewMembers(serviceContext, String(body.accountId ?? ""), invites[1], Number(body.count ?? 0)) };
      }
      return { status: 404, body: { error: "ROUTE_NOT_FOUND" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "GROUP_REQUEST_FAILED";
      const status = message === "AUTH_REQUIRED" ? 401 : message.startsWith("PLAN_REQUIRED") ? 403 : message.startsWith("LIVE_GATE_REQUIRED") ? 409 : 400;
      return { status, body: { error: message } };
    }
  };
}

