import type { PublicGroupMetadata } from "../../../../packages/shared/contracts-groups.js";
import { GroupService } from "./service.js";
import { MockExecutor } from "./executor.js";
import { createGroupStore } from "./store.js";

export interface GroupMockE2EReceipt {
  scenario: "PRO2" | "PRO3" | "PRO4" | "PRO6";
  passed: boolean;
  evidence: Record<string, unknown>;
}

const timestamp = "2026-11-02T00:00:00.000Z";

const publicGroups: PublicGroupMetadata[] = [
  {
    id: "group-architecture",
    uid: "100000001",
    url: "https://www.facebook.com/groups/100000001",
    name: "Kiến trúc và Revit Việt Nam",
    topic: "architecture",
    memberCount: 12500,
    postsPerDay: 18,
    approvalRequired: true,
    isPublic: true,
    isAdminOrModerator: false,
    newMembersLastDay: 42,
    indexedAt: timestamp,
  },
  {
    id: "group-admin",
    uid: "100000002",
    url: "https://www.facebook.com/groups/100000002",
    name: "GroupPilot Test Admin",
    topic: "testing",
    memberCount: 120,
    postsPerDay: 3,
    approvalRequired: false,
    isPublic: true,
    isAdminOrModerator: true,
    newMembersLastDay: 3,
    indexedAt: timestamp,
  },
];

/**
 * Deterministic local proof for group workflows. No HTTP, browser, Facebook,
 * account credentials, or external side effects are used.
 */
export async function runGroupMockE2E(): Promise<GroupMockE2EReceipt[]> {
  const store = createGroupStore({
    groups: publicGroups,
    pendingMembers: [
      { requestId: "request-safe", groupId: "group-admin", suspectedSpam: false, requestedAt: timestamp },
      { requestId: "request-spam", groupId: "group-admin", suspectedSpam: true, requestedAt: timestamp },
    ],
  });
  const service = new GroupService(store, new MockExecutor());
  const context = { userId: "mock-user", plan: "PRO" as const };

  const joined = await service.join(context, {
    accountId: "mock-account",
    groupIdOrUrl: "100000001",
    questionAnswers: [{ question: "Bạn biết nhóm từ đâu?", answer: "Thư viện public" }],
    delayFromSeconds: 10,
    delayToSeconds: 30,
  });
  const library = service.listLibrary(context, { keyword: "Revit", minMembers: 1000, approvalRequired: true });
  const collection = await service.addToCollection(context, { name: "Nhóm kiến trúc", groupId: "group-architecture" });
  const leaveToggle = await service.setLeaveAfterPost(context, { groupId: "group-architecture", enabled: true });
  const left = await service.batchLeave(context, { accountId: "mock-account", groupIds: ["group-architecture"], leaveAfterPost: true });

  const safeOnly = await service.configureAutoApprove(context, { groupId: "group-admin", enabled: true, approveSuspectedSpam: false });
  const safeRun = await service.runAutoApprove(context, "mock-account", "group-admin");
  const approveSpam = await service.configureAutoApprove(context, { groupId: "group-admin", enabled: true, approveSuspectedSpam: true });
  const spamRun = await service.runAutoApprove(context, "mock-account", "group-admin");

  return [
    {
      scenario: "PRO2",
      passed: joined.status === "pending" && joined.receipt.mode === "mock" && joined.questionAnswers.length === 1,
      evidence: { membershipId: joined.membershipId, status: joined.status, receipt: joined.receipt },
    },
    {
      scenario: "PRO3",
      passed: library.length === 1 && collection.groupIds.includes("group-architecture") && leaveToggle.enabled && left[0]?.status === "left",
      evidence: { libraryIds: library.map((group) => group.id), collectionId: collection.id, leaveToggle, leaveReceipt: left[0]?.receipt },
    },
    {
      scenario: "PRO4",
      passed: service.listLibrary(context, { topic: "architecture" }).every((group) => group.isPublic) && joined.receipt.action === "group.join",
      evidence: { publicOnly: true, joinReceipt: joined.receipt.id, groupCount: service.listLibrary(context).length },
    },
    {
      scenario: "PRO6",
      passed: safeOnly.approveSuspectedSpam === false && safeRun.approvedRequestIds.includes("request-safe") && safeRun.skippedRequestIds.includes("request-spam") && approveSpam.approveSuspectedSpam && spamRun.approvedRequestIds.includes("request-spam"),
      evidence: { safeRun, spamRun },
    },
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGroupMockE2E().then((receipts) => {
    process.stdout.write(`${JSON.stringify({ receipts }, null, 2)}\n`);
    process.exitCode = receipts.every((receipt) => receipt.passed) ? 0 : 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

