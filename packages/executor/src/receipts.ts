import type { ExecutionReceipt, ExecutorAction } from "./contracts.js";
import { MockExecutor } from "./mock-executor.js";

const actions: readonly ExecutorAction[] = [
  { kind: "postToGroup", groupId: "group-demo", content: "fixture post" },
  { kind: "postToTimeline", content: "fixture timeline post" },
  { kind: "shareWallPostToGroup", groupId: "group-demo", postId: "post-demo" },
  { kind: "shareStoryToGroup", groupId: "group-demo", storyId: "story-demo" },
  { kind: "comment", targetId: "post-demo", content: "fixture comment" },
  { kind: "like", targetId: "post-demo" },
  { kind: "bump", postId: "post-demo", groupId: "group-demo" },
  { kind: "joinGroup", groupId: "group-demo" },
  { kind: "leaveGroup", groupId: "group-demo" },
  { kind: "deleteGroupPosts", groupId: "group-demo", filter: "pending" },
  {
    kind: "approveMember",
    groupId: "group-demo",
    memberId: "member-demo",
    includeSuspectedSpam: false
  },
  { kind: "inviteFriend", profileId: "profile-demo" },
  { kind: "poke", profileId: "profile-demo" },
  { kind: "unfriend", profileId: "profile-demo" },
  { kind: "cancelFriendRequest", profileId: "profile-demo" },
  {
    kind: "replyPageComment",
    pageId: "page-demo",
    commentId: "comment-demo",
    content: "fixture page reply"
  }
];

export async function buildMockReceiptExamples(): Promise<readonly ExecutionReceipt[]> {
  const executor = new MockExecutor({ now: "2026-11-02T00:00:00.000Z" });
  const receipts: ExecutionReceipt[] = [];
  for (const [index, action] of actions.entries()) {
    receipts.push(
      await executor.execute(action, {
        accountId: `account-${String((index % 3) + 1)}`,
        plan: "PRO",
        dryRun: true,
        requestId: `fixture-${String(index + 1).padStart(2, "0")}`
      })
    );
  }
  return receipts;
}

export const mockReceiptActions = actions;
