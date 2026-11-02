import { db } from '../db.js';
import { grantPlan } from '../plans/index.js';

export function redeemVoucher(userId: string, code: string): { code: string; planCode: string } {
  const voucher = db.prepare('SELECT code, plan_code, redeemed_by FROM vouchers WHERE upper(code) = upper(?)').get(code.trim()) as { code: string; plan_code: string; redeemed_by: string | null } | undefined;
  if (!voucher) throw new Error('Voucher không tồn tại');
  if (voucher.redeemed_by) throw new Error('Voucher đã được sử dụng');
  db.prepare('UPDATE vouchers SET redeemed_by = ?, redeemed_at = ? WHERE code = ?').run(userId, new Date().toISOString(), voucher.code);
  grantPlan(userId, voucher.plan_code as 'basic' | 'plus' | 'pro');
  return { code: voucher.code, planCode: voucher.plan_code };
}
