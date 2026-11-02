import { MockCampaignExecutor } from "./executor.js";
import { InMemoryCampaignStore } from "./store.js";
import type {
  CampaignActionReceipt,
  CampaignActionType,
  CampaignContext,
  CampaignDeleteFilter,
  CampaignExecutor,
  CampaignPost,
  CampaignReportRow,
  CampaignServiceOptions,
  CampaignStatus,
  CampaignStore,
  GroupCollectionRecord,
  GroupStat,
} from "./types.js";

const PLAN_RANK: Record<CampaignContext["plan"], number> = {
  BASIC: 1,
  PLUS: 2,
  PRO: 3,
  MAX: 4,
};

function assertPlan(context: CampaignContext, minimum: CampaignContext["plan"]): void {
  if (PLAN_RANK[context.plan] < PLAN_RANK[minimum]) {
    throw new Error(`PLAN_REQUIRED:${minimum}`);
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Prevent spreadsheet formula execution in exported user-controlled text.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export class CampaignService {
  private readonly store: CampaignStore;
  private readonly executor: CampaignExecutor;
  private readonly now: () => string;
  private readonly id: (prefix: string) => string;

  constructor(options: CampaignServiceOptions = {}) {
    this.store = options.store ?? new InMemoryCampaignStore();
    this.executor = options.executor ?? new MockCampaignExecutor();
    this.now = options.now ?? (() => new Date().toISOString());
    this.id = options.id ?? ((prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  }

  async listPosts(context: CampaignContext, status?: CampaignStatus): Promise<CampaignPost[]> {
    const state = await this.store.load();
    return state.posts
      .filter((post) => post.userId === context.userId && (!status || post.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async savePost(context: CampaignContext, postId: string, saved = true): Promise<CampaignPost> {
    const state = await this.store.load();
    const post = state.posts.find((candidate) => candidate.id === postId && candidate.userId === context.userId);
    if (!post) throw new Error("POST_NOT_FOUND");
    post.saved = saved;
    post.updatedAt = this.now();
    await this.store.save(state);
    return post;
  }

  async updateStatus(context: CampaignContext, postId: string, status: CampaignStatus, reason?: string): Promise<CampaignPost> {
    const state = await this.store.load();
    const post = state.posts.find((candidate) => candidate.id === postId && candidate.userId === context.userId);
    if (!post) throw new Error("POST_NOT_FOUND");
    post.status = status;
    post.rejectionReason = reason;
    post.updatedAt = this.now();
    await this.store.save(state);
    return post;
  }

  async deletePosts(context: CampaignContext, filter: CampaignDeleteFilter): Promise<{ deleted: number; filter: CampaignDeleteFilter }> {
    const state = await this.store.load();
    const matches = (post: CampaignPost) => post.userId === context.userId &&
      (filter === "all" || post.status === filter);
    const before = state.posts.length;
    state.posts = state.posts.filter((post) => !matches(post));
    await this.store.save(state);
    return { deleted: before - state.posts.length, filter };
  }

  private async action(
    context: CampaignContext,
    postId: string,
    action: CampaignActionType,
    options: { count?: number; text?: string; url?: string } = {},
  ): Promise<CampaignActionReceipt> {
    assertPlan(context, "PLUS");
    const state = await this.store.load();
    const post = state.posts.find((candidate) => candidate.id === postId && candidate.userId === context.userId);
    if (!post) throw new Error("POST_NOT_FOUND");
    const result = await this.executor.execute({ action, post, ...options });
    const receipt: CampaignActionReceipt = {
      ...result,
      id: this.id("action"),
      postId,
      createdAt: this.now(),
    };
    state.actions.push(receipt);
    await this.store.save(state);
    return receipt;
  }

  async bump(context: CampaignContext, postId: string, upCount = 1): Promise<CampaignActionReceipt> {
    if (!Number.isInteger(upCount) || upCount < 1 || upCount > 100) throw new Error("INVALID_UP_COUNT");
    return this.action(context, postId, "bump", { count: upCount });
  }

  async commentOutreach(context: CampaignContext, postId: string, text: string): Promise<CampaignActionReceipt> {
    if (!text.trim()) throw new Error("COMMENT_REQUIRED");
    return this.action(context, postId, "comment-outreach", { text: text.trim() });
  }

  async shareLink(context: CampaignContext, postId: string, url: string): Promise<CampaignActionReceipt> {
    try { new URL(url); } catch { throw new Error("INVALID_URL"); }
    return this.action(context, postId, "link-share", { url });
  }

  async shareProfilePostToGroup(context: CampaignContext, postId: string, groupId: string): Promise<CampaignActionReceipt> {
    if (!groupId.trim()) throw new Error("GROUP_REQUIRED");
    return this.action(context, postId, "profile-to-group-share", { text: groupId.trim() });
  }

  async recordGroupStats(context: CampaignContext, stats: Omit<GroupStat, "updatedAt">): Promise<GroupStat> {
    const state = await this.store.load();
    const next: GroupStat = { ...stats, updatedAt: this.now() };
    const index = state.groupStats.findIndex((item) => item.id === stats.id);
    if (index >= 0) state.groupStats[index] = next;
    else state.groupStats.push(next);
    await this.store.save(state);
    return next;
  }

  async listGroupStats(context: CampaignContext, query = ""): Promise<GroupStat[]> {
    const needle = query.trim().toLocaleLowerCase();
    const state = await this.store.load();
    return state.groupStats
      .filter((item) => !needle || item.name.toLocaleLowerCase().includes(needle) || item.uid.includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveCollection(context: CampaignContext, input: { id?: string; name: string; groupIds: string[] }): Promise<GroupCollectionRecord> {
    if (!input.name.trim()) throw new Error("COLLECTION_NAME_REQUIRED");
    const state = await this.store.load();
    const timestamp = this.now();
    const existing = input.id && state.collections.find((item) => item.id === input.id && item.userId === context.userId);
    const collection: GroupCollectionRecord = existing
      ? { ...existing, name: input.name.trim(), groupIds: [...new Set(input.groupIds)], updatedAt: timestamp }
      : { id: this.id("collection"), userId: context.userId, name: input.name.trim(), groupIds: [...new Set(input.groupIds)], createdAt: timestamp, updatedAt: timestamp };
    if (existing) state.collections = state.collections.map((item) => item.id === existing.id ? collection : item);
    else state.collections.push(collection);
    await this.store.save(state);
    return collection;
  }

  async listCollections(context: CampaignContext): Promise<GroupCollectionRecord[]> {
    const state = await this.store.load();
    return state.collections.filter((item) => item.userId === context.userId).sort((a, b) => a.name.localeCompare(b.name));
  }

  async report(context: CampaignContext, format: "csv" | "json" = "csv"): Promise<{ format: "csv" | "json"; body: string; rows: CampaignReportRow[] }> {
    assertPlan(context, "PLUS");
    const state = await this.store.load();
    const posts = state.posts.filter((post) => post.userId === context.userId);
    const rows = posts.map((post) => ({
      postId: post.id,
      groupName: post.groupName,
      status: post.status,
      mode: post.mode,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      actionCount: state.actions.filter((action) => action.postId === post.id).length,
    }));
    if (format === "json") return { format, body: JSON.stringify(rows), rows };
    const header = ["postId", "groupName", "status", "mode", "createdAt", "updatedAt", "actionCount"];
    const body = [header, ...rows.map((row) => header.map((key) => csvCell(row[key as keyof CampaignReportRow])))]
      .map((line) => line.join(","))
      .join("\n");
    return { format, body, rows };
  }
}

export function createCampaignService(options: CampaignServiceOptions = {}): CampaignService {
  return new CampaignService(options);
}
