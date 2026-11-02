export interface BridgeRequest {
  readonly type: string;
  readonly requestId: string;
  readonly data?: unknown;
}

export interface BridgeResponse {
  readonly type: `R_${string}`;
  readonly requestId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

export const observedExtensionActions = [
  "CHECK_ACTIVE_EXTENSION",
  "GET_VERSION",
  "SYNC_ACCOUNT",
  "LIST_FB_SESSION_UIDS",
  "GET_PROFILE_INSTANCE_ID",
  "VALIDATE_FB_SESSIONS",
  "OPEN_INCOGNITO_FACEBOOK",
  "OPEN_FACEBOOK",
  "GET_LOCAL_FB_CONTEXT",
  "SYNC_CURRENT_USER_INFO",
  "UPLOAD_MEDIA",
  "POST_TO_GROUP",
  "POST_WALL_SHARE",
  "POST_TO_TIMELINE",
  "SHARE_STORY_TO_GROUP",
  "POST_COMMENT",
  "JOIN_GROUP",
  "LEAVE_GROUP",
  "DELETE_GROUP_POSTS",
  "COUNT_GROUP_POSTS_TO_DELETE",
  "FETCH"
] as const;

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === "string" &&
    candidate.type.length > 0 &&
    candidate.type.length <= 128 &&
    typeof candidate.requestId === "string" &&
    requestIdPattern.test(candidate.requestId)
  );
}

export function responseFor(
  request: BridgeRequest,
  result: { readonly success: true; readonly data?: unknown } | { readonly success: false; readonly error: string }
): BridgeResponse {
  return {
    type: `R_${request.type}`,
    requestId: request.requestId,
    ...result
  };
}

export function disabledResponse(request: BridgeRequest): BridgeResponse {
  return responseFor(request, {
    success: false,
    error: "External execution is disabled; use MockExecutor for E2E"
  });
}
