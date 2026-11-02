import {
  FriendCollection,
  FriendRecord,
  InteractionFilterInput,
  InteractionStore,
  localId,
  nowIso,
} from "../../../../packages/shared/contracts-interactions.js";
import { InMemoryInteractionStore } from "./repository.js";

export class FriendsService {
  constructor(private readonly store: InteractionStore = new InMemoryInteractionStore()) {}

  async load(accountId: string): Promise<FriendRecord[]> {
    const current = await this.store.listFriends(accountId);
    if (current.length) return current;
    if (this.store instanceof InMemoryInteractionStore) return this.store.seedFriends(accountId);
    return current;
  }

  async sync(accountId: string, friends: FriendRecord[]): Promise<FriendRecord[]> {
    await this.store.replaceFriends(accountId, friends);
    return this.store.listFriends(accountId);
  }

  async filter(accountId: string, input?: InteractionFilterInput): Promise<FriendRecord[]> {
    const friends = await this.load(accountId);
    if (!input) return friends;
    if (input.filter === "commented") return friends.filter((friend) => (friend.commentCount ?? 0) > 0);
    if (input.filter === "liked") return friends.filter((friend) => (friend.likeCount ?? 0) > 0);
    if (input.filter === "messaged") return friends.filter((friend) => (friend.messageCount ?? 0) > 0);
    if (input.filter === "none") {
      return friends.filter(
        (friend) =>
          (friend.commentCount ?? 0) === 0 &&
          (friend.likeCount ?? 0) === 0 &&
          (friend.messageCount ?? 0) === 0,
      );
    }
    const since = input.since ? Date.parse(input.since) : Number.NaN;
    if (input.filter === "lastInteraction" && Number.isFinite(since)) {
      return friends.filter((friend) => {
        const value = friend.lastInteractionAt ? Date.parse(friend.lastInteractionAt) : Number.NaN;
        return Number.isFinite(value) && value >= since;
      });
    }
    return friends;
  }

  async listCollections(accountId: string): Promise<FriendCollection[]> {
    return this.store.listCollections(accountId);
  }

  async saveCollection(
    accountId: string,
    name: string,
    friendIds: string[],
    collectionId?: string,
  ): Promise<FriendCollection> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("Tên bộ sưu tập không được để trống");
    const existing = collectionId
      ? (await this.store.listCollections(accountId)).find((item) => item.id === collectionId)
      : undefined;
    if (collectionId && !existing) throw new Error("Không tìm thấy bộ sưu tập");
    const timestamp = nowIso();
    const collection: FriendCollection = {
      id: existing?.id ?? collectionId ?? localId("friend_collection"),
      accountId,
      name: normalizedName,
      friendIds: [...new Set(friendIds.map((id) => id.trim()).filter(Boolean))],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return this.store.saveCollection(collection);
  }

  async deleteCollection(accountId: string, collectionId: string): Promise<void> {
    const deleted = await this.store.deleteCollection(accountId, collectionId);
    if (!deleted) throw new Error("Không tìm thấy bộ sưu tập");
  }

  /**
   * Personal commenter/reaction export is intentionally absent.  The table is
   * rendered in the UI, while no API contract exposes a CSV or bulk export.
   */
}
