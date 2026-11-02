/**
 * Shared group workflow contracts.
 *
 * This module deliberately contains public group metadata only.  It must not
 * grow fields for member profiles, phone numbers, email addresses, or other
 * personal data.  The web and API workers can depend on these types without
 * coupling their implementation details.
 */

/** Supports the API's lowercase plan codes and UI's uppercase labels. */
export type PlanCode = "BASIC" | "PLUS" | "PRO" | "MAX" | "basic" | "plus" | "pro" | "max";

export type GroupJoinStatus = "joined" | "pending" | "rejected";
export type MembershipStatus = "joined" | "pending" | "rejected" | "left";

export interface PublicGroupMetadata {
  id: string;
  uid: string;
  url?: string;
  name: string;
  topic?: string;
  memberCount: number;
  postsPerDay: number;
  approvalRequired: boolean;
  /** True only when this group is visible through public metadata discovery. */
  isPublic: boolean;
  /** Whether the current account is an admin or moderator of this group. */
  isAdminOrModerator?: boolean;
  /** Public aggregate count, never a list of member identities. */
  newMembersLastDay?: number;
  indexedAt: string;
}

export interface JoinQuestionAnswer {
  question: string;
  answer: string;
}

export interface JoinGroupInput {
  accountId: string;
  /** Either a public group UID or a public group URL is accepted. */
  groupIdOrUrl: string;
  questionAnswers?: JoinQuestionAnswer[];
  /** Minimum delay between join operations, in seconds. Must be >= 10. */
  delayFromSeconds?: number;
  /** Maximum delay between join operations, in seconds. */
  delayToSeconds?: number;
}

export interface JoinGroupResult {
  membershipId: string;
  group: PublicGroupMetadata;
  status: GroupJoinStatus;
  questionAnswers: JoinQuestionAnswer[];
  receipt: ExecutorReceipt;
  createdAt: string;
}

export interface LeaveGroupInput {
  accountId: string;
  groupId: string;
  /** Originating toggle is /post; API remains the source of truth. */
  leaveAfterPost: boolean;
}

export interface BatchLeaveInput {
  accountId: string;
  groupIds: string[];
  leaveAfterPost: boolean;
}

export interface LeaveGroupResult {
  membershipId: string;
  groupId: string;
  status: "left" | "rejected";
  receipt: ExecutorReceipt;
}

export interface GroupLibraryFilters {
  keyword?: string;
  topic?: string;
  minMembers?: number;
  maxMembers?: number;
  minPostsPerDay?: number;
  maxPostsPerDay?: number;
  approvalRequired?: boolean;
  collectionId?: string;
}

export interface GroupCollection {
  id: string;
  name: string;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AddToCollectionInput {
  name?: string;
  collectionId?: string;
  groupId: string;
}

export interface AutoApproveSettings {
  groupId: string;
  enabled: boolean;
  /** When true, suspected-spam requests are included; default is false. */
  approveSuspectedSpam: boolean;
  updatedAt: string;
}

export interface PendingMember {
  requestId: string;
  groupId: string;
  /** Public moderation state only; no personal profile data is persisted. */
  suspectedSpam: boolean;
  requestedAt: string;
}

export interface AutoApproveResult {
  groupId: string;
  approvedRequestIds: string[];
  skippedRequestIds: string[];
  receipt: ExecutorReceipt;
}

export type ExecutorAction =
  | "group.join"
  | "group.leave"
  | "group.invite-new-members"
  | "group.approve-member";

export interface ExecutorReceipt {
  id: string;
  action: ExecutorAction;
  mode: "mock" | "live";
  accepted: boolean;
  status?: GroupJoinStatus | "left" | "approved" | "invited" | "rejected";
  /** A deterministic, local reason is safe to expose in E2E receipts. */
  reason?: string;
  createdAt: string;
}

export interface GroupExecutor {
  readonly mode: "mock" | "live";
  joinGroup(input: {
    accountId: string;
    group: PublicGroupMetadata;
    questionAnswers: JoinQuestionAnswer[];
  }): Promise<ExecutorReceipt>;
  leaveGroup(input: {
    accountId: string;
    group: PublicGroupMetadata;
  }): Promise<ExecutorReceipt>;
  inviteNewMembers(input: {
    accountId: string;
    group: PublicGroupMetadata;
    count: number;
  }): Promise<ExecutorReceipt>;
  approveMember(input: {
    accountId: string;
    group: PublicGroupMetadata;
    requestId: string;
    suspectedSpam: boolean;
  }): Promise<ExecutorReceipt>;
}

export interface GroupServiceContext {
  userId: string;
  plan: PlanCode;
  /** Live actions require an explicit Nam-provided clone gate. */
  liveGate?: "NAM_CLONE_PRIVATE_TEST_GROUP";
}

export interface GroupStore {
  groups: Map<string, PublicGroupMetadata>;
  memberships: Map<string, {
    id: string;
    userId: string;
    accountId: string;
    groupId: string;
    status: MembershipStatus;
    questionAnswers: JoinQuestionAnswer[];
    createdAt: string;
    updatedAt: string;
  }>;
  collections: Map<string, GroupCollection>;
  autoApprove: Map<string, AutoApproveSettings>;
  pendingMembers: Map<string, PendingMember>;
  leaveAfterPost: Map<string, boolean>;
}

export interface LeaveAfterPostToggle {
  groupId: string;
  enabled: boolean;
}

export const GROUP_FEATURES = {
  join: "PRO4",
  leave: "PRO4",
  library: "PRO4",
  autoApprove: "PRO6",
  newMemberInvites: "PRO4",
} as const;

