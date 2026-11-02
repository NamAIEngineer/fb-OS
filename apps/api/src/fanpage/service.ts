import {
  AutoCommentScript,
  PageComment,
  PageCommentReceipt,
  PageCommentRequest,
  PageCommentStore,
  SocketEvent,
  assertPlan,
  matchKeyword,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";
import { InMemoryPageCommentStore } from "./repository.js";
import { MockPageCommentExecutor } from "./mock-executor.js";

export type PageCommentEventSink = (event: SocketEvent<PageCommentReceipt | PageComment>) => void;

export class FanpageService {
  constructor(
    private readonly store: PageCommentStore = new InMemoryPageCommentStore(),
    private readonly executor: MockPageCommentExecutor = new MockPageCommentExecutor(),
    private readonly emit?: PageCommentEventSink,
  ) {}

  async listComments(accountId: string, pageId: string): Promise<PageComment[]> {
    const comments = await this.store.listComments(accountId, pageId);
    if (comments.length) return comments;
    if (this.store instanceof InMemoryPageCommentStore) return this.store.seedComments(accountId, pageId);
    return comments;
  }

  async interact(request: PageCommentRequest, scripts: AutoCommentScript[] = [], planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<PageCommentReceipt> {
    assertPlan(planTier, "PRO");
    if (!request.accountId.trim() || !request.pageId.trim() || !request.commentId.trim()) throw new Error("PAGE_COMMENT_TARGET_REQUIRED");
    if (request.action === "reply" && !request.replyText?.trim() && !request.scriptId) throw new Error("PAGE_REPLY_REQUIRED");
    if (request.scriptId && !scripts.some((script) => script.id === request.scriptId)) throw new Error("SCRIPT_NOT_FOUND");
    const receipt = await this.executor.execute(request);
    const saved = await this.store.saveReceipt(receipt);
    this.emit?.({ type: "page-comment.receipt", payload: saved, emittedAt: nowIso() });
    return saved;
  }

  async runKeywordScript(
    accountId: string,
    pageId: string,
    action: "reply" | "like",
    comments: PageComment[],
    scripts: AutoCommentScript[],
    planTier: "BASIC" | "PLUS" | "PRO" = "PRO",
  ): Promise<PageCommentReceipt[]> {
    assertPlan(planTier, "PRO");
    const receipts: PageCommentReceipt[] = [];
    for (const comment of comments) {
      const selected = scripts.find((script) => matchKeyword(comment.text, script.keywords));
      if (!selected) continue;
      receipts.push(await this.interact({
        accountId,
        pageId,
        commentId: comment.commentId,
        action,
        scriptId: selected.id,
        replyText: action === "reply" ? selected.tabContents[0]?.text : undefined,
      }, scripts, planTier));
    }
    return receipts;
  }

  async receipts(accountId: string, pageId?: string): Promise<PageCommentReceipt[]> {
    return this.store.listReceipts(accountId, pageId);
  }
}

export function createFanpageService(): FanpageService {
  return new FanpageService();
}
