import {
  AutoCommentExecutor,
  AutoCommentReceipt,
  CommentTabContent,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";

export class MockAutoCommentExecutor implements AutoCommentExecutor {
  async comment(input: {
    accountId: string;
    groupId: string;
    feedbackId: string;
    content: CommentTabContent;
    postUrl?: string;
  }): Promise<AutoCommentReceipt> {
    return {
      receiptId: localId("auto_comment_receipt"),
      accountId: input.accountId,
      groupId: input.groupId,
      feedbackId: input.feedbackId,
      status: "success",
      executor: "mock",
      externalSideEffect: false,
      createdAt: nowIso(),
    };
  }
}
