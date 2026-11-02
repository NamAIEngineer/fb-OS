import type {
  AddToCollectionInput,
  AutoApproveResult,
  AutoApproveSettings,
  BatchLeaveInput,
  GroupCollection,
  GroupExecutor,
  GroupLibraryFilters,
  GroupServiceContext,
  GroupStore,
  JoinGroupInput,
  JoinGroupResult,
  LeaveAfterPostToggle,
  LeaveGroupInput,
  LeaveGroupResult,
  PendingMember,
  PublicGroupMetadata,
} from "../../../../packages/shared/contracts-groups.js";
import { MockExecutor } from "./executor.js";
import type { PersistableGroupStore } from "./store.js";

const PRO_PLANS = new Set(["PRO", "MAX", "pro", "max"]);

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function assertPositiveInteger(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
    throw new Error(`INVALID_${label.toUpperCase()}`);
  }
}

/**
 * API domain service.  It is framework-neutral so the host can mount it in
 * Express, Fastify, or the worker's existing HTTP adapter.
 */
export class GroupService {
  constructor(
    private readonly store: PersistableGroupStore,
    private readonly executor: GroupExecutor = new MockExecutor(),
  ) {}

  private requirePro(context: GroupServiceContext, feature: string): void {
    if (!PRO_PLANS.has(context.plan)) {
      throw new Error(`PLAN_REQUIRED:PRO:${feature}`);
    }
  }

  private requireLiveGate(context: GroupServiceContext): void {
    if (this.executor.mode === "live" && context.liveGate !== "NAM_CLONE_PRIVATE_TEST_GROUP") {
      throw new Error("LIVE_GATE_REQUIRED: Nam-provided clone and private test group required");
    }
  }

  private async persist(): Promise<void> {
    if (this.store.persist) await this.store.persist();
  }

  private resolvePublicGroup(groupIdOrUrl: string): PublicGroupMetadata {
    const input = groupIdOrUrl.trim();
    if (!input) throw new Error("GROUP_ID_REQUIRED");

    const direct = this.store.groups.get(input);
    if (direct?.isPublic) return direct;

    const lowered = normalized(input);
    const byUidOrUrl = [...this.store.groups.values()].find((group) => {
      if (!group.isPublic) return false;
      return normalized(group.uid) === lowered || (!!group.url && normalized(group.url) === lowered);
    });
    if (byUidOrUrl) return byUidOrUrl;

    // Do not invent metadata from an arbitrary URL.  Discovery must populate
    // the public library first, keeping unknown groups fail-closed.
    throw new Error("PUBLIC_GROUP_NOT_FOUND");
  }

  async join(context: GroupServiceContext, input: JoinGroupInput): Promise<JoinGroupResult> {
    this.requirePro(context, "PRO4");
    this.requireLiveGate(context);

    const from = input.delayFromSeconds ?? 10;
    const to = input.delayToSeconds ?? from;
    if (!Number.isFinite(from) || from < 10 || !Number.isFinite(to) || to < from) {
      throw new Error("INVALID_DELAY: minimum interval is 10 seconds and delayTo >= delayFrom");
    }

    const group = this.resolvePublicGroup(input.groupIdOrUrl);
    const questionAnswers = (input.questionAnswers ?? []).map((entry: { question: string; answer: string }) => ({
      question: entry.question.trim(),
      answer: entry.answer.trim(),
    }));
    if (questionAnswers.some((entry: { question: string; answer: string }) => !entry.question || !entry.answer)) {
      throw new Error("INVALID_QUESTION_ANSWER");
    }

    const receipt = await this.executor.joinGroup({
      accountId: input.accountId.trim(),
      group,
      questionAnswers,
    });
    const createdAt = now();
    const membershipId = id("membership");
    this.store.memberships.set(membershipId, {
      id: membershipId,
      userId: context.userId,
      accountId: input.accountId,
      groupId: group.id,
      status: receipt.status === "pending" ? "pending" : receipt.status === "rejected" ? "rejected" : "joined",
      questionAnswers,
      createdAt,
      updatedAt: createdAt,
    });
    await this.persist();
    return {
      membershipId,
      group,
      status: receipt.status === "pending" ? "pending" : receipt.status === "rejected" ? "rejected" : "joined",
      questionAnswers,
      receipt,
      createdAt,
    };
  }

  listLibrary(context: GroupServiceContext, filters: GroupLibraryFilters = {}): PublicGroupMetadata[] {
    this.requirePro(context, "PRO4");
    const collectionIds = filters.collectionId
      ? new Set(this.store.collections.get(filters.collectionId)?.groupIds ?? [])
      : undefined;
    const keyword = normalized(filters.keyword ?? "");
    const topic = normalized(filters.topic ?? "");
    const result = [...this.store.groups.values()].filter((group) => {
      if (!group.isPublic) return false;
      if (keyword && !`${normalized(group.name)} ${normalized(group.uid)} ${normalized(group.url ?? "")}`.includes(keyword)) return false;
      if (topic && !normalized(group.topic ?? "").includes(topic)) return false;
      if (filters.minMembers !== undefined && group.memberCount < filters.minMembers) return false;
      if (filters.maxMembers !== undefined && group.memberCount > filters.maxMembers) return false;
      if (filters.minPostsPerDay !== undefined && group.postsPerDay < filters.minPostsPerDay) return false;
      if (filters.maxPostsPerDay !== undefined && group.postsPerDay > filters.maxPostsPerDay) return false;
      if (filters.approvalRequired !== undefined && group.approvalRequired !== filters.approvalRequired) return false;
      if (collectionIds && !collectionIds.has(group.id)) return false;
      return true;
    });
    return result.sort((a, b) => b.memberCount - a.memberCount);
  }

  async setLeaveAfterPost(context: GroupServiceContext, toggle: LeaveAfterPostToggle): Promise<LeaveAfterPostToggle> {
    this.requirePro(context, "PRO4");
    if (!toggle.groupId.trim()) throw new Error("GROUP_ID_REQUIRED");
    if (!this.store.groups.get(toggle.groupId)) throw new Error("GROUP_NOT_FOUND");
    this.store.leaveAfterPost.set(toggle.groupId, Boolean(toggle.enabled));
    await this.persist();
    return { groupId: toggle.groupId, enabled: Boolean(toggle.enabled) };
  }

  getLeaveAfterPost(context: GroupServiceContext, groupId: string): LeaveAfterPostToggle {
    this.requirePro(context, "PRO4");
    return { groupId, enabled: this.store.leaveAfterPost.get(groupId) ?? false };
  }

  private membershipFor(context: GroupServiceContext, accountId: string, groupId: string) {
    return [...this.store.memberships.values()].find(
      (membership) => membership.userId === context.userId && membership.accountId === accountId && membership.groupId === groupId,
    );
  }

  async leave(context: GroupServiceContext, input: LeaveGroupInput): Promise<LeaveGroupResult> {
    this.requirePro(context, "PRO4");
    this.requireLiveGate(context);
    const group = this.store.groups.get(input.groupId);
    if (!group?.isPublic) throw new Error("PUBLIC_GROUP_NOT_FOUND");
    const receipt = await this.executor.leaveGroup({ accountId: input.accountId.trim(), group });
    const membership = this.membershipFor(context, input.accountId, input.groupId);
    const membershipId = membership?.id ?? id("membership");
    const timestamp = now();
    this.store.memberships.set(membershipId, {
      id: membershipId,
      userId: context.userId,
      accountId: input.accountId,
      groupId: input.groupId,
      status: receipt.status === "left" ? "left" : "rejected",
      questionAnswers: membership?.questionAnswers ?? [],
      createdAt: membership?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    this.store.leaveAfterPost.set(input.groupId, Boolean(input.leaveAfterPost));
    await this.persist();
    return { membershipId, groupId: input.groupId, status: receipt.status === "left" ? "left" : "rejected", receipt };
  }

  async batchLeave(context: GroupServiceContext, input: BatchLeaveInput): Promise<LeaveGroupResult[]> {
    this.requirePro(context, "PRO4");
    const uniqueGroupIds = [...new Set(input.groupIds.map((value: string) => value.trim()).filter(Boolean))];
    const results: LeaveGroupResult[] = [];
    for (const groupId of uniqueGroupIds) {
      results.push(await this.leave(context, { accountId: input.accountId, groupId, leaveAfterPost: input.leaveAfterPost }));
    }
    return results;
  }

  async addToCollection(context: GroupServiceContext, input: AddToCollectionInput): Promise<GroupCollection> {
    this.requirePro(context, "PRO4");
    const group = this.store.groups.get(input.groupId);
    if (!group?.isPublic) throw new Error("PUBLIC_GROUP_NOT_FOUND");
    let collection: GroupCollection | undefined;
    if (input.collectionId) collection = this.store.collections.get(input.collectionId);
    if (!collection) {
      const name = input.name?.trim();
      if (!name) throw new Error("COLLECTION_NAME_REQUIRED");
      const timestamp = now();
      collection = { id: id("collection"), name, groupIds: [], createdAt: timestamp, updatedAt: timestamp };
      this.store.collections.set(collection.id, collection);
    }
    if (!collection.groupIds.includes(group.id)) collection.groupIds.push(group.id);
    collection.updatedAt = now();
    await this.persist();
    return collection;
  }

  listCollections(context: GroupServiceContext): GroupCollection[] {
    this.requirePro(context, "PRO4");
    return [...this.store.collections.values()].map((collection) => ({ ...collection, groupIds: [...collection.groupIds] }));
  }

  async configureAutoApprove(context: GroupServiceContext, settings: Omit<AutoApproveSettings, "updatedAt">): Promise<AutoApproveSettings> {
    this.requirePro(context, "PRO6");
    const group = this.store.groups.get(settings.groupId);
    if (!group?.isPublic || !group.isAdminOrModerator) throw new Error("ADMIN_GROUP_REQUIRED");
    const next = { ...settings, approveSuspectedSpam: Boolean(settings.approveSuspectedSpam), updatedAt: now() };
    this.store.autoApprove.set(settings.groupId, next);
    await this.persist();
    return next;
  }

  listPending(context: GroupServiceContext, groupId: string): PendingMember[] {
    this.requirePro(context, "PRO6");
    const group = this.store.groups.get(groupId);
    if (!group?.isPublic || !group.isAdminOrModerator) throw new Error("ADMIN_GROUP_REQUIRED");
    return [...this.store.pendingMembers.values()].filter((member) => member.groupId === groupId);
  }

  async runAutoApprove(context: GroupServiceContext, accountId: string, groupId: string): Promise<AutoApproveResult> {
    this.requirePro(context, "PRO6");
    this.requireLiveGate(context);
    const group = this.store.groups.get(groupId);
    if (!group?.isPublic || !group.isAdminOrModerator) throw new Error("ADMIN_GROUP_REQUIRED");
    const settings = this.store.autoApprove.get(groupId) ?? {
      groupId,
      enabled: false,
      approveSuspectedSpam: false,
      updatedAt: now(),
    };
    if (!settings.enabled) {
      return {
        groupId,
        approvedRequestIds: [],
        skippedRequestIds: [...this.store.pendingMembers.values()].filter((member) => member.groupId === groupId).map((member) => member.requestId),
        receipt: {
          id: id("auto-approve-disabled"),
          action: "group.approve-member",
          mode: this.executor.mode,
          accepted: false,
          status: "rejected",
          reason: "auto-approve-disabled",
          createdAt: now(),
        },
      };
    }

    const approvedRequestIds: string[] = [];
    const skippedRequestIds: string[] = [];
    for (const member of [...this.store.pendingMembers.values()].filter((entry) => entry.groupId === groupId)) {
      if (member.suspectedSpam && !settings.approveSuspectedSpam) {
        skippedRequestIds.push(member.requestId);
        continue;
      }
      const receipt = await this.executor.approveMember({ accountId, group, requestId: member.requestId, suspectedSpam: member.suspectedSpam });
      if (receipt.accepted) {
        approvedRequestIds.push(member.requestId);
        this.store.pendingMembers.delete(member.requestId);
      } else {
        skippedRequestIds.push(member.requestId);
      }
    }
    await this.persist();
    return {
      groupId,
      approvedRequestIds,
      skippedRequestIds,
      receipt: {
        id: id("auto-approve"),
        action: "group.approve-member",
        mode: this.executor.mode,
        accepted: true,
        status: "approved",
        reason: `approved:${approvedRequestIds.length};skipped:${skippedRequestIds.length}`,
        createdAt: now(),
      },
    };
  }

  async inviteNewMembers(context: GroupServiceContext, accountId: string, groupId: string, count?: number) {
    this.requirePro(context, "PRO4");
    this.requireLiveGate(context);
    const group = this.store.groups.get(groupId);
    if (!group?.isPublic || !group.isAdminOrModerator) throw new Error("ADMIN_GROUP_REQUIRED");
    const inviteCount = Math.max(0, Math.floor(count ?? group.newMembersLastDay ?? 0));
    return this.executor.inviteNewMembers({ accountId, group, count: inviteCount });
  }
}

