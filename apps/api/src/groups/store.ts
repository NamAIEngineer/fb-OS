import type {
  AutoApproveSettings,
  GroupCollection,
  GroupStore,
  PendingMember,
  PublicGroupMetadata,
} from "../../../../packages/shared/contracts-groups.js";

export interface GroupMembershipRecord {
  id: string;
  userId: string;
  accountId: string;
  groupId: string;
  status: "joined" | "pending" | "rejected" | "left";
  questionAnswers: { question: string; answer: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface SerializableGroupStore {
  groups: PublicGroupMetadata[];
  memberships: GroupMembershipRecord[];
  collections: GroupCollection[];
  autoApprove: AutoApproveSettings[];
  pendingMembers: PendingMember[];
  leaveAfterPost: [string, boolean][];
}

export interface PersistableGroupStore extends GroupStore {
  persist?: () => Promise<void>;
}

export function createGroupStore(seed: Partial<SerializableGroupStore> = {}): PersistableGroupStore {
  const groups: GroupStore["groups"] = new Map<string, PublicGroupMetadata>(
    (seed.groups ?? []).map((group) => [group.id, group]),
  );
  const memberships: GroupStore["memberships"] = new Map<string, GroupStore["memberships"] extends Map<string, infer Value> ? Value : never>(
    (seed.memberships ?? []).map((membership) => [membership.id, membership]),
  );
  const collections: GroupStore["collections"] = new Map<string, GroupCollection>(
    (seed.collections ?? []).map((collection) => [collection.id, collection]),
  );
  const autoApprove: GroupStore["autoApprove"] = new Map<string, AutoApproveSettings>(
    (seed.autoApprove ?? []).map((settings) => [settings.groupId, settings]),
  );
  const pendingMembers: GroupStore["pendingMembers"] = new Map<string, PendingMember>(
    (seed.pendingMembers ?? []).map((member) => [member.requestId, member]),
  );
  return {
    groups,
    memberships,
    collections,
    autoApprove,
    pendingMembers,
    leaveAfterPost: new Map(seed.leaveAfterPost ?? []),
  };
}

export function serializeGroupStore(store: GroupStore): SerializableGroupStore {
  return {
    groups: [...store.groups.values()],
    memberships: [...store.memberships.values()],
    collections: [...store.collections.values()],
    autoApprove: [...store.autoApprove.values()],
    pendingMembers: [...store.pendingMembers.values()],
    leaveAfterPost: [...store.leaveAfterPost.entries()],
  };
}

/**
 * Adapter for the API's local JSON persistence.  The caller supplies the
 * filesystem functions so this contract stays usable in browser and tests.
 */
export interface GroupPersistenceAdapter {
  read(): Promise<string | undefined>;
  write(contents: string): Promise<void>;
}

export async function loadPersistedGroupStore(adapter: GroupPersistenceAdapter): Promise<PersistableGroupStore> {
  const contents = await adapter.read();
  if (!contents) return createGroupStore();
  try {
    const parsed = JSON.parse(contents) as SerializableGroupStore;
    return createGroupStore(parsed);
  } catch {
    // A corrupt local file must not make the API silently claim existing state.
    // Start empty; the caller can surface an operational warning.
    return createGroupStore();
  }
}

export function attachPersistence(store: PersistableGroupStore, adapter: GroupPersistenceAdapter): PersistableGroupStore {
  store.persist = () => adapter.write(JSON.stringify(serializeGroupStore(store), null, 2));
  return store;
}

export function seedPublicGroups(store: GroupStore, groups: PublicGroupMetadata[]): void {
  for (const group of groups) {
    if (group.isPublic) store.groups.set(group.id, group);
  }
}

