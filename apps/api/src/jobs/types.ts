import type { DailyQuotaKind } from "../accounts/types";

export type JobState =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export type JobActionState = "queued" | "running" | "success" | "error" | "skipped";

export interface JobInterval {
  fromSec: number;
  toSec: number;
  antiSpam?: boolean;
}

export interface JobAction {
  id: string;
  accountId: string;
  quotaKind: DailyQuotaKind;
  /** Public action metadata only; never put cookies/tokens in payload. */
  payload?: Record<string, unknown>;
}

export interface JobDefinition {
  id: string;
  ownerId: string;
  label?: string;
  actions: JobAction[];
  interval: JobInterval;
  antiSpam?: boolean;
}

export interface JobRecord extends JobDefinition {
  state: JobState;
  currentActionId: string | null;
  completed: number;
  failed: number;
  skipped: number;
  stopReason?: "manual" | "daily_quota" | "spam_detected" | "executor_error";
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export type ExecutorOutcome =
  | { status: "success"; detail?: string }
  | { status: "error"; error: string }
  | { status: "spam"; detail?: string };

export interface JobExecutor {
  execute(action: JobAction): Promise<ExecutorOutcome>;
}

export interface JobLog {
  id: string;
  jobId: string;
  actionId?: string;
  accountId?: string;
  step:
    | "queued"
    | "started"
    | "succeeded"
    | "failed"
    | "skipped"
    | "quota_exceeded"
    | "spam_detected"
    | "spam_slowed"
    | "paused"
    | "resumed"
    | "stopped"
    | "completed";
  message: string;
  at: string;
  data?: Record<string, unknown>;
}

export type JobEvent =
  | { type: "job:state"; job: JobRecord }
  | { type: "job:log"; log: JobLog };

export interface JobEventSink {
  emit(event: JobEvent): void;
}

export interface JobRepository {
  save(job: JobRecord): Promise<JobRecord>;
  get(ownerId: string, id: string): Promise<JobRecord | null>;
  list(ownerId: string): Promise<JobRecord[]>;
  logs(ownerId: string, id: string): Promise<JobLog[]>;
  appendLog(ownerId: string, log: JobLog): Promise<void>;
}
