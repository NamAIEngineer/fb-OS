/**
 * Campaign domain contracts.  These contracts describe local campaign state
 * and public group aggregates only; no Facebook member profile data is stored.
 */

export type CampaignStatus = "pending" | "fulfilled" | "rejected";
export type CampaignDeleteFilter = "all" | "pending" | "fulfilled";
export type CampaignMode =
  | "group"
  | "profile"
  | "link"
  | "profile-to-group";

export interface CampaignPost {
  id: string;
  userId: string;
  accountId: string;
  groupId: string;
  groupName: string;
  content: string;
  mode: CampaignMode;
  status: CampaignStatus;
  saved: boolean;
  permalink?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignActionType =
  | "bump"
  | "comment-outreach"
  | "link-share"
  | "profile-to-group-share";

export interface CampaignActionReceipt {
  id: string;
  action: CampaignActionType;
  mode: "mock" | "live";
  accepted: boolean;
  status: "queued" | "fulfilled" | "rejected";
  postId: string;
  count?: number;
  createdAt: string;
  reason?: string;
}

export interface GroupStat {
  id: string;
  uid: string;
  name: string;
  memberCount: number;
  postsPerDay: number;
  newMembers: number;
  approvalRequired: boolean;
  isPublic: boolean;
  updatedAt: string;
}

export interface GroupCollectionRecord {
  id: string;
  userId: string;
  name: string;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignReportRow {
  postId: string;
  groupName: string;
  status: CampaignStatus;
  mode: CampaignMode;
  createdAt: string;
  updatedAt: string;
  actionCount: number;
}

export interface CampaignStoreState {
  posts: CampaignPost[];
  actions: CampaignActionReceipt[];
  groupStats: GroupStat[];
  collections: GroupCollectionRecord[];
}

export interface CampaignStore {
  load(): Promise<CampaignStoreState>;
  save(next: CampaignStoreState): Promise<void>;
}

export interface CampaignContext {
  userId: string;
  plan: "BASIC" | "PLUS" | "PRO" | "MAX";
}

export interface CampaignExecutor {
  readonly mode: "mock" | "live";
  execute(input: {
    action: CampaignActionType;
    post: CampaignPost;
    count?: number;
    text?: string;
    url?: string;
  }): Promise<Omit<CampaignActionReceipt, "id" | "createdAt" | "postId">>;
}

export interface CampaignServiceOptions {
  store?: CampaignStore;
  executor?: CampaignExecutor;
  now?: () => string;
  id?: (prefix: string) => string;
}
