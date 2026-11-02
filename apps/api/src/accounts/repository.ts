import type {
  AccountListQuery,
  AccountRecord,
  AccountRepository,
} from "./types";

/** Deterministic repository for local development and MockExecutor E2E. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly rows = new Map<string, AccountRecord>();

  async list(query: AccountListQuery): Promise<AccountRecord[]> {
    return [...this.rows.values()]
      .filter((row) => row.ownerId === query.ownerId)
      .filter((row) => !query.status || row.status === query.status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findById(ownerId: string, id: string): Promise<AccountRecord | null> {
    const row = this.rows.get(id);
    return row && row.ownerId === ownerId ? { ...row, meta: { ...row.meta } } : null;
  }

  async findByUid(ownerId: string, uid: string): Promise<AccountRecord | null> {
    for (const row of this.rows.values()) {
      if (row.ownerId === ownerId && row.uid === uid) {
        return { ...row, meta: { ...row.meta } };
      }
    }
    return null;
  }

  async count(ownerId: string): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) if (row.ownerId === ownerId) count += 1;
    return count;
  }

  async save(account: AccountRecord): Promise<AccountRecord> {
    const copy = { ...account, meta: { ...account.meta }, dailyLimits: { ...account.dailyLimits } };
    this.rows.set(account.id, copy);
    return { ...copy, meta: { ...copy.meta }, dailyLimits: { ...copy.dailyLimits } };
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.ownerId !== ownerId) return false;
    this.rows.delete(id);
    return true;
  }
}
