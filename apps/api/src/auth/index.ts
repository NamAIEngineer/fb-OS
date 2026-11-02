import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db, type UserRow } from '../db.js';
import { findUserById, toPublicUser } from '../users/index.js';
import { getPlan, grantPlan } from '../plans/index.js';

const jwtSecret = process.env.JWT_SECRET ?? 'grouppilot-development-secret';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function comparePassword(password: string, hash: string): boolean {
  const actual = Buffer.from(hashPassword(password));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function issueToken(user: UserRow): string {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

export type AuthenticatedRequest = Request & { user?: UserRow };

export function authRequired(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as jwt.JwtPayload;
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    const user = userId ? findUserById(userId) : undefined;
    if (!user || !user.is_active) throw new Error('inactive');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function registerUser(input: { username: string; email: string; password: string }): { token: string; user: ReturnType<typeof toPublicUser> } {
  if (input.password.length < 8) throw new Error('Mật khẩu tối thiểu 8 ký tự');
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.username.trim(),
    input.email.trim().toLowerCase(),
    hashPassword(input.password),
    new Date().toISOString()
  );
  const user = findUserById(id)!;
  return { token: issueToken(user), user: toPublicUser(user) };
}

export function loginUser(input: { email: string; password: string }): { token: string; user: ReturnType<typeof toPublicUser> } {
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(input.email.trim()) as UserRow | undefined;
  if (!user || !comparePassword(input.password, user.password_hash)) throw new Error('Email hoặc mật khẩu không đúng');
  return { token: issueToken(user), user: toPublicUser(user) };
}

export function seedDemoUser(): void {
  const email = 'demo@grouppilot.local';
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id, 'demo', email, hashPassword('demo-password'), new Date().toISOString()
  );
  grantPlan(id, 'pro');
  for (const [code, plan] of [['GP-BASIC-DEMO', 'basic'], ['GP-PLUS-DEMO', 'plus'], ['GP-PRO-DEMO', 'pro']] as const) {
    db.prepare('INSERT OR IGNORE INTO vouchers (code, plan_code) VALUES (?, ?)').run(code, plan);
  }
}
