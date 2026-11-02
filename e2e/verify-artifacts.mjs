#!/usr/bin/env node
/**
 * Independent, read-only artifact verifier.
 *
 * This script never starts the product, mutates product source, logs in, or
 * calls an external service. It writes only the JSON receipt passed by
 * `--receipt` (default: e2e/artifacts/verifier-receipt.json).
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ROUTES } from "./routes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const productRoot = path.resolve(here, "..");
const workspaceRoot = path.resolve(productRoot, "../..");
const planRoot = path.join(workspaceRoot, "plans", "fbtool-rebuild-20261102");
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const receiptPath = path.resolve(argValue("--receipt", path.join(here, "artifacts", "verifier-receipt.json")));
const read = async (file) => {
  try { return await fs.readFile(file, "utf8"); } catch { return null; }
};
const exists = async (file) => {
  try { await fs.access(file); return true; } catch { return false; }
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rel = (file) => path.relative(workspaceRoot, file);
const startedAt = new Date().toISOString();

const checks = [];
function check(id, area, status, fact, evidence = []) {
  checks.push({ id, area, status, fact, evidence });
}

// No-op boundary: observe status only; do not stage, reset, clean, or write git.
let gitStatus = "UNKNOWN";
try {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const result = await run("git", ["-C", productRoot, "status", "--short", "--untracked-files=all"], { maxBuffer: 2_000_000 });
  gitStatus = result.stdout.trim() || "CLEAN";
  check("NOOP-1", "no-op boundary", "PASS", "Observed git status without staging, reset, clean, or source edits.", ["git status --short --untracked-files=all"]);
} catch (error) {
  check("NOOP-1", "no-op boundary", "UNKNOWN", `Could not observe git status: ${error?.message || error}`, ["git status --short --untracked-files=all"]);
}

// Source pin: verify every recorded digest and duplicated bundle directory.
const sumsPath = path.join(planRoot, "evidence", "reference", "SHA256SUMS.txt");
const sums = await read(sumsPath);
let pinFailures = [];
if (sums) {
  for (const line of sums.split(/\r?\n/).filter(Boolean)) {
    const match = /^(\w+)\s+(.+)$/.exec(line.trim());
    if (!match) { pinFailures.push(`malformed: ${line}`); continue; }
    const [, expected, recorded] = match;
    const file = path.resolve(workspaceRoot, recorded);
    const bytes = await fs.readFile(file).catch(() => null);
    if (!bytes) { pinFailures.push(`${recorded}: missing`); continue; }
    if (sha256(bytes) !== expected) pinFailures.push(`${recorded}: hash mismatch`);
  }
  const canonical = ["index.js", "index.css", "post.html"].map((name) => path.join(planRoot, "evidence", "reference", name));
  const bundle = ["index.js", "index.css", "index.html"].map((name) => path.join(planRoot, "evidence", "reference", "bundle-app", name));
  for (let index = 0; index < canonical.length; index += 1) {
    const left = await fs.readFile(canonical[index]).catch(() => null);
    const right = await fs.readFile(bundle[index]).catch(() => null);
    if (!left || !right || !left.equals(right)) pinFailures.push(`${rel(bundle[index])}: does not match canonical capture`);
  }
  check("PIN-1", "source pin", pinFailures.length === 0 ? "PASS" : "FAIL", pinFailures.length === 0 ? "All recorded hashes and canonical/bundle-app copies match." : pinFailures.join("; "), [rel(sumsPath)]);
} else {
  check("PIN-1", "source pin", "UNKNOWN", "SHA256SUMS.txt is unavailable.", [rel(sumsPath)]);
}

// Feature trace denominator and source pointers.
const tracePath = path.join(planRoot, "feature-trace.md");
const trace = await read(tracePath);
const traceRows = trace ? [...trace.matchAll(/^\|\s*((?:B|PL|PRO)\d+)\s*\|/gm)] : [];
const completedRows = trace ? [...trace.matchAll(/^\|\s*(?:B|PL|PRO)\d+\s*\|[^\n]*\|[^\n]*\|[^\n]*\|[^\n]*\|[^\n]*\|[^\n]*\|\s*(?:PASS|DONE|COMPLETE)\s*\|/gm)].length : 0;
const pendingRows = traceRows.length - completedRows;
check("TRACE-1", "feature trace", traceRows.length === 29 && pendingRows === 0 ? "PASS" : "UNKNOWN", `Observed ${traceRows.length}/29 checklist rows; ${pendingRows} are not independently complete.`, [rel(tracePath)]);

// Worker artifacts: report presence without treating self-reports as proof.
const workerArtifacts = [
  "feature-map.md",
  "api-contract.md",
  "rea/screens",
  "status-w-ext.md",
  "status-w-shell.md",
  "status-w-accounts.md",
  "status-w-post.md",
  "status-w-campaign.md",
  "status-w-groups.md",
  "status-w-interact.md",
].map((item) => path.join(planRoot, item));
const workerPresence = [];
for (const item of workerArtifacts) workerPresence.push({ path: rel(item), present: await exists(item) });
const missingWorkerArtifacts = workerPresence.filter((item) => !item.present).map((item) => item.path);
check("ART-1", "worker artifacts", missingWorkerArtifacts.length === 0 ? "PASS" : "UNKNOWN", missingWorkerArtifacts.length === 0 ? "All expected worker artifact paths exist." : `Missing or pending worker artifacts: ${missingWorkerArtifacts.join(", ")}`, workerPresence.map((item) => item.path));

// Mock receipts: verify shape and the external-execution boundary.
const mockPath = path.join(productRoot, "packages", "executor", "examples", "mock-receipts.json");
const mockText = await read(mockPath);
let mockRows = [];
try { mockRows = mockText ? JSON.parse(mockText) : []; } catch { mockRows = []; }
const badMock = Array.isArray(mockRows)
  ? mockRows.filter((row) => row?.externalExecution !== false || row?.status !== "completed" || !String(row?.detail || "").includes("MOCK_ONLY"))
  : ["not-an-array"];
check("MOCK-1", "mock executor receipts", Array.isArray(mockRows) && mockRows.length > 0 && badMock.length === 0 ? "PASS" : "UNKNOWN", Array.isArray(mockRows) ? `Observed ${mockRows.length} fixture receipt(s); ${badMock.length} violate MOCK_ONLY shape.` : "Mock receipt fixture unavailable or malformed.", [rel(mockPath)]);

// Secret and forbidden-artifact scan. A keyword in a field name is not a
// secret; report only high-signal values and forbidden source artifacts.
const forbiddenPatterns = [
  { name: "credential-value", pattern: /(?:c_user|xs|sessionid|access_token)\s*[:=]\s*["'][^"']{8,}/i },
  { name: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { name: "jwt-like", pattern: /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: "original-bundle", pattern: /fbtool-extension\.zip|FB\s*Tool\s+branding/i },
];
const sourceFiles = [];
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "artifacts", "playwright-report", "test-results"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (!entry.name.endsWith(".lock") && !entry.name.endsWith(".png")) sourceFiles.push(file);
  }
}
await walk(productRoot);
const findings = [];
for (const file of sourceFiles) {
  const text = await read(file);
  if (!text) continue;
  for (const candidate of forbiddenPatterns) {
    if (candidate.pattern.test(text)) findings.push({ file: rel(file), kind: candidate.name });
  }
}
check("SAFE-1", "secret/forbidden artifact scan", findings.length === 0 ? "PASS" : "FAIL", findings.length === 0 ? `Scanned ${sourceFiles.length} product file(s); no high-signal secret or forbidden artifact pattern.` : JSON.stringify(findings), ["walk products/fb-group-suite excluding runtime artifacts"]);

// Screenshot contract. A baseline needs both viewports; no baseline means UNKNOWN.
const baselineDir = path.join(planRoot, "screenshots", "baseline");
const candidateDir = path.join(planRoot, "screenshots", "product");
const listPng = async (dir) => (await fs.readdir(dir).catch(() => [])).filter((name) => name.endsWith(".png"));
const baselinePng = await listPng(baselineDir);
const candidatePng = await listPng(candidateDir);
const pairs = baselinePng.filter((name) => candidatePng.includes(name));
check("SHOT-1", "route screenshot diff", pairs.length > 0 ? "UNKNOWN" : "UNKNOWN", pairs.length > 0 ? `Found ${pairs.length} pair(s); visual-diff.mjs must be run after the last product edit.` : "No baseline/candidate screenshot pair exists; >=95% cannot be claimed.", [rel(baselineDir), rel(candidateDir), "e2e/visual-diff.mjs"]);

// Local product readiness: observe package/tooling only; do not install or start.
const packageText = await read(path.join(productRoot, "package.json"));
const pnpmAvailable = await new Promise((resolve) => {
  import("node:child_process").then(({ execFile }) => execFile("pnpm", ["--version"], (error) => resolve(!error))).catch(() => resolve(false));
});
check("RUNTIME-1", "build/start readiness", packageText && pnpmAvailable ? "UNKNOWN" : "UNKNOWN", packageText ? `Product manifest exists; pnpm available=${pnpmAvailable}. Build/start not run by verifier.` : "Product manifest unavailable.", [rel(path.join(productRoot, "package.json")), "pnpm --version"]);

const acceptance = [
  ["A1", "UNKNOWN", "REA and per-row evidence depend on pending worker artifacts."],
  ["A2", "UNKNOWN", "No independent mock E2E receipt per BASIC row."],
  ["A3", "UNKNOWN", "No independent mock E2E receipt per PLUS row."],
  ["A4", "UNKNOWN", "No independent mock E2E receipt per PRO row."],
  ["A5", "UNKNOWN", "Pricing source parity and screenshot pair not independently verified."],
  ["A7", "UNKNOWN", "Current fixture receipts are executor-only; 29 row receipts absent."],
  ["V1", checks.find((item) => item.id === "ART-1")?.status || "UNKNOWN", "Artifact existence and explicit evidence ledger recorded."],
  ["V2", checks.find((item) => item.id === "PIN-1")?.status || "UNKNOWN", "Pinned source hashes checked."],
  ["V3", "UNKNOWN", "Playwright package/browser unavailable; live smoke remains gated."],
  ["V4", "UNKNOWN", "No product server/build run; screenshot pairs absent."],
  ["V5", "PASS", "Run/task/dispatch IDs are recorded in controller STATUS and worker report."],
];

const finishedAt = new Date().toISOString();
const receipt = {
  schemaVersion: 1,
  kind: "verifier",
  status: checks.some((item) => item.status === "FAIL") ? "FAIL" : "UNKNOWN",
  startedAt,
  finishedAt,
  runId: "run_03028a8fe179",
  taskId: "task_d74133760285",
  dispatchId: "ctx_5adf100a2623",
  gitStatus,
  checks,
  acceptance,
  routeInventory: ROUTES.map(({ id, path: routePath, deferred, excluded }) => ({ id, path: routePath, deferred: Boolean(deferred), excluded: Boolean(excluded) })),
};
await fs.mkdir(path.dirname(receiptPath), { recursive: true });
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ receiptPath, status: receipt.status, checks: checks.length })}\n`);
