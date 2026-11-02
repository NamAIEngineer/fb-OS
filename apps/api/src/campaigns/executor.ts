import type { CampaignActionType, CampaignExecutor, CampaignPost } from "./types.js";

/**
 * Local executor used by all pre-live E2E. It records accepted work without
 * making a network request or touching a Facebook account.
 */
export class MockCampaignExecutor implements CampaignExecutor {
  readonly mode = "mock" as const;

  async execute(input: {
    action: CampaignActionType;
    post: CampaignPost;
    count?: number;
  }) {
    return {
      action: input.action,
      mode: this.mode,
      accepted: true,
      status: "fulfilled" as const,
      count: input.count,
    };
  }
}

/** Live implementation is deliberately gated until Nam supplies a clone. */
export class GatedLiveCampaignExecutor implements CampaignExecutor {
  readonly mode = "live" as const;

  async execute(input: { action: CampaignActionType; post: CampaignPost; count?: number }) {
    return {
      action: input.action,
      mode: this.mode,
      accepted: false,
      status: "rejected" as const,
      reason: "LIVE_GATE_REQUIRED: Nam-provided clone and private test group",
    };
  }
}
