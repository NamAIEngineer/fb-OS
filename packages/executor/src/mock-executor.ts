import type {
  ExecutionContext,
  ExecutionReceipt,
  Executor,
  ExecutorAction
} from "./contracts.js";

export interface MockExecutorOptions {
  /** Fixed ISO timestamp keeps receipts reproducible in E2E fixtures. */
  readonly now?: string;
  readonly receiptPrefix?: string;
}

/**
 * Deterministic, side-effect-free executor for local E2E.
 *
 * It validates no Facebook state, opens no browser, and performs no HTTP
 * request. Every accepted action becomes a receipt with externalExecution=false.
 */
export class MockExecutor implements Executor {
  readonly mode = "mock" as const;
  readonly externalExecutionEnabled = false as const;

  private readonly now: string;
  private readonly prefix: string;
  private sequence = 0;
  private readonly receipts: ExecutionReceipt[] = [];

  constructor(options: MockExecutorOptions = {}) {
    this.now = options.now ?? "2026-01-01T00:00:00.000Z";
    this.prefix = options.receiptPrefix ?? "mock";
  }

  async execute(action: ExecutorAction, context: ExecutionContext): Promise<ExecutionReceipt> {
    this.sequence += 1;
    const receipt: ExecutionReceipt = {
      receiptId: `${this.prefix}-${String(this.sequence).padStart(4, "0")}`,
      action: action.kind,
      accountId: context.accountId,
      status: "completed",
      externalExecution: false,
      createdAt: this.now,
      finishedAt: this.now,
      detail: `MOCK_ONLY: ${action.kind} accepted; no external execution`,
      ...(context.requestId ? { requestId: context.requestId } : {})
    };
    this.receipts.push(receipt);
    return receipt;
  }

  listReceipts(): readonly ExecutionReceipt[] {
    return this.receipts.slice();
  }

  reset(): void {
    this.sequence = 0;
    this.receipts.length = 0;
  }
}
