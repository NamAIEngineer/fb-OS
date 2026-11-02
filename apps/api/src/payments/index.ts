import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { getPlan, grantPlan } from '../plans/index.js';

export function createQrPayment(userId: string, planCode: string) {
  const plan = getPlan(planCode);
  if (!plan) throw new Error('Gói không tồn tại');
  const id = randomUUID();
  const qrPayload = `grouppilot://vietqr/${id}?amount=${plan.priceLifetime}&plan=${plan.code}`;
  db.prepare('INSERT INTO payments (id, user_id, plan_code, amount, qr_payload, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, plan.code, plan.priceLifetime, qrPayload, new Date().toISOString());
  return { paymentId: id, planCode: plan.code, amount: plan.priceLifetime, qrPayload, status: 'pending' as const };
}

export function mockWebhook(paymentId: string, status: 'paid' | 'expired' = 'paid') {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as { id: string; user_id: string; plan_code: string } | undefined;
  if (!payment) throw new Error('Payment không tồn tại');
  db.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE id = ?').run(status, status === 'paid' ? new Date().toISOString() : null, paymentId);
  if (status === 'paid') grantPlan(payment.user_id, payment.plan_code as 'basic' | 'plus' | 'pro');
  return { paymentId, status };
}

export function getPayment(paymentId: string) {
  return db.prepare('SELECT id AS paymentId, plan_code AS planCode, amount, status, qr_payload AS qrPayload, created_at AS createdAt, paid_at AS paidAt FROM payments WHERE id = ?').get(paymentId);
}
