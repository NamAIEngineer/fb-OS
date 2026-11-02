import {
  PageCommentReceipt,
  PageCommentRequest,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";

export class MockPageCommentExecutor {
  async execute(request: PageCommentRequest): Promise<PageCommentReceipt> {
    return {
      receiptId: localId("page_comment_receipt"),
      accountId: request.accountId,
      pageId: request.pageId,
      commentId: request.commentId,
      action: request.action,
      status: "success",
      executor: "mock",
      externalSideEffect: false,
      createdAt: nowIso(),
    };
  }
}
