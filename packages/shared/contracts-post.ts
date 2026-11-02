/**
 * Shared /post contract.
 *
 * Source pins (REA capture):
 * - plans/.../evidence/reference/index.js:1730192 (`UXe`, posting modes)
 * - plans/.../evidence/reference/index.js:1723904 (`yL`, composer)
 * - plans/.../evidence/reference/index.js:1725105 (`Vde`, default toggles)
 * - plans/.../evidence/reference/index.js:1725240 (`zXe`, 500 MiB and media types)
 * - plans/.../evidence/reference/index.js:176? (`nL`, interval and anti-spam controls)
 * - plans/.../evidence/reference/index.js:1781891 (template API)
 *
 * The captured bundle exposes three core mode keys. The BASIC/PLUS checklist
 * calls out two and five modes, but does not identify the tier mapping. Keep
 * the evidence-backed keys and mark the tier mapping as UNKNOWN instead of
 * silently inventing a Facebook behavior.
 */

export const POST_TABS = 8 as const;
export const MAX_MEDIA_BYTES = 500 * 1024 * 1024;
export const MIN_INTERVAL_SECONDS = 10;
export const ANTI_SPAM_MIN_INTERVAL_SECONDS = 60;
export const DEFAULT_INTERVAL = { fromSec: 30, toSec: 60 } as const;

/**
 * REA exposes three distribution modes plus two execution modes in the job
 * summary (`oD`): comment-only and post+comment. BASIC exposes the first two;
 * PLUS exposes all five. The exact commercial tier gate is a product rule,
 * while these keys and labels are source-backed.
 */
export type PostMode = "sequential" | "cross" | "parallel" | "comment" | "post+comment";
export type MentionMode = "none" | "highlight" | "everyone";
export type Destination = "group" | "profile" | "page";
export type JobKind = "post" | "comment" | "leave-group" | "delete-post";
export type JobStatus = "queued" | "running" | "success" | "approval" | "error" | "stopped";

export interface ComposerToggles {
  /** REA label: Tự động tag mọi người/nêu bật. */
  autoTag: boolean;
  /** REA default is true; disables Marketplace formatting. */
  disableMarketplace: boolean;
  /** REA default is true; per-post media order is randomized by the executor. */
  shuffleMedia: boolean;
  mentionMode: MentionMode;
}

export interface ComposerState {
  text: string;
  link?: string;
  backgroundIds: string[];
  toggles: ComposerToggles;
}

export interface MediaInput {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Local persistence reference; never a cookie/token/session value. */
  storageKey?: string;
  sortOrder: number;
}

export interface CommentScenario {
  enabled: boolean;
  activeTab: number;
  contents: Record<number, ComposerState>;
  media: MediaInput[];
}

export interface PostDraft {
  id: string;
  accountId?: string;
  title?: string;
  activeTab: number;
  mode: PostMode;
  destination: Destination;
  wallShareEnabled: boolean;
  composers: Record<number, ComposerState>;
  mediaByTab: Record<number, MediaInput[]>;
  comment: CommentScenario;
  fromSec: number;
  toSec: number;
  antiSpam: boolean;
  leaveGroupAfterPost: boolean;
  groupIds: string[];
  planTier: "BASIC" | "PLUS" | "PRO";
  createdAt: string;
  updatedAt: string;
}

export interface PostTemplate {
  id: string;
  name: string;
  draft: Omit<PostDraft, "id" | "createdAt" | "updatedAt">;
  createdAt: string;
  updatedAt: string;
}

export type PostTemplateDraft = PostTemplate["draft"];

export interface PostJobItem {
  id: string;
  jobId: string;
  groupId?: string;
  accountId?: string;
  kind: JobKind;
  mode: PostMode;
  destination: Destination;
  contentTab: number;
  status: JobStatus;
  contentPreview: string;
  mediaCount: number;
  error?: string;
  postUrl?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface PostJob {
  id: string;
  draftId: string;
  status: JobStatus;
  mode: PostMode;
  destination: Destination;
  wallShareEnabled: boolean;
  antiSpam: boolean;
  fromSec: number;
  toSec: number;
  leaveGroupAfterPost: boolean;
  items: PostJobItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PostExecutor {
  executePost(input: {
    jobItem: PostJobItem;
    composer: ComposerState;
    media: MediaInput[];
  }): Promise<{ status: "success" | "approval"; postUrl?: string }>;
  executeComment?(input: {
    jobItem: PostJobItem;
    composer: ComposerState;
    media: MediaInput[];
  }): Promise<{ status: "success" | "approval"; postUrl?: string }>;
  executeLeaveGroup?(groupId: string, accountId?: string): Promise<{ status: "success" | "approval" }>;
}

export interface PostApiError {
  code: string;
  message: string;
  field?: string;
}

export interface PostReceipt {
  receiptVersion: 1;
  executor: "mock" | "external";
  sideEffect: false;
  jobs: Array<{
    jobId: string;
    itemCount: number;
    statuses: JobStatus[];
    mode: PostMode;
    destination: Destination;
  }>;
  generatedAt: string;
}

export const DEFAULT_TOGGLES: ComposerToggles = {
  autoTag: false,
  disableMarketplace: true,
  shuffleMedia: true,
  mentionMode: "none",
};

export const DEFAULT_COMPOSER: ComposerState = {
  text: "",
  backgroundIds: [],
  toggles: { ...DEFAULT_TOGGLES },
};

export const CORE_MODES: ReadonlyArray<{
  key: PostMode;
  label: string;
  evidence: string;
}> = [
  {
    key: "sequential",
    label: "Đăng lần lượt — mỗi nhóm đủ tất cả bài",
    evidence: "index.js:1730192 UXe[0]",
  },
  {
    key: "cross",
    label: "Đăng ngẫu nhiên — mỗi nhóm nhận một content",
    evidence: "index.js:1730192 UXe[1]",
  },
  {
    key: "parallel",
    label: "Đăng song song — bài 1→nhóm 1, bài 2→nhóm 2, …",
    evidence: "index.js:1730192 UXe[2]",
  },
  {
    key: "comment",
    label: "Bình luận — kịch bản theo nhóm",
    evidence: "index.js:1797560 oD(mode=comment)",
  },
  {
    key: "post+comment",
    label: "Đăng bài + bình luận",
    evidence: "index.js:1797560 oD(mode=post+comment)",
  },
];

/** UI exposes 8 tabs in the captured layout; content itself is per-tab. */
export function tabNumbers(): number[] {
  return Array.from({ length: POST_TABS }, (_, index) => index + 1);
}

export function defaultComposer(): ComposerState {
  return {
    text: DEFAULT_COMPOSER.text,
    backgroundIds: [],
    toggles: { ...DEFAULT_TOGGLES },
  };
}

export function defaultDraft(now = new Date().toISOString()): PostDraft {
  const composers: Record<number, ComposerState> = {};
  const mediaByTab: Record<number, MediaInput[]> = {};
  for (const tab of tabNumbers()) {
    composers[tab] = defaultComposer();
    mediaByTab[tab] = [];
  }
  return {
    id: "",
    activeTab: 1,
    mode: "sequential",
    destination: "group",
    wallShareEnabled: false,
    composers,
    mediaByTab,
    comment: {
      enabled: false,
      activeTab: 1,
      contents: {},
      media: [],
    },
    fromSec: DEFAULT_INTERVAL.fromSec,
    toSec: DEFAULT_INTERVAL.toSec,
    antiSpam: false,
    leaveGroupAfterPost: false,
    groupIds: [],
    planTier: "BASIC",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeInterval(fromSec: number, toSec: number, antiSpam: boolean): {
  fromSec: number;
  toSec: number;
  error?: PostApiError;
} {
  const from = Number.isFinite(fromSec) ? Math.floor(fromSec) : DEFAULT_INTERVAL.fromSec;
  const to = Number.isFinite(toSec) ? Math.floor(toSec) : DEFAULT_INTERVAL.toSec;
  const minimum = antiSpam ? ANTI_SPAM_MIN_INTERVAL_SECONDS : MIN_INTERVAL_SECONDS;
  if (from < minimum || to < minimum) {
    return {
      fromSec: Math.max(from, minimum),
      toSec: Math.max(to, minimum),
      error: {
        code: "INTERVAL_TOO_SHORT",
        field: "fromSec",
        message: antiSpam
          ? "Né spam bật — khoảng cách tối thiểu là 60 giây/lần"
          : "Khoảng cách tối thiểu là 10 giây/lần",
      },
    };
  }
  if (to < from) {
    return {
      fromSec: from,
      toSec: from,
      error: { code: "INTERVAL_ORDER", field: "toSec", message: "Đến (giây) phải lớn hơn hoặc bằng Từ (giây)" },
    };
  }
  return { fromSec: from, toSec: to };
}

export function validateMedia(media: Pick<MediaInput, "name" | "mimeType" | "sizeBytes">, comment = false): PostApiError | undefined {
  if (!Number.isFinite(media.sizeBytes) || media.sizeBytes <= 0) {
    return { code: "MEDIA_SIZE_INVALID", field: "sizeBytes", message: "Dung lượng tệp không hợp lệ" };
  }
  if (media.sizeBytes > MAX_MEDIA_BYTES) {
    return { code: "MEDIA_TOO_LARGE", field: "sizeBytes", message: "Tệp vượt quá dung lượng tối đa 500mb" };
  }
  const type = String(media.mimeType || "").toLowerCase();
  const name = String(media.name || "").toLowerCase();
  const isImage = type.startsWith("image/");
  const isMp4 = type === "video/mp4" || name.endsWith(".mp4");
  if (comment ? !isImage : !isImage && !isMp4) {
    return {
      code: "MEDIA_TYPE_UNSUPPORTED",
      field: "mimeType",
      message: comment ? "Bình luận chỉ hỗ trợ ảnh" : "Chỉ hỗ trợ ảnh hoặc video MP4",
    };
  }
  return undefined;
}

export function reorderMedia(media: MediaInput[], fromIndex: number, toIndex: number): MediaInput[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= media.length || toIndex >= media.length) return media.slice();
  const next = media.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next.map((entry, sortOrder) => ({ ...entry, sortOrder }));
}

export function hasPublishableContent(draft: Pick<PostDraft, "activeTab" | "composers" | "mediaByTab">): boolean {
  const composer = draft.composers[draft.activeTab] ?? DEFAULT_COMPOSER;
  const text = composer.text.trim();
  const hasBackground = composer.backgroundIds.length > 0;
  const hasMedia = (draft.mediaByTab[draft.activeTab] ?? []).length > 0;
  return Boolean(text || hasBackground || hasMedia);
}

export function buildMentionText(text: string, mentionMode: MentionMode): string {
  if (mentionMode === "highlight") return `${text}${text ? " " : ""}@nêu bật`;
  if (mentionMode === "everyone") return `${text}${text ? " " : ""}@mọi người`;
  return text;
}
