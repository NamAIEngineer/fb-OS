import { PLANS, type PlanCode } from '@grouppilot/shared';
import { db, type UserRow } from '../db.js';

export { PLANS };

export function getPlan(code: string | null | undefined) {
  return PLANS.find((plan) => plan.code === code) ?? null;
}

export function getUserPlan(user: Pick<UserRow, 'plan_code' | 'plan_expires_at'>) {
  const plan = getPlan(user.plan_code);
  if (!plan) return { plan: null, hasActivePlan: false, daysRemaining: null };
  if (!user.plan_expires_at) return { plan, hasActivePlan: true, daysRemaining: null };
  const remaining = Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / 86_400_000);
  return { plan: remaining >= 0 ? plan : null, hasActivePlan: remaining >= 0, daysRemaining: Math.max(0, remaining) };
}

export function grantPlan(userId: string, code: PlanCode, expiresAt: string | null = null): void {
  db.prepare('UPDATE users SET plan_code = ?, plan_expires_at = ? WHERE id = ?').run(code, expiresAt, userId);
}

export function maxAccountsForPlan(code: string | null | undefined): number {
  return getPlan(code)?.maxAccounts ?? 0;
}
