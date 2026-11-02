import http from 'node:http';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

/**
 * Feature workers expose framework-neutral controllers.  Keep the shell's
 * Express adapter here so each controller retains its mock-first contract and
 * all feature requests pass through the same JWT boundary and plan context.
 * The runtime import is intentional: the API tsconfig owns the shell files,
 * while feature workers keep their source ownership and are built alongside
 * the API in the workspace.
 */
async function mountFeatureRoutes(): Promise<void> {
  // The API production tsconfig intentionally builds the shell first. Worker
  // controllers are source modules with their own contracts; tsx mounts them
  // in development. Plain Node production stays core-only unless an operator
  // explicitly supplies FEATURE_ROUTES_ROOT pointing at a prebuilt ESM feature
  // graph. This keeps the default build truthful: no feature routes are
  // claimed unless their production artifact is supplied and importable.
  const production = import.meta.url.includes('/dist/');
  const featureRoot = process.env.FEATURE_ROUTES_ROOT;
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
  const featureBase = featureRoot
    ? (isAbsolute(featureRoot) ? pathToFileURL(resolve(featureRoot)).href.replace(/\/$/, '') : featureRoot.replace(/\/$/, ''))
    : '.';
  const featureSpecifier = (name: string, file = 'index.js'): string =>
    featureRoot ? `${featureBase}/${name}/${file}` : `./${name}/${file}`;
  // Production uses the deterministic sibling bundle produced by the API
  // build. Development keeps the source adapter, preserving worker ownership.
  const modules = production && !featureRoot
    ? await load(new URL('./feature-routes.js', import.meta.url).href)
    : null;
  const [accounts, quota, jobs, runner, groups, campaigns, posts, friends, interactions, autoComment, fanpage] = modules
    ? [modules.accounts, modules.quota, modules.jobs, modules.runner, modules.groups, modules.campaigns, modules.posts, modules.friends, modules.interactions, modules.autoComment, modules.fanpage]
    : await Promise.all([
      load(featureSpecifier('accounts')),
      load(featureSpecifier('quota')),
      load(featureSpecifier('jobs')),
      load(featureSpecifier('runner')),
      load(featureSpecifier('groups')),
      load(featureSpecifier('campaigns')),
      load(featureSpecifier('posts')),
      load(featureSpecifier('friends', 'routes.js')),
      load(featureSpecifier('interactions', 'routes.js')),
      load(featureSpecifier('auto-comment', 'routes.js')),
      load(featureSpecifier('fanpage', 'routes.js')),
    ]);

  const accountRepository = new accounts.InMemoryAccountRepository();
  const usageStore = new quota.InMemoryUsageStore();
  const jobRepository = new jobs.InMemoryJobRepository();
  const jobRunner = new runner.JobRunner(
    jobRepository,
    usageStore,
    new runner.MockExecutor(),
    { accountRepository, sink: { emit: (event: unknown) => io.emit('job.event', event) } },
  );
  const accountController = accounts.createAccountsController(new accounts.AccountService(accountRepository, {
    planForOwner: async (ownerId: string) => {
      const row = findUserById(ownerId);
      const tier = String(row?.plan_code ?? 'basic').toUpperCase();
      return accounts.accountPlan((['BASIC', 'PLUS', 'PRO', 'MAX'].includes(tier) ? tier : 'BASIC') as 'BASIC' | 'PLUS' | 'PRO' | 'MAX');
    },
  }));
  const usageController = quota.createUsageController(usageStore, accountRepository);
  const jobsController = jobs.createJobsController(jobRunner);

  const groupStore = groups.createGroupStore();
  groups.seedPublicGroups(groupStore, [
    { id: 'group-architecture', uid: 'group-architecture', name: 'Cộng đồng kiến trúc', url: 'https://facebook.com/groups/group-architecture', memberCount: 1200, postsPerDay: 12, approvalRequired: true, isPublic: true, topics: ['kiến trúc'] },
    { id: 'group-revit', uid: 'group-revit', name: 'Revit Việt Nam', url: 'https://facebook.com/groups/group-revit', memberCount: 800, postsPerDay: 8, approvalRequired: false, isPublic: true, topics: ['revit'] },
  ]);
  const groupController = groups.createGroupController(new groups.GroupService(groupStore, new groups.MockExecutor()));
  const campaignService = campaigns.createCampaignService();
  const postRoutes = posts.createPostRoutes(new posts.PostService({ store: new posts.MemoryPostStore() }), new posts.MockPostExecutor());

  const tier = (req: AuthenticatedRequest): 'BASIC' | 'PLUS' | 'PRO' | 'MAX' => {
    const value = String(req.user?.plan_code ?? 'basic').toUpperCase();
    return (['BASIC', 'PLUS', 'PRO', 'MAX'].includes(value) ? value : 'BASIC') as 'BASIC' | 'PLUS' | 'PRO' | 'MAX';
  };
  const owner = (req: AuthenticatedRequest): string => req.user?.id ?? '';
  const send = (res: any, result: { status: number; body: unknown }): void => {
    if (result.status === 204) { res.status(204).end(); return; }
    res.status(result.status).json(result.body);
  };

  // This adapter is deliberately last among /api routes: core auth, plans,
  // payment, and affiliate endpoints above keep their public contracts.
  app.use('/api', authRequired, async (req: AuthenticatedRequest, res) => {
    const path = req.path;
    const method = req.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    try {
      if (path.startsWith('/accounts/daily-usage/')) {
        send(res, await usageController({ ownerId: owner(req), method: method as 'GET' | 'POST', path, body: req.body })); return;
      }
      if (path === '/accounts' || path.startsWith('/accounts/')) {
        send(res, await accountController({ ownerId: owner(req), method: method as any, path, query: req.query as Record<string, string>, body: req.body })); return;
      }
      if (path === '/jobs' || path.startsWith('/jobs/')) {
        send(res, await jobsController({ ownerId: owner(req), method: method as 'GET' | 'POST', path, body: req.body })); return;
      }
      if (path.startsWith('/groups/')) {
        send(res, await groupController({ ownerId: owner(req), plan: tier(req), method: method as 'GET' | 'POST' | 'PUT', path, query: req.query as Record<string, string>, body: req.body })); return;
      }
      if (path === '/pending' || path === '/fulfilled' || path === '/rejected' || path.startsWith('/campaigns/') || path === '/campaigns' || path.startsWith('/bump/') || path.startsWith('/comment-outreach/') || path.startsWith('/share-link/') || path.startsWith('/profile-post-share/') || path.startsWith('/group-stats') || path.startsWith('/group-collections') || path === '/reports/campaigns') {
        send(res, await campaigns.handleCampaignRequest({ method, path, body: req.body, query: req.query as Record<string, string>, context: { userId: owner(req), plan: tier(req) } }, campaignService)); return;
      }
      if (path.startsWith('/posts/') || path.startsWith('/post-templates')) {
        send(res, await postRoutes({ method, path: `/api${path}`, body: req.body, query: req.query as Record<string, string> })); return;
      }
      if (path.startsWith('/interactions/friends') || path.startsWith('/friend-collections')) {
        send(res, await friends.handleFriendsRequest({ method, path, accountId: String(req.body?.accountId ?? req.query.accountId ?? owner(req)), body: req.body, query: req.query as Record<string, string> })); return;
      }
      if (path.startsWith('/interactions/')) {
        send(res, await interactions.handleInteractionRequest({ method, path, planTier: tier(req) === 'MAX' ? 'PRO' : tier(req), body: req.body })); return;
      }
      if (path.startsWith('/auto-comment')) {
        send(res, await autoComment.handleAutoCommentRequest({ method, path, accountId: String(req.body?.accountId ?? owner(req)), planTier: tier(req) === 'MAX' ? 'PRO' : tier(req), body: req.body, query: req.query as Record<string, string> })); return;
      }
      if (path.startsWith('/pages/')) {
        send(res, await fanpage.handleFanpageRequest({ method, path, planTier: tier(req) === 'MAX' ? 'PRO' : tier(req), body: req.body })); return;
      }
      res.status(404).json({ error: 'FEATURE_ROUTE_NOT_FOUND' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'FEATURE_ROUTE_ERROR' });
    }
  });
}

app.get('/api/metrics', (_req, res) => res.json({ users: (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count }));

io.on('connection', (socket) => {
  socket.emit('connected', { service: 'grouppilot-api', at: new Date().toISOString() });
});

seedDemoUser();
void mountFeatureRoutes()
  .catch((error) => console.error('Feature route mount failed', error))
  .finally(() => server.listen(port, () => console.log(`GroupPilot API listening on http://localhost:${port}`)));

export { app, io, server };
