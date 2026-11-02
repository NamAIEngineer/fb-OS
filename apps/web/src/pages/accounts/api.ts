import type {
  AccountRecord,
  AccountStatusReceipt,
  AccountStatusResult,
  AccountSyncInput,
  DailyLimits,
} from '../../../../api/src/accounts/types';

// The Vite scaffold does not declare ImportMetaEnv yet; the API is same-origin
// by default. A future host can prepend its base URL at the fetch adapter.
const apiBase = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('grouppilot_token');
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as T & { error?: string } | null;
  if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`);
  return body as T;
}

export interface AccountListResponse { items: AccountRecord[] }

export function listAccounts(status?: AccountRecord['status']): Promise<AccountListResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<AccountListResponse>(`/accounts${query}`);
}

export function syncAccount(input: AccountSyncInput) {
  return request<{ account: AccountRecord | null; receipt: unknown }>('/accounts/sync', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export function reconcileStatuses(results: AccountStatusResult[]): Promise<AccountStatusReceipt> {
  return request<AccountStatusReceipt>('/accounts/reconcile-status', {
    method: 'POST', body: JSON.stringify({ results }),
  });
}

export function updateAccountLimits(accountId: string, limits: Partial<DailyLimits>) {
  return request<AccountRecord>(`/accounts/${encodeURIComponent(accountId)}/limits`, {
    method: 'PATCH', body: JSON.stringify(limits),
  });
}

export function removeAccount(accountId: string) {
  return request<void>(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
}
