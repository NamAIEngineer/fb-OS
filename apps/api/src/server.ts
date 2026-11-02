import http from 'node:http';
import express, { type Application } from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { PLANS, hasPlanAccess, type PlanCode } from '@grouppilot/shared';
import { db } from './db.js';
import { authRequired, loginUser, registerUser, seedDemoUser, type AuthenticatedRequest } from './auth/index.js';
import { findUserById, toPublicUser } from './users/index.js';
import { createQrPayment, getPayment, mockWebhook } from './payments/index.js';
import { redeemVoucher } from './voucher/index.js';
import { getAffiliateProfile } from './affiliate/index.js';

const app: Application = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'grouppilot-api', persistence: 'sqlite', socket: 'socket.io', time: new Date().toISOString() }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'grouppilot-api', persistence: 'sqlite', socket: 'socket.io', time: new Date().toISOString() }));
app.get('/api/plans', (_req, res) => res.json(PLANS));

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};
    if (!username || !email || !password) return res.status(400).json({ error: 'Vui lòng nhập đủ thông tin' });
    return res.status(201).json(registerUser({ username, email, password }));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Đăng ký thất bại' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    return res.json(loginUser({ email, password }));
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Đăng nhập thất bại' });
  }
});

app.get('/api/users/me', authRequired, (req: AuthenticatedRequest, res) => res.json(toPublicUser(req.user!)));

app.post('/api/voucher/redeem', authRequired, (req: AuthenticatedRequest, res) => {
  try {
    const result = redeemVoucher(req.user!.id, String(req.body?.code ?? ''));
    io.emit('plan.updated', { userId: req.user!.id, planCode: result.planCode });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Không thể nhập voucher' });
  }
});

app.post('/api/payments/create-qr', authRequired, (req: AuthenticatedRequest, res) => {
  try { return res.status(201).json(createQrPayment(req.user!.id, String(req.body?.planCode ?? ''))); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Không tạo được QR' }); }
});

app.get('/api/payments/:paymentId', authRequired, (req, res) => res.json(getPayment(String(req.params.paymentId)) ?? { error: 'Payment không tồn tại' }));

app.post('/api/payments/mock-webhook', (req, res) => {
  try {
    const result = mockWebhook(String(req.body?.paymentId ?? ''), req.body?.status === 'expired' ? 'expired' : 'paid');
    io.emit('payment.updated', result);
    return res.json(result);
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Webhook thất bại' }); }
});

app.get('/api/affiliate/profile', authRequired, (req: AuthenticatedRequest, res) => res.json(getAffiliateProfile(req.user!.id)));

app.get('/api/gated/:required', authRequired, (req: AuthenticatedRequest, res) => {
  const required = req.params.required as PlanCode;
  if (!['basic', 'plus', 'pro'].includes(required)) return res.status(400).json({ error: 'Plan không hợp lệ' });
  if (!hasPlanAccess(req.user!.plan_code as PlanCode | null, required)) return res.status(403).json({ error: `Yêu cầu gói ${required.toUpperCase()}` });
  return res.json({ allowed: true, required });
});

app.get('/api/metrics', (_req, res) => res.json({ users: (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count }));

io.on('connection', (socket) => {
  socket.emit('connected', { service: 'grouppilot-api', at: new Date().toISOString() });
});

seedDemoUser();
server.listen(port, () => console.log(`GroupPilot API listening on http://localhost:${port}`));

export { app, io, server };
