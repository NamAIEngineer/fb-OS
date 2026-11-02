import type {
  AddToCollectionInput,
  BatchLeaveInput,
  GroupLibraryFilters,
  GroupServiceContext,
  JoinGroupInput,
  LeaveAfterPostToggle,
  LeaveGroupInput,
} from "../../../../packages/shared/contracts-groups.js";
import { GroupService } from "./service.js";

/** Framework-neutral route descriptors for the host API adapter. */
export const groupRouteDefinitions = [
  { method: "GET", path: "/groups/library", feature: "PRO4" },
  { method: "POST", path: "/groups/join", feature: "PRO4" },
  { method: "POST", path: "/groups/leave", feature: "PRO4" },
  { method: "POST", path: "/groups/leave/batch", feature: "PRO4" },
  { method: "GET", path: "/groups/collections", feature: "PRO4" },
  { method: "POST", path: "/groups/collections", feature: "PRO4" },
  { method: "PUT", path: "/groups/:groupId/leave-after-post", feature: "PRO4" },
  { method: "GET", path: "/groups/:groupId/pending-members", feature: "PRO6" },
  { method: "PUT", path: "/groups/:groupId/auto-approve", feature: "PRO6" },
  { method: "POST", path: "/groups/:groupId/auto-approve/run", feature: "PRO6" },
  { method: "POST", path: "/groups/:groupId/invite-new-members", feature: "PRO4" },
] as const;

export function createGroupRoutes(service: GroupService) {
  return {
    library: (context: GroupServiceContext, filters: GroupLibraryFilters = {}) => service.listLibrary(context, filters),
    join: (context: GroupServiceContext, input: JoinGroupInput) => service.join(context, input),
    leave: (context: GroupServiceContext, input: LeaveGroupInput) => service.leave(context, input),
    batchLeave: (context: GroupServiceContext, input: BatchLeaveInput) => service.batchLeave(context, input),
    collections: (context: GroupServiceContext) => service.listCollections(context),
    addToCollection: (context: GroupServiceContext, input: AddToCollectionInput) => service.addToCollection(context, input),
    setLeaveAfterPost: (context: GroupServiceContext, groupId: string, input: LeaveAfterPostToggle) =>
      service.setLeaveAfterPost(context, { ...input, groupId }),
    pendingMembers: (context: GroupServiceContext, groupId: string) => service.listPending(context, groupId),
    configureAutoApprove: (context: GroupServiceContext, settings: Parameters<GroupService["configureAutoApprove"]>[1]) =>
      service.configureAutoApprove(context, settings),
    runAutoApprove: (context: GroupServiceContext, accountId: string, groupId: string) => service.runAutoApprove(context, accountId, groupId),
    inviteNewMembers: (context: GroupServiceContext, accountId: string, groupId: string, count?: number) =>
      service.inviteNewMembers(context, accountId, groupId, count),
  };
}

