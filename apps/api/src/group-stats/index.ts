export {
  createCampaignService,
  CampaignService,
} from "../campaigns/service.js";
export type { GroupStat } from "../campaigns/types.js";

/** Machine-readable route contract for group table refresh/search/sort. */
export const GROUP_STATS_ENDPOINT = "/group-stats" as const;
