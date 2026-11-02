import type { CampaignStore, CampaignStoreState } from "./types.js";

export const EMPTY_CAMPAIGN_STATE: CampaignStoreState = {
  posts: [],
  actions: [],
  groupStats: [],
  collections: [],
};

/** In-memory store is deterministic and is the default for MockExecutor E2E. */
export class InMemoryCampaignStore implements CampaignStore {
  private state: CampaignStoreState;

  constructor(seed: Partial<CampaignStoreState> = {}) {
    this.state = {
      posts: [...(seed.posts ?? [])],
      actions: [...(seed.actions ?? [])],
      groupStats: [...(seed.groupStats ?? [])],
      collections: [...(seed.collections ?? [])],
    };
  }

  async load(): Promise<CampaignStoreState> {
    return {
      posts: [...this.state.posts],
      actions: [...this.state.actions],
      groupStats: [...this.state.groupStats],
      collections: [...this.state.collections],
    };
  }

  async save(next: CampaignStoreState): Promise<void> {
    this.state = {
      posts: [...next.posts],
      actions: [...next.actions],
      groupStats: [...next.groupStats],
      collections: [...next.collections],
    };
  }
}

/**
 * Small JSON persistence adapter for the API process.  The write is atomic
 * (temporary file then rename), so a process interruption cannot truncate the
 * campaign ledger.  It is intentionally opt-in; tests use InMemoryCampaignStore.
 */
export class JsonCampaignStore implements CampaignStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<CampaignStoreState> {
    const fs = await import("node:fs/promises");
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CampaignStoreState>;
      return {
        posts: Array.isArray(parsed.posts) ? parsed.posts : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        groupStats: Array.isArray(parsed.groupStats) ? parsed.groupStats : [],
        collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
      if (code === "ENOENT") return { ...EMPTY_CAMPAIGN_STATE };
      throw error;
    }
  }

  async save(next: CampaignStoreState): Promise<void> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(next, null, 2), "utf8");
    await fs.rename(temporary, this.filePath);
  }
}
