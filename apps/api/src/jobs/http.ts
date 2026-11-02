import type { JobDefinition } from "./types";
import type { JobRunner } from "../runner";

export interface JobHttpRequest {
  ownerId: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

export interface JobHttpResponse {
  status: number;
  body: unknown;
}

function objectBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** REST adapter for the runner. Socket consumers subscribe through JobEventSink. */
export function createJobsController(runner: JobRunner) {
  return async (request: JobHttpRequest): Promise<JobHttpResponse> => {
    if (!request.ownerId.trim()) return { status: 401, body: { error: "AUTH_REQUIRED" } };
    if (request.method === "POST" && request.path === "/jobs") {
      const body = objectBody(request.body);
      const result = await runner.start({
        ...(body as unknown as Omit<JobDefinition, "id">),
        ownerId: request.ownerId,
        actions: Array.isArray(body.actions) ? (body.actions as JobDefinition["actions"]) : [],
        interval:
          body.interval && typeof body.interval === "object"
            ? (body.interval as JobDefinition["interval"])
            : { fromSec: 10, toSec: 10 },
      });
      return { status: 202, body: result };
    }
    const match = request.path.match(/^\/jobs\/([^/]+)(?:\/(pause|resume|stop|logs))?$/);
    if (!match) return { status: 404, body: { error: "ROUTE_NOT_FOUND" } };
    const id = match[1];
    const action = match[2];
    if (request.method === "GET" && !action) {
      const job = await runner.get(request.ownerId, id);
      return job ? { status: 200, body: job } : { status: 404, body: { error: "JOB_NOT_FOUND" } };
    }
    if (request.method === "GET" && action === "logs") {
      const job = await runner.get(request.ownerId, id);
      return job
        ? { status: 200, body: { items: await runner.logs(request.ownerId, id) } }
        : { status: 404, body: { error: "JOB_NOT_FOUND" } };
    }
    if (request.method === "POST" && (action === "pause" || action === "resume" || action === "stop")) {
      const job =
        action === "pause"
          ? await runner.pause(request.ownerId, id)
          : action === "resume"
            ? await runner.resume(request.ownerId, id)
            : await runner.stop(request.ownerId, id);
      return job ? { status: 200, body: job } : { status: 404, body: { error: "JOB_NOT_FOUND" } };
    }
    return { status: 405, body: { error: "METHOD_NOT_ALLOWED" } };
  };
}
