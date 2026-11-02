import {
  AutoCommentExecutor,
  AutoCommentPost,
  AutoCommentReceipt,
  AutoCommentScanRequest,
  AutoCommentScript,
  AutoCommentScriptInput,
  AutoCommentStore,
  CommentTabContent,
  SocketEvent,
  assertPlan,
  localId,
  matchKeyword,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";
import { InMemoryAutoCommentStore } from "./repository.js";
import { MockAutoCommentExecutor } from "./mock-executor.js";

export type AutoCommentEventSink = (event: SocketEvent<AutoCommentReceipt | AutoCommentPost>) => void;

export interface AutoCommentServiceOptions {
  store?: AutoCommentStore;
  executor?: AutoCommentExecutor;
  emit?: AutoCommentEventSink;
}

function validateScript(input: AutoCommentScriptInput): void {
  if (!input.name.trim()) throw new Error("SCRIPT_NAME_REQUIRED");
  if (!input.keywords.some((keyword) => keyword.trim())) throw new Error("SCRIPT_KEYWORD_REQUIRED");
  if (!input.tabContents.length) throw new Error("SCRIPT_CONTENT_REQUIRED");
  const tabs = new Set<number>();
  for (const tab of input.tabContents) {
    if (tab.tab < 1 || tab.tab > 8 || tabs.has(tab.tab)) throw new Error("SCRIPT_TAB_INVALID");
    tabs.add(tab.tab);
    if (!tab.text.trim() && !tab.mediaRefs.length) throw new Error("SCRIPT_CONTENT_REQUIRED");
  }
}

function validateScan(request: AutoCommentScanRequest): void {
  if (!request.accountId.trim()) throw new Error("ACCOUNT_REQUIRED");
  if (!request.groupIds.length) throw new Error("GROUP_REQUIRED");
  if (!request.scriptIds.length) throw new Error("SCRIPT_REQUIRED");
  if (!Number.isFinite(request.fromSec) || !Number.isFinite(request.toSec) || request.fromSec < 10 || request.toSec < request.fromSec) {
    throw new Error("INVALID_INTERVAL");
  }
}

export class AutoCommentService {
  private readonly store: AutoCommentStore;
  private readonly executor: AutoCommentExecutor;
  private readonly emit?: AutoCommentEventSink;

  constructor(options: AutoCommentServiceOptions = {}) {
    this.store = options.store ?? new InMemoryAutoCommentStore();
    this.executor = options.executor ?? new MockAutoCommentExecutor();
    this.emit = options.emit;
  }

  async listScripts(accountId: string, search?: string): Promise<AutoCommentScript[]> {
    return this.store.listScripts(accountId, search);
  }

  async createScript(accountId: string, input: AutoCommentScriptInput, planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<AutoCommentScript> {
    assertPlan(planTier, "PRO");
    validateScript(input);
    return this.store.saveScript(accountId, input);
  }

  async updateScript(accountId: string, scriptId: string, input: AutoCommentScriptInput, planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<AutoCommentScript> {
    assertPlan(planTier, "PRO");
    validateScript(input);
    if (!(await this.store.getScript(accountId, scriptId))) throw new Error("SCRIPT_NOT_FOUND");
    return this.store.saveScript(accountId, input, scriptId);
  }

  async renameScript(accountId: string, scriptId: string, name: string, planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<AutoCommentScript> {
    const script = await this.store.getScript(accountId, scriptId);
    if (!script) throw new Error("SCRIPT_NOT_FOUND");
    return this.updateScript(accountId, scriptId, { ...script, name }, planTier);
  }

  async deleteScript(accountId: string, scriptId: string, planTier: "BASIC" | "PLUS" | "PRO" = "PRO"): Promise<void> {
    assertPlan(planTier, "PRO");
    if (!(await this.store.deleteScript(accountId, scriptId))) throw new Error("SCRIPT_NOT_FOUND");
  }

  async scan(
    request: AutoCommentScanRequest,
    posts: AutoCommentPost[],
    planTier: "BASIC" | "PLUS" | "PRO" = "PRO",
  ): Promise<AutoCommentReceipt[]> {
    assertPlan(planTier, "PRO");
    validateScan(request);
    const scripts = (await Promise.all(request.scriptIds.map((id) => this.store.getScript(request.accountId, id)))).filter(
      (script): script is AutoCommentScript => Boolean(script),
    );
    if (!scripts.length) throw new Error("SCRIPT_NOT_FOUND");
    const existing = await this.store.listReceipts(request.accountId);
    const seen = new Set(existing.map((receipt) => `${receipt.groupId}:${receipt.feedbackId}`));
    const receipts: AutoCommentReceipt[] = [];
    for (const post of posts) {
      if (!request.groupIds.includes(post.groupId)) continue;
      const key = `${post.groupId}:${post.feedbackId}`;
      if (seen.has(key)) continue;
      const selected = scripts
        .map((script) => ({ script, matchedKeyword: matchKeyword(post.text, script.keywords) }))
        .find((candidate) => candidate.matchedKeyword);
      if (!selected) {
        const skipped: AutoCommentReceipt = {
          receiptId: localId("auto_comment_receipt"), accountId: request.accountId,
          groupId: post.groupId, feedbackId: post.feedbackId, status: "skipped",
          executor: "mock", externalSideEffect: false, createdAt: nowIso(),
        };
        receipts.push(await this.store.saveReceipt(skipped));
        seen.add(key);
        this.emit?.({ type: "auto-comment.scanned", payload: post, emittedAt: nowIso() });
        continue;
      }
      const content: CommentTabContent = selected.script.tabContents[0];
      const receipt = await this.executor.comment({
        accountId: request.accountId,
        groupId: post.groupId,
        feedbackId: post.feedbackId,
        content,
        postUrl: post.postUrl,
      });
      const enriched: AutoCommentReceipt = {
        ...receipt,
        scriptId: selected.script.id,
        matchedKeyword: selected.matchedKeyword,
      };
      receipts.push(await this.store.saveReceipt(enriched));
      seen.add(key);
      this.emit?.({ type: "auto-comment.receipt", payload: enriched, emittedAt: nowIso() });
    }
    return receipts;
  }

  async receipts(accountId: string): Promise<AutoCommentReceipt[]> {
    return this.store.listReceipts(accountId);
  }
}

export function createAutoCommentService(options: AutoCommentServiceOptions = {}): AutoCommentService {
  return new AutoCommentService(options);
}
