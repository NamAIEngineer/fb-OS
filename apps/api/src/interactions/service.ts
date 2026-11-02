import {
  InteractionExecutor,
  InteractionRequest,
  InteractionRun,
  InteractionStore,
  MockReceipt,
  SocketEvent,
  assertPlan,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";
import { InMemoryInteractionStore } from "../friends/repository.js";
import { MockInteractionExecutor } from "./mock-executor.js";

export type InteractionEventSink = (event: SocketEvent<MockReceipt | InteractionRun>) => void;

export interface InteractionServiceOptions {
  store?: InteractionStore;
  executor?: InteractionExecutor;
  emit?: InteractionEventSink;
}

function validateRequest(request: InteractionRequest): void {
  if (!request.accountId.trim()) throw new Error("Chưa chọn tài khoản Facebook");
  if (!request.friendIds.length) throw new Error("Chọn ít nhất một bạn bè");
  if (request.action === "comment") {
    const hasContent = Object.values(request.composers ?? {}).some(
      (composer) => Boolean(composer?.text.trim()) || composer?.mediaRefs.length,
    );
    if (!hasContent) throw new Error("Nhập nội dung bình luận hoặc chọn ảnh");
  }
  if (request.taskBar) {
    const { fromSec, toSec } = request.taskBar;
    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec < 10 || toSec < fromSec) {
      throw new Error("Khoảng cách phải từ 10 giây và Từ không được lớn hơn Đến");
    }
  }
}

export class InteractionService {
  private readonly store: InteractionStore;
  private readonly executor: InteractionExecutor;
  private readonly emit?: InteractionEventSink;

  constructor(options: InteractionServiceOptions = {}) {
    this.store = options.store ?? new InMemoryInteractionStore();
    this.executor = options.executor ?? new MockInteractionExecutor();
    this.emit = options.emit;
  }

  async start(request: InteractionRequest, planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<InteractionRun> {
    assertPlan(planTier, "PRO");
    validateRequest(request);
    const run: InteractionRun = {
      runId: localId("interaction_run"),
      request: structuredClone(request),
      receipts: [],
      running: true,
      startedAt: nowIso(),
    };
    await this.store.saveRun(run);
    this.emit?.({ type: "interaction.started", runId: run.runId, payload: structuredClone(run), emittedAt: nowIso() });

    // MockExecutor is intentionally sequential: receipts preserve the same
    // order as the selected friend table and are easy to replay in E2E.
    const receipts = await this.executor.execute(request);
    for (const receipt of receipts) {
      run.receipts.push(receipt);
      await this.store.saveRun(run);
      this.emit?.({ type: "interaction.receipt", runId: run.runId, payload: receipt, emittedAt: nowIso() });
    }
    run.running = false;
    run.completedAt = nowIso();
    await this.store.saveRun(run);
    this.emit?.({ type: "interaction.completed", runId: run.runId, payload: structuredClone(run), emittedAt: nowIso() });
    return structuredClone(run);
  }

  async get(accountId: string, runId: string): Promise<InteractionRun | undefined> {
    return this.store.getRun(accountId, runId);
  }

  async list(accountId: string): Promise<InteractionRun[]> {
    return this.store.listRuns(accountId);
  }
}
