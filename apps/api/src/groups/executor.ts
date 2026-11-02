import type {
  ExecutorReceipt,
  GroupExecutor,
  JoinQuestionAnswer,
  PublicGroupMetadata,
} from "../../../../packages/shared/contracts-groups.js";

let receiptSequence = 0;

function receiptId(action: string): string {
  receiptSequence += 1;
  return `mock-${action.replaceAll(".", "-")}-${receiptSequence}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Side-effect-free executor used for all local E2E flows.  It records the
 * intended Facebook action as a receipt and never contacts Facebook.
 */
export class MockExecutor implements GroupExecutor {
  readonly mode = "mock" as const;

  async joinGroup(input: {
    accountId: string;
    group: PublicGroupMetadata;
    questionAnswers: JoinQuestionAnswer[];
  }): Promise<ExecutorReceipt> {
    const status = input.group.approvalRequired ? "pending" : "joined";
    return {
      id: receiptId("group.join"),
      action: "group.join",
      mode: this.mode,
      accepted: true,
      status,
      reason: input.group.approvalRequired ? "group-approval-required" : "public-group-join-accepted",
      createdAt: now(),
    };
  }

  async leaveGroup(input: { accountId: string; group: PublicGroupMetadata }): Promise<ExecutorReceipt> {
    return {
      id: receiptId("group.leave"),
      action: "group.leave",
      mode: this.mode,
      accepted: true,
      status: "left",
      reason: "mock-leave-accepted",
      createdAt: now(),
    };
  }

  async inviteNewMembers(input: {
    accountId: string;
    group: PublicGroupMetadata;
    count: number;
  }): Promise<ExecutorReceipt> {
    return {
      id: receiptId("group.invite-new-members"),
      action: "group.invite-new-members",
      mode: this.mode,
      accepted: true,
      status: "invited",
      reason: `mock-invites-queued:${Math.max(0, Math.floor(input.count))}`,
      createdAt: now(),
    };
  }

  async approveMember(input: {
    accountId: string;
    group: PublicGroupMetadata;
    requestId: string;
    suspectedSpam: boolean;
  }): Promise<ExecutorReceipt> {
    return {
      id: receiptId("group.approve-member"),
      action: "group.approve-member",
      mode: this.mode,
      accepted: true,
      status: "approved",
      reason: input.suspectedSpam ? "mock-suspected-spam-explicitly-approved" : "mock-member-approved",
      createdAt: now(),
    };
  }
}

/**
 * Live executor seam.  No implementation is provided until the explicit
 * Nam clone/private-group gate is satisfied by the host runtime.
 */
export class GatedLiveExecutor implements GroupExecutor {
  readonly mode = "live" as const;

  private unavailable(): Promise<ExecutorReceipt> {
    return Promise.reject(new Error("LIVE_GATE_REQUIRED: Nam-provided clone and private test group required"));
  }

  joinGroup(): Promise<ExecutorReceipt> { return this.unavailable(); }
  leaveGroup(): Promise<ExecutorReceipt> { return this.unavailable(); }
  inviteNewMembers(): Promise<ExecutorReceipt> { return this.unavailable(); }
  approveMember(): Promise<ExecutorReceipt> { return this.unavailable(); }
}

