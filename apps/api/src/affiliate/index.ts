import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export function getAffiliateProfile(userId: string) {
  let profile = db.prepare('SELECT referral_code AS referralCode, clicks, commissions FROM affiliate_profiles WHERE user_id = ?').get(userId) as { referralCode: string; clicks: number; commissions: number } | undefined;
  if (!profile) {
    const referralCode = `GP-${randomUUID().slice(0, 8).toUpperCase()}`;
    db.prepare('INSERT INTO affiliate_profiles (user_id, referral_code) VALUES (?, ?)').run(userId, referralCode);
    profile = { referralCode, clicks: 0, commissions: 0 };
  }
  return profile;
}
