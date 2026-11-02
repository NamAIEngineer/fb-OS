import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const defaultDbPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/grouppilot.sqlite');
const dbPath = process.env.DATABASE_PATH ? resolve(process.env.DATABASE_PATH) : defaultDbPath;
mkdirSync(dirname(dbPath), { recursive: true });
const require = createRequire(import.meta.url);
const SQL: SqlJsStatic = await initSqlJs({ locateFile: (file) => require.resolve(`sql.js/dist/${file}`) });
const database: Database = existsSync(dbPath) ? new SQL.Database(new Uint8Array(readFileSync(dbPath))) : new SQL.Database();
function persist(): void { writeFileSync(dbPath, Buffer.from(database.export())); }
database.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_active INTEGER NOT NULL DEFAULT 1,
    plan_code TEXT, plan_expires_at TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vouchers (code TEXT PRIMARY KEY, plan_code TEXT NOT NULL, redeemed_by TEXT, redeemed_at TEXT);
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan_code TEXT NOT NULL, amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', qr_payload TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS affiliate_profiles (
    user_id TEXT PRIMARY KEY, referral_code TEXT NOT NULL UNIQUE, clicks INTEGER NOT NULL DEFAULT 0,
    commissions INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
persist();

type Statement = { get: (...params: unknown[]) => unknown; all: (...params: unknown[]) => unknown[]; run: (...params: unknown[]) => { changes: number } };
function statement(sql: string): Statement {
  const execute = (params: unknown[], collect: boolean) => {
    const prepared = database.prepare(sql);
    try {
      prepared.bind(params as never);
      if (collect) {
        const rows: unknown[] = [];
        while (prepared.step()) rows.push(prepared.getAsObject());
        return rows;
      }
      prepared.step();
      return { changes: database.getRowsModified() };
    } finally { prepared.free(); }
  };
  return {
    get: (...params) => (execute(params, true) as unknown[])[0],
    all: (...params) => execute(params, true) as unknown[],
    run: (...params) => { const result = execute(params, false) as { changes: number }; persist(); return result; }
  };
}

export const db = { prepare: statement };
export type UserRow = {
  id: string; username: string; email: string; password_hash: string; role: 'user' | 'admin';
  is_active: number; plan_code: string | null; plan_expires_at: string | null; created_at: string;
};
export function closeDatabase(): void { persist(); }
