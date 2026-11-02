export type GroupJoinStatus = 'joined' | 'pending' | 'rejected';

export type PublicGroup = {
  id: string;
  uid: string;
  url?: string;
  name: string;
  topic?: string;
  memberCount: number;
  postsPerDay: number;
  approvalRequired: boolean;
  isPublic: boolean;
  isAdminOrModerator?: boolean;
  newMembersLastDay?: number;
  indexedAt?: string;
};

export type JoinReceipt = {
  id: string;
  action: 'group.join' | 'group.leave' | 'group.approve-member' | 'group.invite-new-members';
  mode: 'mock' | 'live';
  accepted: boolean;
  status?: GroupJoinStatus | 'left' | 'approved' | 'invited' | 'rejected';
  reason?: string;
  createdAt: string;
};

export type JoinResult = {
  membershipId: string;
  group: PublicGroup;
  status: GroupJoinStatus;
  questionAnswers: { question: string; answer: string }[];
  receipt: JoinReceipt;
  createdAt: string;
};

export type GroupFilters = {
  keyword?: string;
  topic?: string;
  minMembers?: number;
  maxMembers?: number;
  minPostsPerDay?: number;
  maxPostsPerDay?: number;
  approvalRequired?: boolean;
};

type ApiError = { error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new Error(payload.error || `API ${response.status}`);
  return payload as T;
}

function queryString(filters: GroupFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function fetchPublicGroups(filters: GroupFilters = {}): Promise<PublicGroup[]> {
  const payload = await request<{ groups?: PublicGroup[]; items?: PublicGroup[] }>(`/api/groups/library${queryString(filters)}`);
  return payload.groups ?? payload.items ?? [];
}

export async function joinGroup(input: {
  accountId: string;
  groupIdOrUrl: string;
  questionAnswers: { question: string; answer: string }[];
  delayFromSeconds: number;
  delayToSeconds: number;
}): Promise<JoinResult> {
  return request<JoinResult>('/api/groups/join', { method: 'POST', body: JSON.stringify(input) });
}

export async function saveGroupCollection(input: { name: string; groupId: string }): Promise<unknown> {
  return request('/api/groups/collections', { method: 'POST', body: JSON.stringify(input) });
}

export async function setLeaveAfterPost(groupId: string, enabled: boolean): Promise<unknown> {
  return request(`/api/groups/${encodeURIComponent(groupId)}/leave-after-post`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export async function configureAutoApprove(input: {
  groupId: string;
  enabled: boolean;
  approveSuspectedSpam: boolean;
}): Promise<unknown> {
  return request(`/api/groups/${encodeURIComponent(input.groupId)}/auto-approve`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function runAutoApprove(groupId: string, accountId: string): Promise<{
  groupId: string;
  approvedRequestIds: string[];
  skippedRequestIds: string[];
  receipt: JoinReceipt;
}> {
  return request(`/api/groups/${encodeURIComponent(groupId)}/auto-approve/run`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
}

