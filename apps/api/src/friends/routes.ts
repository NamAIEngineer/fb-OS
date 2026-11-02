import type { FriendRecord, InteractionFilterInput } from "../../../../packages/shared/contracts-interactions.js";
import { FriendsService } from "./service.js";

export interface FriendsRequest { method: string; path: string; accountId: string; body?: Record<string, unknown>; query?: Record<string, string | undefined> }
export interface FriendsResponse { status: number; body: unknown }
const json = (status: number, body: unknown): FriendsResponse => ({ status, body });

export async function handleFriendsRequest(request: FriendsRequest, service = new FriendsService()): Promise<FriendsResponse> {
  try {
    if (request.method === "GET" && request.path === "/interactions/friends") {
      const filter = request.query?.filter as InteractionFilterInput["filter"] | undefined;
      const since = request.query?.since;
      return json(200, await service.filter(request.accountId, filter ? { filter, since } : undefined));
    }
    if (request.method === "POST" && request.path === "/interactions/friends/sync") {
      return json(200, await service.sync(request.accountId, (request.body?.friends ?? []) as FriendRecord[]));
    }
    if (request.method === "GET" && request.path === "/friend-collections") return json(200, await service.listCollections(request.accountId));
    if (request.method === "POST" && request.path === "/friend-collections") {
      return json(200, await service.saveCollection(request.accountId, String(request.body?.name ?? ""), (request.body?.friendIds ?? []) as string[], request.body?.id as string | undefined));
    }
    if (request.method === "DELETE" && request.path.startsWith("/friend-collections/")) {
      await service.deleteCollection(request.accountId, request.path.split("/").at(-1) as string);
      return json(204, null);
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FRIENDS_ERROR";
    return json(message.endsWith("_NOT_FOUND") ? 404 : 400, { error: message });
  }
}

export const FRIEND_ROUTE_RECEIPTS = [
  "GET /interactions/friends",
  "POST /interactions/friends/sync",
  "GET /friend-collections",
  "POST /friend-collections",
  "DELETE /friend-collections/:id",
] as const;
