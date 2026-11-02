/**
 * Interaction surfaces contract.
 *
 * The contract is deliberately local/mock-first.  A receipt proves that the
 * requested operation was accepted by MockExecutor; it never claims a live
 * Facebook side effect.  Friend rows are UI state and are not exportable.
 */

export const INTERACTION_ACTIONS = [
  "poke",
  "unfriend",
  "cancelRequest",
  "comment",
  "like",
  "addFriend",
] as const;

export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

export const INTERACTION_FILTERS = [
  "commented",
  "liked",
  "messaged",
  "lastInteraction",
  "none",
] as const;

export type InteractionFilter = (typeof INTERACTION_FILTERS)[number];

export type PlanTier = "BASIC" | "PLUS" | "PRO";

export type EightTab = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface FriendRecord {
  /** A platform identifier used only to target a local/mock action. */
  uid: string;
  /** Display values needed by the friend table; never exported. */
  name: string;
  link?: string;
  image?: string;
  commentCount?: number;
  likeCount?: number;
  messageCount?: number;
  lastMessageAt?: string;
  lastInteractionAt?: string;
}

export interface InteractionFilterInput {
  filter: InteractionFilter;
  /** ISO date used only by the lastInteraction filter. */
  since?: string;
}

export interface InteractionComposer {
  text: string;
  mediaRefs: string[];
}

export type EightTabComposer = Partial<Record<EightTab, InteractionComposer>>;

export interface InteractionTaskBar {
  fromSec: number;
  toSec: number;
  antiSpam: boolean;
}

export interface InteractionRequest {
  accountId: string;
  action: InteractionAction;
  friendIds: string[];
  filter?: InteractionFilterInput;
  composers?: EightTabComposer;
  taskBar?: InteractionTaskBar;
}

export interface MockReceipt {
  receiptId: string;
  action: InteractionAction;
  accountId: string;
  targetUid: string;
  status: "success" | "error";
  /** Explicitly prevents a mock receipt being mistaken for publication. */
  externalSideEffect: false;
  executor: "mock";
  createdAt: string;
  error?: string;
}

export interface InteractionRun {
  runId: string;
  request: InteractionRequest;
  receipts: MockReceipt[];
  running: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface InteractionExecutor {
  execute(request: InteractionRequest): Promise<MockReceipt[]>;
}

export interface InteractionStore {
  listFriends(accountId: string): Promise<FriendRecord[]>;
  replaceFriends(accountId: string, friends: FriendRecord[]): Promise<void>;
  listCollections(accountId: string): Promise<FriendCollection[]>;
  saveCollection(collection: FriendCollection): Promise<FriendCollection>;
  deleteCollection(accountId: string, collectionId: string): Promise<boolean>;
  saveRun(run: InteractionRun): Promise<InteractionRun>;
  getRun(accountId: string, runId: string): Promise<InteractionRun | undefined>;
  listRuns(accountId: string): Promise<InteractionRun[]>;
}

export interface FriendCollection {
  id: string;
  accountId: string;
  name: string;
  friendIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentTabContent {
  tab: EightTab;
  text: string;
  mediaRefs: string[];
}

export interface AutoCommentScript {
  id: string;
  name: string;
  keywords: string[];
  tabContents: CommentTabContent[];
  createdAt: string;
  updatedAt: string;
}

export interface AutoCommentScriptInput {
  name: string;
  keywords: string[];
  tabContents: CommentTabContent[];
}

export interface AutoCommentStore {
  listScripts(accountId: string, search?: string): Promise<AutoCommentScript[]>;
  getScript(accountId: string, scriptId: string): Promise<AutoCommentScript | undefined>;
  saveScript(accountId: string, input: AutoCommentScriptInput, scriptId?: string): Promise<AutoCommentScript>;
  deleteScript(accountId: string, scriptId: string): Promise<boolean>;
  listReceipts(accountId: string): Promise<AutoCommentReceipt[]>;
  saveReceipt(receipt: AutoCommentReceipt): Promise<AutoCommentReceipt>;
}

export interface AutoCommentScanRequest {
  accountId: string;
  groupIds: string[];
  scriptIds: string[];
  fromSec: number;
  toSec: number;
  antiSpam: boolean;
}

export interface AutoCommentPost {
  groupId: string;
  feedbackId: string;
  text: string;
  postUrl?: string;
}

export interface AutoCommentReceipt {
  receiptId: string;
  accountId: string;
  groupId: string;
  feedbackId: string;
  scriptId?: string;
  matchedKeyword?: string;
  status: "success" | "skipped" | "error";
  executor: "mock";
  externalSideEffect: false;
  createdAt: string;
  error?: string;
}

export interface AutoCommentExecutor {
  comment(input: {
    accountId: string;
    groupId: string;
    feedbackId: string;
    content: CommentTabContent;
    postUrl?: string;
  }): Promise<AutoCommentReceipt>;
}

export interface PageComment {
  pageId: string;
  postId: string;
  commentId: string;
  text: string;
  createdAt?: string;
}

export type PageCommentAction = "reply" | "like";

export interface PageCommentRequest {
  accountId: string;
  pageId: string;
  commentId: string;
  action: PageCommentAction;
  replyText?: string;
  scriptId?: string;
}

export interface PageCommentStore {
  listComments(accountId: string, pageId: string): Promise<PageComment[]>;
  saveReceipt(receipt: PageCommentReceipt): Promise<PageCommentReceipt>;
  listReceipts(accountId: string, pageId?: string): Promise<PageCommentReceipt[]>;
}

export interface PageCommentReceipt {
  receiptId: string;
  accountId: string;
  pageId: string;
  commentId: string;
  action: PageCommentAction;
  status: "success" | "error";
  executor: "mock";
  externalSideEffect: false;
  createdAt: string;
  error?: string;
}

export interface SocketEvent<T = unknown> {
  type:
    | "interaction.started"
    | "interaction.receipt"
    | "interaction.completed"
    | "auto-comment.scanned"
    | "auto-comment.receipt"
    | "page-comment.receipt";
  runId?: string;
  payload: T;
  emittedAt: string;
}

export class PlanRequiredError extends Error {
  readonly code = "PLAN_REQUIRED";
  readonly requiredPlan: PlanTier;

  constructor(requiredPlan: PlanTier = "PRO") {
    super(`Gói ${requiredPlan} là bắt buộc cho tính năng này`);
    this.name = "PlanRequiredError";
    this.requiredPlan = requiredPlan;
  }
}

export function assertPlan(plan: PlanTier | undefined, required: PlanTier): void {
  const rank: Record<PlanTier, number> = { BASIC: 1, PLUS: 2, PRO: 3 };
  if (!plan || rank[plan] < rank[required]) throw new PlanRequiredError(required);
}

export function normalizeKeyword(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchKeyword(text: string, keywords: string[]): string | undefined {
  const normalizedText = normalizeKeyword(text);
  return keywords.find((keyword) => {
    const normalized = normalizeKeyword(keyword);
    return normalized.length > 0 && normalizedText.includes(normalized);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function localId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

/**
 * Keep the server and UI honest about the supported interaction table.  This
 * intentionally has no CSV/export counterpart: personal commenter/reaction
 * exports are outside this run.
 */
export function publicFriendRow(friend: FriendRecord): Omit<FriendRecord, "image"> {
  const { image: _image, ...row } = friend;
  return row;
}
