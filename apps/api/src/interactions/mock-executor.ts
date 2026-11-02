import {
  InteractionExecutor,
  InteractionRequest,
  MockReceipt,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";

/**
 * Side-effect-free executor used by every local E2E path.  A later extension
 * adapter can implement InteractionExecutor without changing orchestration or
 * persistence code.
 */
export class MockInteractionExecutor implements InteractionExecutor {
  async execute(request: InteractionRequest): Promise<MockReceipt[]> {
    const createdAt = nowIso();
    return request.friendIds.map((targetUid) => ({
      receiptId: localId("interaction_receipt"),
      action: request.action,
      accountId: request.accountId,
      targetUid,
      status: "success" as const,
      externalSideEffect: false as const,
      executor: "mock" as const,
      createdAt,
    }));
  }
}
