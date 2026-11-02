import {
  FriendCollection,
  FriendRecord,
  InteractionRun,
  InteractionStore,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";

/**
 * Local persistence seam used by the mock E2E path.  The API can replace this
 * implementation with SQLite/Postgres without changing the route contract.
 */
export class InMemoryInteractionStore implements InteractionStore {
  private readonly friends = new Map<string, FriendRecord[]>();
  private readonly collections = new Map<string, FriendCollection[]>();
  private readonly runs = new Map<string, InteractionRun[]>();

  async listFriends(accountId: string): Promise<FriendRecord[]> {
    return structuredClone(this.friends.get(accountId) ?? []);
  }

  async replaceFriends(accountId: string, friends: FriendRecord[]): Promise<void> {
    const deduped = new Map<string, FriendRecord>();
    for (const friend of friends) {
      const uid = String(friend.uid ?? "").trim();
      if (!uid) continue;
      deduped.set(uid, {
        ...friend,
        uid,
        name: String(friend.name ?? uid).trim() || uid,
      });
    }
    this.friends.set(accountId, [...deduped.values()]);
  }

  async listCollections(accountId: string): Promise<FriendCollection[]> {
    return structuredClone(this.collections.get(accountId) ?? []);
  }

  async saveCollection(collection: FriendCollection): Promise<FriendCollection> {
    const list = this.collections.get(collection.accountId) ?? [];
    const next = structuredClone(collection);
    const index = list.findIndex((item) => item.id === next.id);
    if (index >= 0) list[index] = next;
    else list.unshift(next);
    this.collections.set(next.accountId, list);
    return structuredClone(next);
  }

  async deleteCollection(accountId: string, collectionId: string): Promise<boolean> {
    const list = this.collections.get(accountId) ?? [];
    const next = list.filter((item) => item.id !== collectionId);
    this.collections.set(accountId, next);
    return next.length !== list.length;
  }

  async saveRun(run: InteractionRun): Promise<InteractionRun> {
    const list = this.runs.get(run.request.accountId) ?? [];
    const index = list.findIndex((item) => item.runId === run.runId);
    if (index >= 0) list[index] = structuredClone(run);
    else list.unshift(structuredClone(run));
    this.runs.set(run.request.accountId, list);
    return structuredClone(run);
  }

  async getRun(accountId: string, runId: string): Promise<InteractionRun | undefined> {
    const run = (this.runs.get(accountId) ?? []).find((item) => item.runId === runId);
    return run ? structuredClone(run) : undefined;
  }

  async listRuns(accountId: string): Promise<InteractionRun[]> {
    return structuredClone(this.runs.get(accountId) ?? []);
  }

  seedFriends(accountId: string, count = 3): FriendRecord[] {
    const current = this.friends.get(accountId);
    if (current?.length) return structuredClone(current);
    const seeded = Array.from({ length: Math.max(1, count) }, (_, index) => ({
      uid: `mock_friend_${index + 1}`,
      name: `Bạn bè mẫu ${index + 1}`,
      commentCount: index === 0 ? 2 : 0,
      likeCount: index === 1 ? 1 : 0,
      messageCount: index === 2 ? 1 : 0,
      lastMessageAt: index === 2 ? nowIso() : undefined,
      lastInteractionAt: index === 0 ? nowIso() : undefined,
    }));
    this.friends.set(accountId, seeded);
    return structuredClone(seeded);
  }

  newCollection(accountId: string, name: string, friendIds: string[]): FriendCollection {
    const timestamp = nowIso();
    return {
      id: localId("friend_collection"),
      accountId,
      name,
      friendIds: [...new Set(friendIds)],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
