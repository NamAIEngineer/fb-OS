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
export declare const POST_TABS: 8;
export declare const MAX_MEDIA_BYTES: number;
export declare const MIN_INTERVAL_SECONDS = 10;
export declare const ANTI_SPAM_MIN_INTERVAL_SECONDS = 60;
export declare const DEFAULT_INTERVAL: {
    readonly fromSec: 30;
    readonly toSec: 60;
};
export type PostMode = "sequential" | "cross" | "parallel";
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
    }): Promise<{
        status: "success" | "approval";
        postUrl?: string;
    }>;
    executeComment?(input: {
        jobItem: PostJobItem;
        composer: ComposerState;
        media: MediaInput[];
    }): Promise<{
        status: "success" | "approval";
        postUrl?: string;
    }>;
    executeLeaveGroup?(groupId: string, accountId?: string): Promise<{
        status: "success" | "approval";
    }>;
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
export declare const DEFAULT_TOGGLES: ComposerToggles;
export declare const DEFAULT_COMPOSER: ComposerState;
export declare const CORE_MODES: ReadonlyArray<{
    key: PostMode;
    label: string;
    evidence: string;
}>;
/** UI exposes 8 tabs in the captured layout; content itself is per-tab. */
export declare function tabNumbers(): number[];
export declare function defaultComposer(): ComposerState;
export declare function defaultDraft(now?: string): PostDraft;
export declare function normalizeInterval(fromSec: number, toSec: number, antiSpam: boolean): {
    fromSec: number;
    toSec: number;
    error?: PostApiError;
};
export declare function validateMedia(media: Pick<MediaInput, "name" | "mimeType" | "sizeBytes">, comment?: boolean): PostApiError | undefined;
export declare function reorderMedia(media: MediaInput[], fromIndex: number, toIndex: number): MediaInput[];
export declare function hasPublishableContent(draft: Pick<PostDraft, "activeTab" | "composers" | "mediaByTab">): boolean;
export declare function buildMentionText(text: string, mentionMode: MentionMode): string;
