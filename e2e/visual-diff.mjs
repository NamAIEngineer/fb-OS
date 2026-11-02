#!/usr/bin/env node
/**
 * Conservative screenshot contract checker.
 *
 * Exact byte equality is a verified 100% match. For differing PNGs the
 * optional `pngjs` decoder is used when available. Without it the result is
 * UNKNOWN rather than a fabricated similarity score. `--threshold` defaults
 * to 0.95 and is written to the receipt for auditability.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, "../..");
const planRoot = path.join(workspaceRoot, "plans", "fbtool-rebuild-20261102");
const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baselineDir = path.resolve(valueFor("--baseline-dir", path.join(planRoot, "screenshots", "baseline")));
const candidateDir = path.resolve(valueFor("--candidate-dir", path.join(planRoot, "screenshots", "product")));
const receiptPath = path.resolve(valueFor("--receipt", path.join(path.dirname(here), "artifacts", "visual-diff-receipt.json")));
const threshold = Number(valueFor("--threshold", "0.95"));

const files = async (dir) => {
  try {
    return (await fs.readdir(dir)).filter((name) => name.endsWith(".png")).sort();
  } catch {
    return [];
  }
};
const startedAt = new Date().toISOString();
const baseline = await files(baselineDir);
const candidate = await files(candidateDir);
const pairs = baseline.filter((name) => candidate.includes(name));
const results = [];

let pngjs = null;
try {
  pngjs = await import("pngjs");
} catch {
  // Optional dependency. Unknown is the safe result for differing images.
}

for (const name of pairs) {
  const before = await fs.readFile(path.join(baselineDir, name));
  const after = await fs.readFile(path.join(candidateDir, name));
  if (before.equals(after)) {
    results.push({ name, status: "PASS", score: 1, method: "sha256-byte-equality" });
    continue;
  }
  if (!pngjs?.PNG) {
    results.push({ name, status: "UNKNOWN", score: null, method: "pngjs-unavailable", reason: "Differing PNGs require a decoder." });
    continue;
  }
  const left = pngjs.PNG.sync.read(before);
  const right = pngjs.PNG.sync.read(after);
  if (left.width !== right.width || left.height !== right.height) {
    results.push({ name, status: "FAIL", score: 0, method: "pixel-rgba", reason: "Viewport dimensions differ." });
    continue;
  }
  let equal = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    if (left.data[i] === right.data[i] && left.data[i + 1] === right.data[i + 1] && left.data[i + 2] === right.data[i + 2] && left.data[i + 3] === right.data[i + 3]) equal += 1;
  }
  const score = equal / (left.width * left.height);
  results.push({ name, status: score >= threshold ? "PASS" : "FAIL", score, method: "pixel-rgba" });
}

const status = pairs.length === 0
  ? "UNKNOWN"
  : results.some((result) => result.status === "FAIL")
    ? "FAIL"
    : results.some((result) => result.status === "UNKNOWN")
      ? "UNKNOWN"
      : "PASS";
const receipt = {
  schemaVersion: 1,
  kind: "visual-diff",
  status,
  startedAt,
  finishedAt: new Date().toISOString(),
  threshold,
  baselineDir: path.relative(workspaceRoot, baselineDir),
  candidateDir: path.relative(workspaceRoot, candidateDir),
  results,
  reason: pairs.length === 0 ? "No baseline/candidate screenshot pairs were available." : null,
};
await fs.mkdir(path.dirname(receiptPath), { recursive: true });
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ receiptPath, status, pairs: pairs.length })}\n`);
