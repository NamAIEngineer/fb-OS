import type { PublicUser } from '@grouppilot/shared';
import { db, type UserRow } from '../db.js';
import { getUserPlan, maxAccountsForPlan } from '../plans/index.js';

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as UserRow | undefined;
}

export function toPublicUser(user: UserRow): PublicUser {
  const active = getUserPlan(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    plan: active.plan,
    hasActivePlan: active.hasActivePlan,
    planExpiresAt: user.plan_expires_at,
    daysRemaining: active.daysRemaining,
    effectiveMaxAccounts: maxAccountsForPlan(user.plan_code)
  };
}
