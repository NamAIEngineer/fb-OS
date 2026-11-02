import {
  type ComposerState,
  type MediaInput,
  type PostDraft,
  type PostExecutor,
  type PostJob,
  type PostJobItem,
  type PostReceipt,
  type PostTemplate,
  type JobStatus,
  defaultDraft,
  hasPublishableContent,
  normalizeInterval,
  validateMedia,
} from "../../../../packages/shared/contracts-post.js";

type StoredRecord = { id: string } & Record<string, unknown>;

/** Small persistence boundary. Shell/api workers can replace it with SQLite without changing the route contract. */
export interface PostStore {
  list<T extends { id: string }>(collection: string): Promise<T[]>;
  get<T extends { id: string }>(collection: string, id: string): Promise<T | null>;
  put<T extends { id: string }>(collection: string, value: T): Promise<T>;
  remove(collection: string, id: string): Promise<void>;
  clear(collection: string): Promise<void>;
}

export class MemoryPostStore implements PostStore {
  private readonly collections = new Map<string, Map<string, StoredRecord>>();

  private collection(name: string): Map<string, StoredRecord> {
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new Map();
      this.collections.set(name, collection);
    }
    return collection;
  }

  async list<T extends { id: string }>(collection: string): Promise<T[]> {
    return [...this.collection(collection).values()].map((entry) => structuredClone(entry) as T);
  }

  async get<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    const entry = this.collection(collection).get(id);
    return entry ? (structuredClone(entry) as T) : null;
  }

  async put<T extends { id: string }>(collection: string, value: T): Promise<T> {
    this.collection(collection).set(value.id, structuredClone(value));
    return structuredClone(value) as T;
  }

  async remove(collection: string, id: string): Promise<void> {
    this.collection(collection).delete(id);
  }

  async clear(collection: string): Promise<void> {
    this.collection(collection).clear();
  }
}

/** JSON-file persistence for local development and mock E2E. No credentials or sessions are stored here. */
export class JsonPostStore implements PostStore {
  private readonly pending = new Map<string, Promise<void>>();

  constructor(private readonly rootDir: string) {}

  private async fs(): Promise<typeof import("node:fs/promises")> {
    return import("node:fs/promises");
  }

  private path(collection: string): string {
    // Collection names are internal constants, not user supplied paths.
    return `${this.rootDir}/${collection}.json`;
  }

  private async read<T>(collection: string): Promise<T[]> {
    const fs = await this.fs();
    try {
      const raw = await fs.readFile(this.path(collection), "utf8");
      const value = JSON.parse(raw) as unknown;
      return Array.isArray(value) ? (value as T[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write<T>(collection: string, entries: T[]): Promise<void> {
    const fs = await this.fs();
    await fs.mkdir(this.rootDir, { recursive: true });
    const previous = this.pending.get(collection) ?? Promise.resolve();
    const next = previous.then(async () => {
      const temporaryPath = `${this.path(collection)}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, this.path(collection));
    });
    this.pending.set(collection, next.catch(() => undefined));
    await next;
  }

  async list<T extends { id: string }>(collection: string): Promise<T[]> {
    return (await this.read<T>(collection)).map((entry) => structuredClone(entry));
  }

  async get<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    return (await this.read<T>(collection)).find((entry) => entry.id === id) ?? null;
  }

  async put<T extends { id: string }>(collection: string, value: T): Promise<T> {
    const entries = await this.read<T>(collection);
    const index = entries.findIndex((entry) => entry.id === value.id);
    if (index >= 0) entries[index] = structuredClone(value) as T;
    else entries.push(structuredClone(value) as T);
    await this.write(collection, entries);
    return structuredClone(value) as T;
  }

  async remove(collection: string, id: string): Promise<void> {
    const entries = await this.read<StoredRecord>(collection);
    await this.write(collection, entries.filter((entry) => entry.id !== id));
  }

  async clear(collection: string): Promise<void> {
    await this.write(collection, []);
  }
}

export interface PostServiceOptions {
  store: PostStore;
  now?: () => string;
  id?: () => string;
}

export interface PostValidationError {
  code: string;
  message: string;
  field?: string;
}

export class PostService {
  private readonly now: () => string;
  private readonly id: () => string;

  constructor(private readonly options: PostServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.id = options.id ?? (() => crypto.randomUUID());
  }

  async listDrafts(accountId?: string): Promise<PostDraft[]> {
    const drafts = await this.options.store.list<PostDraft>("post-drafts");
    return accountId ? drafts.filter((draft) => draft.accountId === accountId) : drafts;
  }

  async getDraft(id: string): Promise<PostDraft | null> {
    return this.options.store.get<PostDraft>("post-drafts", id);
  }

  async saveDraft(input: Partial<PostDraft> & { id?: string }): Promise<PostDraft> {
    const inputId = typeof input.id === "string" && input.id.trim() ? input.id : undefined;
    const current = inputId ? await this.getDraft(inputId) : null;
    const now = this.now();
    const base = current ?? defaultDraft(now);
    const merged = {
      ...base,
      ...input,
      id: current?.id ?? inputId ?? this.id(),
      createdAt: current?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
    } as PostDraft;
    const validation = validateDraft(merged);
    if (validation.length) throw new PostServiceError(400, validation);
    return this.options.store.put("post-drafts", merged);
  }

  async deleteDraft(id: string): Promise<void> {
    await this.options.store.remove("post-drafts", id);
  }

  async listTemplates(search?: string): Promise<PostTemplate[]> {
    const templates = await this.options.store.list<PostTemplate>("post-templates");
    const query = search?.trim().toLocaleLowerCase("vi-VN");
    return query ? templates.filter((template) => template.name.toLocaleLowerCase("vi-VN").includes(query)) : templates;
  }

  async saveTemplate(input: { id?: string; name: string; draft: PostTemplate["draft"] }): Promise<PostTemplate> {
    const name = input.name.trim();
    if (!name) throw new PostServiceError(400, [{ code: "TEMPLATE_NAME_REQUIRED", field: "name", message: "Vui lòng nhập tên mẫu" }]);
    if (name.length > 64) throw new PostServiceError(400, [{ code: "TEMPLATE_NAME_TOO_LONG", field: "name", message: "Tối đa 64 ký tự" }]);
    const current = input.id ? await this.options.store.get<PostTemplate>("post-templates", input.id) : null;
    const now = this.now();
    const template: PostTemplate = {
      id: current?.id ?? input.id ?? this.id(),
      name,
      draft: structuredClone(input.draft),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    return this.options.store.put("post-templates", template);
  }

  async renameTemplate(id: string, name: string): Promise<PostTemplate> {
    const current = await this.options.store.get<PostTemplate>("post-templates", id);
    if (!current) throw new PostServiceError(404, [{ code: "TEMPLATE_NOT_FOUND", message: "Không tìm thấy mẫu" }]);
    return this.saveTemplate({ id, name, draft: current.draft });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.options.store.remove("post-templates", id);
  }

  async saveMedia(media: MediaInput, data?: Uint8Array): Promise<MediaInput> {
    const error = validateMedia(media);
    if (error) throw new PostServiceError(400, [error]);
    const result = await this.options.store.put("post-media", { ...media, id: media.id || this.id() });
    // The store contract intentionally does not expose binary writes. Shell can
    // attach an object store while this metadata remains portable.
    void data;
    return result;
  }

  async listMedia(): Promise<MediaInput[]> {
    return this.options.store.list<MediaInput & { id: string }>("post-media");
  }

  async listJobs(): Promise<PostJob[]> {
    return this.options.store.list<PostJob>("post-jobs");
  }

  async getJob(id: string): Promise<PostJob | null> {
    return this.options.store.get<PostJob>("post-jobs", id);
  }

  async startJob(
    draftId: string,
    executor: PostExecutor,
    options: { groupIds?: string[]; accountId?: string; maxItems?: number } = {},
  ): Promise<PostJob> {
    const draft = await this.getDraft(draftId);
    if (!draft) throw new PostServiceError(404, [{ code: "DRAFT_NOT_FOUND", message: "Không tìm thấy bản nháp" }]);
    const validation = validateDraft(draft);
    if (validation.length) throw new PostServiceError(400, validation);
    const groups = options.groupIds?.length ? options.groupIds : draft.groupIds;
    const items = buildJobItems(draft, groups, options.accountId, options.maxItems, this.id, this.now);
    if (!items.length) throw new PostServiceError(400, [{ code: "NO_TARGETS", message: "Chọn ít nhất một nhóm" }]);
    const now = this.now();
    const job: PostJob = {
      id: this.id(),
      draftId,
      status: "running",
      mode: draft.mode,
      destination: draft.destination,
      wallShareEnabled: draft.wallShareEnabled,
      antiSpam: draft.antiSpam,
      fromSec: draft.fromSec,
      toSec: draft.toSec,
      leaveGroupAfterPost: draft.leaveGroupAfterPost,
      items,
      createdAt: now,
      updatedAt: now,
    };
    for (const item of job.items) item.jobId = job.id;
    await this.options.store.put("post-jobs", job);

    for (const item of job.items) {
      const composer = item.kind === "comment"
        ? (draft.comment.contents[item.contentTab] ?? draft.composers[item.contentTab])
        : draft.composers[item.contentTab];
      const media = item.kind === "comment" ? draft.comment.media : (draft.mediaByTab[item.contentTab] ?? []);
      try {
        const result = item.kind === "comment" && executor.executeComment
          ? await executor.executeComment({ jobItem: item, composer, media })
          : await executor.executePost({ jobItem: item, composer, media });
        item.status = result.status;
        item.postUrl = result.postUrl;
        item.finishedAt = this.now();
      } catch (error) {
        item.status = "error";
        item.error = error instanceof Error ? error.message : "Đăng bài thất bại";
        item.finishedAt = this.now();
      }
      job.updatedAt = this.now();
      await this.options.store.put("post-jobs", job);
    }
    job.status = summarizeStatus(job.items.map((item) => item.status));
    job.updatedAt = this.now();
    await this.options.store.put("post-jobs", job);
    return job;
  }

  async receipt(): Promise<PostReceipt> {
    const jobs = await this.listJobs();
    return {
      receiptVersion: 1,
      executor: "mock",
      sideEffect: false,
      jobs: jobs.map((job) => ({
        jobId: job.id,
        itemCount: job.items.length,
        statuses: job.items.map((item) => item.status),
        mode: job.mode,
        destination: job.destination,
      })),
      generatedAt: this.now(),
    };
  }
}

export class PostServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errors: PostValidationError[],
  ) {
    super(errors.map((error) => error.message).join("; "));
    this.name = "PostServiceError";
  }
}

export class MockPostExecutor implements PostExecutor {
  readonly calls: Array<{ itemId: string; kind: "post" | "comment"; mediaCount: number }> = [];

  async executePost(input: { jobItem: PostJobItem; composer: ComposerState; media: MediaInput[] }): Promise<{ status: "success"; postUrl: string }> {
    this.calls.push({ itemId: input.jobItem.id, kind: "post", mediaCount: input.media.length });
    return { status: "success", postUrl: `mock://post/${input.jobItem.id}` };
  }

  async executeComment(input: { jobItem: PostJobItem; composer: ComposerState; media: MediaInput[] }): Promise<{ status: "success"; postUrl: string }> {
    this.calls.push({ itemId: input.jobItem.id, kind: "comment", mediaCount: input.media.length });
    return { status: "success", postUrl: `mock://comment/${input.jobItem.id}` };
  }
}

export function validateDraft(draft: PostDraft): PostValidationError[] {
  const errors: PostValidationError[] = [];
  const interval = normalizeInterval(draft.fromSec, draft.toSec, draft.antiSpam);
  if (interval.error) errors.push(interval.error);
  const postContentRequired = draft.mode !== "comment";
  const hasPostContent = hasPublishableContent(draft);
  if (postContentRequired && !hasPostContent) {
    errors.push({ code: "CONTENT_REQUIRED", field: "composers", message: "Vui lòng nhập nội dung, chọn phông nền, chọn ảnh/video hoặc dán link" });
  }
  if (draft.destination !== "group" && draft.leaveGroupAfterPost) {
    errors.push({ code: "LEAVE_GROUP_REQUIRES_GROUP", field: "leaveGroupAfterPost", message: "Rời nhóm chỉ áp dụng khi đăng vào nhóm" });
  }
  const commentRequired = draft.mode === "comment" || draft.mode === "post+comment" || draft.comment.enabled;
  if (commentRequired) {
    const comment = draft.comment.contents[draft.comment.activeTab];
    const hasComment = comment && hasPublishableContent({ activeTab: draft.comment.activeTab, composers: { [draft.comment.activeTab]: comment }, mediaByTab: { [draft.comment.activeTab]: draft.comment.media } });
    if (!hasComment) errors.push({ code: "COMMENT_CONTENT_REQUIRED", field: "comment", message: "Vui lòng nhập nội dung bình luận hoặc chọn ảnh" });
  }
  for (const [tab, files] of Object.entries(draft.mediaByTab ?? {}) as Array<[string, MediaInput[]]>) {
    for (const file of files ?? []) {
      const error = validateMedia(file);
      if (error) errors.push({ ...error, field: `mediaByTab.${tab}` });
    }
  }
  return errors;
}

function buildJobItems(
  draft: PostDraft,
  groups: string[],
  accountId: string | undefined,
  maxItems: number | undefined,
  id: () => string,
  now: () => string,
): PostJobItem[] {
  const tabs = Object.keys(draft.composers)
    .map(Number)
    .filter((tab) => hasPublishableContent({ activeTab: tab, composers: draft.composers, mediaByTab: draft.mediaByTab }))
    .sort((a, b) => a - b);
  const commentOnly = draft.mode === "comment";
  const postAndComment = draft.mode === "post+comment" || draft.comment.enabled;
  if (!tabs.length && !commentOnly) return [];
  const activeTabs = tabs.length ? tabs : [draft.comment.activeTab];
  const pairs: Array<{ groupId: string; tab: number; kind: "post" | "comment" }> = [];
  if (!commentOnly) {
    if (draft.mode === "sequential") {
      for (const groupId of groups) for (const tab of activeTabs) pairs.push({ groupId, tab, kind: "post" });
    } else if (draft.mode === "cross") {
      groups.forEach((groupId, index) => pairs.push({ groupId, tab: activeTabs[index % activeTabs.length], kind: "post" }));
    } else {
      groups.forEach((groupId, index) => pairs.push({ groupId, tab: activeTabs[index % activeTabs.length], kind: "post" }));
    }
  }
  if (postAndComment || commentOnly) {
    for (const groupId of groups) pairs.push({ groupId, tab: draft.comment.activeTab, kind: "comment" });
  }
  return pairs.slice(0, maxItems ?? Number.POSITIVE_INFINITY).map(({ groupId, tab, kind }) => {
    const isComment = kind === "comment";
    const composer = isComment ? draft.comment.contents[tab] ?? draft.composers[tab] : draft.composers[tab];
    const media = isComment ? draft.comment.media : (draft.mediaByTab[tab] ?? []);
    return {
      id: id(),
      jobId: "",
      groupId,
      accountId,
      kind: isComment ? "comment" : "post",
      mode: draft.mode,
      destination: draft.destination,
      contentTab: tab,
      status: "queued",
      contentPreview: composer.text.trim().replace(/\s+/g, " ").slice(0, 80),
      mediaCount: media.length,
      startedAt: now(),
    };
  });
}

function summarizeStatus(statuses: JobStatus[]): JobStatus {
  if (!statuses.length) return "error";
  if (statuses.every((status) => status === "success")) return "success";
  if (statuses.every((status) => status === "approval")) return "approval";
  if (statuses.some((status) => status === "success" || status === "approval")) return "success";
  if (statuses.some((status) => status === "stopped")) return "stopped";
  return "error";
}
