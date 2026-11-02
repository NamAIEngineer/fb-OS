import {
  PageComment,
  PageCommentReceipt,
  PageCommentStore,
} from "../../../../packages/shared/contracts-interactions.js";

export class InMemoryPageCommentStore implements PageCommentStore {
  private readonly comments = new Map<string, PageComment[]>();
  private readonly receipts = new Map<string, PageCommentReceipt[]>();

  private key(accountId: string, pageId: string): string {
    return `${accountId}:${pageId}`;
  }

  async listComments(accountId: string, pageId: string): Promise<PageComment[]> {
    return structuredClone(this.comments.get(this.key(accountId, pageId)) ?? []);
  }

  async saveReceipt(receipt: PageCommentReceipt): Promise<PageCommentReceipt> {
    const list = this.receipts.get(receipt.accountId) ?? [];
    list.unshift(structuredClone(receipt));
    this.receipts.set(receipt.accountId, list);
    return structuredClone(receipt);
  }

  async listReceipts(accountId: string, pageId?: string): Promise<PageCommentReceipt[]> {
    const list = this.receipts.get(accountId) ?? [];
    return structuredClone(pageId ? list.filter((receipt) => receipt.pageId === pageId) : list);
  }

  seedComments(accountId: string, pageId: string): PageComment[] {
    const key = this.key(accountId, pageId);
    const current = this.comments.get(key);
    if (current?.length) return structuredClone(current);
    const comments: PageComment[] = [
      { pageId, postId: "mock_page_post_1", commentId: "mock_page_comment_1", text: "Xin báo giá", createdAt: new Date().toISOString() },
      { pageId, postId: "mock_page_post_1", commentId: "mock_page_comment_2", text: "Cho mình thông tin", createdAt: new Date().toISOString() },
    ];
    this.comments.set(key, comments);
    return structuredClone(comments);
  }
}
