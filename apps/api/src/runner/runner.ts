import {
  DEFAULT_DAILY_LIMITS,
  type AccountRepository,
  type DailyQuotaKind,
} from "../accounts";
import type { UsageStore } from "../quota";
import type {
  ExecutorOutcome,
  JobAction,
  JobDefinition,
  JobEvent,
  JobEventSink,
  JobExecutor,
  JobInterval,
  JobLog,
  JobRecord,
  JobRepository,
  JobState,
} from "../jobs";

export const RUNNER_MIN_INTERVAL_SEC = 10;
export const RUNNER_ANTI_SPAM_INTERVAL_SEC = 60;

export interface RunnerClock {
  now(): Date;
  random(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: RunnerClock = {
  now: () => new Date(),
  random: () => Math.random(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

interface JobContext {
  job: JobRecord;
  stopped: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  interruptResolvers: Set<() => void>;
  resumeResolvers: Set<() => void>;
  completion: Promise<JobRecord>;
  resolveCompletion: (job: JobRecord) => void;
  finalized: boolean;
}

export interface JobRunnerOptions {
  clock?: Partial<RunnerClock>;
  sink?: JobEventSink;
  accountRepository?: AccountRepository;
  id?: () => string;
}

export interface RunnerStartReceipt {
  jobId: string;
  state: "queued";
  queuePositionByAccount: Record<string, number>;
}

function jobId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeInterval(value: JobInterval): JobInterval {
  const from = Number.isFinite(value.fromSec) ? Math.floor(value.fromSec) : RUNNER_MIN_INTERVAL_SEC;
  const to = Number.isFinite(value.toSec) ? Math.floor(value.toSec) : from;
  const antiSpam = value.antiSpam === true;
  const min = antiSpam ? RUNNER_ANTI_SPAM_INTERVAL_SEC : RUNNER_MIN_INTERVAL_SEC;
  const normalizedFrom = Math.max(min, from);
  const normalizedTo = Math.max(normalizedFrom, to);
  return { fromSec: normalizedFrom, toSec: normalizedTo, antiSpam };
}

function pickInterval(interval: JobInterval, random: number): number {
  const span = interval.toSec - interval.fromSec;
  return interval.fromSec + Math.floor(Math.max(0, Math.min(0.999999, random)) * (span + 1));
}

function cloneJob(job: JobRecord): JobRecord {
  return { ...job, interval: { ...job.interval }, actions: job.actions.map((action) => ({ ...action })) };
}

/**
 * Mock-first job runner. No browser, Facebook, cookie, or credential calls
 * exist here; all external work is delegated to the injected executor.
 */
export class JobRunner {
  private readonly clock: RunnerClock;
  private readonly sink?: JobEventSink;
  private readonly accountRepository?: AccountRepository;
  private readonly id: () => string;
  private readonly contexts = new Map<string, JobContext>();
  private readonly accountQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: JobRepository,
    private readonly quota: UsageStore,
    private readonly executor: JobExecutor,
    options: JobRunnerOptions = {},
  ) {
    this.clock = { ...realClock, ...(options.clock ?? {}) };
    this.sink = options.sink;
    this.accountRepository = options.accountRepository;
    this.id = options.id ?? jobId;
  }

  async get(ownerId: string, id: string): Promise<JobRecord | null> {
    return this.repository.get(ownerId, id);
  }

  async logs(ownerId: string, id: string): Promise<JobLog[]> {
    return this.repository.logs(ownerId, id);
  }

  /** Queue one job; one chain exists per account, so same-account actions serialize. */
  async start(definition: Omit<JobDefinition, "id"> & { id?: string }): Promise<RunnerStartReceipt> {
    const now = this.clock.now().toISOString();
    const id = definition.id ?? this.id();
    const antiSpam = definition.antiSpam ?? definition.interval.antiSpam ?? false;
    const job: JobRecord = {
      ...definition,
      id,
      interval: normalizeInterval({ ...definition.interval, antiSpam }),
      antiSpam,
      state: "queued",
      currentActionId: null,
      completed: 0,
      failed: 0,
      skipped: 0,
      createdAt: now,
      startedAt: null,
      endedAt: null,
    };
    const context: JobContext = {
      job,
      stopped: false,
      timer: null,
      interruptResolvers: new Set(),
      resumeResolvers: new Set(),
      completion: Promise.resolve(job),
      resolveCompletion: () => undefined,
      finalized: false,
    };
    context.completion = new Promise<JobRecord>((resolve) => {
      context.resolveCompletion = resolve;
    });
    this.contexts.set(id, context);
    await this.repository.save(job);
    this.emit({ type: "job:state", job });
    const accountIds = [...new Set(job.actions.map((action) => action.accountId))];
    const positions: Record<string, number> = {};
    // Acquire every account lock in a stable order, then execute the job once.
    // This prevents duplicate execution for multi-account jobs and avoids lock
    // inversion when two jobs share different subsets of accounts.
    const priorQueues = accountIds.map((accountId) => {
      const prior = this.accountQueues.get(accountId);
      positions[accountId] = prior ? 2 : 1;
      return prior;
    });
    const queue = Promise.all(priorQueues.map((prior) => prior?.catch(() => undefined)))
      .then(() => this.run(context))
      .catch(async () => {
        context.job.state = "failed";
        context.job.stopReason = "executor_error";
        await this.finalize(context);
      });
    for (const accountId of accountIds) {
      const ownedQueue = queue.finally(() => {
        if (this.accountQueues.get(accountId) === ownedQueue) this.accountQueues.delete(accountId);
      });
      this.accountQueues.set(accountId, ownedQueue);
    }
    if (accountIds.length === 0) void queue;
    return { jobId: id, state: "queued", queuePositionByAccount: positions };
  }

  async wait(ownerId: string, id: string): Promise<JobRecord | null> {
    const context = this.contexts.get(id);
    if (context) {
      const completed = await context.completion;
      return completed.ownerId === ownerId ? cloneJob(completed) : null;
    }
    return this.repository.get(ownerId, id);
  }

  async pause(ownerId: string, id: string): Promise<JobRecord | null> {
    const context = this.ownedContext(ownerId, id);
    if (!context || !["queued", "running"].includes(context.job.state)) return context?.job ?? null;
    context.job.state = "paused";
    await this.persist(context);
    await this.log(context, { step: "paused", message: "Tác vụ đã tạm dừng" });
    return cloneJob(context.job);
  }

  async resume(ownerId: string, id: string): Promise<JobRecord | null> {
    const context = this.ownedContext(ownerId, id);
    if (!context || context.job.state !== "paused") return context?.job ?? null;
    context.job.state = "running";
    for (const resolve of context.resumeResolvers) resolve();
    context.resumeResolvers.clear();
    await this.persist(context);
    await this.log(context, { step: "resumed", message: "Tác vụ tiếp tục" });
    return cloneJob(context.job);
  }

  async stop(ownerId: string, id: string): Promise<JobRecord | null> {
    const context = this.ownedContext(ownerId, id);
    if (!context || ["completed", "stopped", "failed"].includes(context.job.state)) return context?.job ?? null;
    context.stopped = true;
    context.job.stopReason = "manual";
    for (const resolve of context.interruptResolvers) resolve();
    context.interruptResolvers.clear();
    for (const resolve of context.resumeResolvers) resolve();
    context.resumeResolvers.clear();
    if (context.timer) {
      clearTimeout(context.timer);
      context.timer = null;
    }
    context.job.state = "stopped";
    await this.persist(context);
    await this.log(context, { step: "stopped", message: "Tác vụ đã dừng" });
    await this.finalize(context);
    return cloneJob(context.job);
  }

  private ownedContext(ownerId: string, id: string): JobContext | null {
    const context = this.contexts.get(id);
    return context?.job.ownerId === ownerId ? context : null;
  }

  private async run(context: JobContext): Promise<void> {
    if (context.stopped) return;
    if (context.job.state !== "paused") context.job.state = "running";
    context.job.startedAt = this.clock.now().toISOString();
    await this.persist(context);
    await this.waitIfPaused(context);
    for (let index = 0; index < context.job.actions.length; index += 1) {
      if (context.stopped) break;
      await this.waitIfPaused(context);
      if (context.stopped) break;
      const action = context.job.actions[index];
      context.job.currentActionId = action.id;
      await this.persist(context);
      if (index > 0) {
        const seconds = pickInterval(context.job.interval, this.clock.random());
        await this.delay(context, seconds * 1000);
        if (context.stopped) break;
        await this.waitIfPaused(context);
      }
      if (context.stopped) break;
      await this.log(context, {
        actionId: action.id,
        accountId: action.accountId,
        step: "started",
        message: "Bắt đầu bước tác vụ",
      });
      const quota = await this.reserveQuota(context, action);
      if (!quota.allowed) {
        context.job.skipped += 1;
        context.job.stopReason = "daily_quota";
        await this.log(context, {
          actionId: action.id,
          accountId: action.accountId,
          step: "quota_exceeded",
          message: "Đã đạt giới hạn hằng ngày",
          data: quota,
        });
        context.job.state = "stopped";
        break;
      }
      const outcome = await this.executor.execute(action);
      if (outcome.status === "success") {
        context.job.completed += 1;
        await this.log(context, {
          actionId: action.id,
          accountId: action.accountId,
          step: "succeeded",
          message: outcome.detail ?? "Hoàn thành bước tác vụ",
        });
        continue;
      }
      if (outcome.status === "spam") {
        context.job.stopReason = "spam_detected";
        await this.log(context, {
          actionId: action.id,
          accountId: action.accountId,
          step: "spam_detected",
          message: outcome.detail ?? "Executor phát hiện tín hiệu spam",
        });
        if (context.job.antiSpam) {
          context.job.interval = normalizeInterval({
            ...context.job.interval,
            fromSec: RUNNER_ANTI_SPAM_INTERVAL_SEC,
            toSec: Math.max(context.job.interval.toSec, RUNNER_ANTI_SPAM_INTERVAL_SEC),
            antiSpam: true,
          });
          await this.log(context, {
            actionId: action.id,
            accountId: action.accountId,
            step: "spam_slowed",
            message: `Đã giảm tốc độ; tối thiểu ${RUNNER_ANTI_SPAM_INTERVAL_SEC} giây/lần`,
            data: { fromSec: context.job.interval.fromSec, toSec: context.job.interval.toSec },
          });
        }
        context.job.state = "stopped";
        break;
      }
      context.job.failed += 1;
      context.job.stopReason = "executor_error";
      await this.log(context, {
        actionId: action.id,
        accountId: action.accountId,
        step: "failed",
        message: outcome.error,
      });
      context.job.state = "failed";
      break;
    }
    if (!context.stopped && context.job.state === "running") context.job.state = "completed";
    await this.finalize(context);
  }

  private async reserveQuota(context: JobContext, action: JobAction) {
    const account = this.accountRepository
      ? await this.accountRepository.findById(context.job.ownerId, action.accountId)
      : null;
    const limit = account?.dailyLimits[action.quotaKind] ?? DEFAULT_DAILY_LIMITS[action.quotaKind];
    return this.quota.reserve(
      context.job.ownerId,
      action.accountId,
      action.quotaKind as DailyQuotaKind,
      limit,
    );
  }

  private async waitIfPaused(context: JobContext): Promise<void> {
    while (context.job.state === "paused" && !context.stopped) {
      await new Promise<void>((resolve) => context.resumeResolvers.add(resolve));
    }
  }

  private async delay(context: JobContext, ms: number): Promise<void> {
    if (ms <= 0 || context.stopped) return;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        context.interruptResolvers.delete(finish);
        if (context.timer) clearTimeout(context.timer);
        context.timer = null;
        resolve();
      };
      context.interruptResolvers.add(finish);
      context.timer = setTimeout(finish, ms);
      // Injected clocks enable instant deterministic E2E without real waits.
      if (this.clock.sleep !== realClock.sleep) {
        void this.clock.sleep(ms).then(finish);
      }
    });
  }

  private async persist(context: JobContext): Promise<void> {
    const job = await this.repository.save(context.job);
    this.emit({ type: "job:state", job });
  }

  private async finalize(context: JobContext): Promise<void> {
    if (context.finalized) return;
    context.finalized = true;
    context.job.currentActionId = null;
    context.job.endedAt = this.clock.now().toISOString();
    await this.persist(context);
    await this.log(context, {
      step: "completed",
      message: `Tác vụ kết thúc với trạng thái ${context.job.state}`,
    });
    context.resolveCompletion(cloneJob(context.job));
  }

  private async log(
    context: JobContext,
    entry: Omit<JobLog, "id" | "jobId" | "at">,
  ): Promise<void> {
    const log: JobLog = {
      ...entry,
      id: this.id(),
      jobId: context.job.id,
      at: this.clock.now().toISOString(),
    };
    await this.repository.appendLog(context.job.ownerId, log);
    this.emit({ type: "job:log", log });
  }

  private emit(event: JobEvent): void {
    this.sink?.emit(event);
  }
}
