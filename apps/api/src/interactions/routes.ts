import type { InteractionRequest } from "../../../../packages/shared/contracts-interactions.js";
import { InteractionService } from "./service.js";

export interface InteractionRouteRequest { method: string; path: string; planTier?: "BASIC" | "PLUS" | "PRO"; body?: Record<string, unknown> }
export interface InteractionRouteResponse { status: number; body: unknown }
const json = (status: number, body: unknown): InteractionRouteResponse => ({ status, body });

export async function handleInteractionRequest(request: InteractionRouteRequest, service = new InteractionService()): Promise<InteractionRouteResponse> {
  try {
    if (request.method === "POST" && request.path === "/interactions/run") {
      const run = await service.start(request.body as unknown as InteractionRequest, request.planTier ?? "PRO");
      return json(202, run);
    }
    const parts = request.path.split("/").filter(Boolean);
    if (request.method === "GET" && parts[0] === "interactions" && parts[1] === "runs" && parts[2]) {
      const accountId = String(request.body?.accountId ?? "");
      const run = await service.get(accountId, parts[2]);
      return run ? json(200, run) : json(404, { error: "RUN_NOT_FOUND" });
    }
    if (request.method === "GET" && request.path === "/interactions/runs") {
      return json(200, await service.list(String(request.body?.accountId ?? "")));
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERACTION_ERROR";
    return json(message.startsWith("Gói ") ? 403 : 400, { error: message });
  }
}

export const INTERACTION_ROUTE_RECEIPTS = [
  "POST /interactions/run",
  "GET /interactions/runs",
  "GET /interactions/runs/:id",
] as const;
