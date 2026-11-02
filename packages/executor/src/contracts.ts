/**
 * Provider-neutral execution contracts.
 *
 * The executor is deliberately a seam.  Only MockExecutor is implemented in
 * this package; a real browser/extension adapter must be supplied explicitly
 * by a future runtime and must not be selected by default.
 */

export type PlanTier = "BASIC" | "PLUS" | "PRO";

export type AccountId = string;
export type JobId = string;
export type RequestId = string;

export type ExtensionAction =
  | "CHECK_ACTIVE_EXTENSION"
  | "GET_VERSION"
  | "SYNC_ACCOUNT"
  | "LIST_FB_SESSION_UIDS"
  | "GET_PROFILE_INSTANCE_ID"
  | "VALIDATE_FB_SESSIONS"
  | "OPEN_INCOGNITO_FACEBOOK"
  | "OPEN_FACEBOOK"
  | "GET_LOCAL_FB_CONTEXT"
  | "SYNC_CURRENT_USER_INFO"
  | "UPLOAD_MEDIA"
  | "POST_TO_GROUP"
  | "POST_WALL_SHARE"
  | "POST_TO_TIMELINE"
  | "SHARE_STORY_TO_GROUP"
  | "POST_COMMENT"
  | "JOIN_GROUP"
  | "LEAVE_GROUP"
  | "DELETE_GROUP_POSTS"
  | "COUNT_GROUP_POSTS_TO_DELETE";

export const extensionActions: readonly ExtensionAction[] = [
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
  "COUNT_GROUP_POSTS_TO_DELETE"
] as const;

/** Actions needed by the BASIC, PLUS, and PRO product checklists. */
export type ExecutorAction =
  | {
      kind: "postToGroup";
      groupId: string;
      content: string;
      media?: readonly MediaRef[];
      options?: PostOptions;
    }
  | {
      kind: "postToTimeline";
      content: string;
      media?: readonly MediaRef[];
      options?: PostOptions;
    }
  | {
      kind: "shareWallPostToGroup";
      groupId: string;
      postId: string;
      options?: ShareOptions;
    }
  | {
      kind: "shareStoryToGroup";
      groupId: string;
      storyId: string;
    }
  | {
      kind: "comment";
      targetId: string;
      content: string;
      media?: readonly MediaRef[];
    }
  | {
      kind: "like";
      targetId: string;
    }
  | {
      kind: "bump";
      postId: string;
      groupId: string;
    }
  | {
      kind: "joinGroup";
      groupId: string;
      answers?: readonly GroupQuestionAnswer[];
    }
  | {
      kind: "leaveGroup";
      groupId: string;
    }
  | {
      kind: "deleteGroupPosts";
      groupId: string;
      filter: "all" | "pending" | "published";
    }
  | {
      kind: "approveMember";
      groupId: string;
      memberId: string;
      includeSuspectedSpam: boolean;
    }
  | {
      kind: "inviteFriend";
      profileId: string;
    }
  | {
      kind: "poke";
      profileId: string;
    }
  | {
      kind: "unfriend";
      profileId: string;
    }
  | {
      kind: "cancelFriendRequest";
      profileId: string;
    }
  | {
      kind: "replyPageComment";
      pageId: string;
      commentId: string;
      content: string;
    };

export interface MediaRef {
  readonly id: string;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  readonly sizeBytes: number;
  readonly order: number;
}

export interface PostOptions {
  readonly backgroundId?: string;
  readonly mentionEveryone?: boolean;
  readonly mentionHighlighted?: readonly string[];
  readonly marketplace?: boolean;
  readonly reorderMedia?: boolean;
}

export interface ShareOptions {
  readonly comment?: string;
}

export interface GroupQuestionAnswer {
  readonly questionId: string;
  readonly answer: string;
}

export interface ExecutionContext {
  readonly accountId: AccountId;
  readonly jobId?: JobId;
  readonly requestId?: RequestId;
  readonly plan: PlanTier;
  readonly dryRun?: boolean;
}

export type ExecutionStatus = "completed" | "failed" | "cancelled" | "disabled";

export interface ExecutionReceipt {
  readonly receiptId: string;
  readonly action: ExecutorAction["kind"];
  readonly accountId: AccountId;
  readonly status: ExecutionStatus;
  readonly externalExecution: false;
  readonly createdAt: string;
  readonly finishedAt: string;
  readonly detail: string;
  readonly requestId?: RequestId;
}

export interface Executor {
  readonly mode: "mock" | "extension";
  readonly externalExecutionEnabled: boolean;
  execute(action: ExecutorAction, context: ExecutionContext): Promise<ExecutionReceipt>;
}

export interface QueuePolicy {
  readonly intervalFromSeconds: number;
  readonly intervalToSeconds: number;
  readonly dailyLimit: number;
  readonly antiSpam: boolean;
}

export interface AccountQueue {
  readonly accountId: AccountId;
  readonly pending: number;
  readonly running: boolean;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
}

export type JobLifecycle = "queued" | "running" | "paused" | "completed" | "stopped" | "failed";

export interface JobProgress {
  readonly jobId: JobId;
  readonly lifecycle: JobLifecycle;
  readonly total: number;
  readonly completed: number;
  readonly pending: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly accountQueues: readonly AccountQueue[];
  readonly lastReceipt?: ExecutionReceipt;
}

export interface JobProgressEvent {
  readonly type: "job.progress";
  readonly at: string;
  readonly progress: JobProgress;
}

export interface JobControl {
  start(jobId: JobId): Promise<JobProgress>;
  pause(jobId: JobId): Promise<JobProgress>;
  resume(jobId: JobId): Promise<JobProgress>;
  stop(jobId: JobId): Promise<JobProgress>;
  onProgress(listener: (event: JobProgressEvent) => void): () => void;
}

export interface QuotaPolicy {
  readonly dailyLimit: number;
  readonly usedToday: number;
  readonly remainingToday: number;
}

export interface RandomIntervalPolicy {
  readonly fromSeconds: number;
  readonly toSeconds: number;
  /** Deterministic sampling contract for a testable scheduler. */
  sample(seed: number, sequence: number): number;
}

export interface SpamStopEvent {
  readonly type: "spam.stop";
  readonly jobId: JobId;
  readonly accountId: AccountId;
  readonly reason: "spam-detected" | "quota-exhausted" | "manual-stop";
  readonly at: string;
}

export interface ExecutorEventMap {
  readonly "job.progress": JobProgressEvent;
  readonly "spam.stop": SpamStopEvent;
}

export interface GraphQlHint {
  readonly action: ExecutorAction["kind"];
  readonly endpoint: "https://www.facebook.com/api/graphql/";
  readonly docId: string | null;
  readonly friendlyName: string | null;
  readonly source: string;
  readonly evidence: "FACT" | "UNKNOWN";
}
