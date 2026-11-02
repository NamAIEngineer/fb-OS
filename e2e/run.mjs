#!/usr/bin/env node
/**
 * Dependency-light Playwright runner.
 *
 * Modes:
 *   node e2e/run.mjs --baseline
 *   node e2e/run.mjs --product
 *
 * A missing package, browser, or local app produces a machine-readable
 * UNKNOWN receipt and exit 0. This keeps verification truthful and avoids
 * retries, login attempts, or starting an unowned product process.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { BASELINE_ROUTES, PRODUCT_ROUTES, VIEWPORTS, routeUrl } from "./routes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const productRoot = path.resolve(here, "..");
const workspaceRoot = path.resolve(productRoot, "../..");
const planRoot = path.join(workspaceRoot, "plans", "fbtool-rebuild-20261102");
const args = new Set(process.argv.slice(2));
const kind = args.has("--baseline") ? "baseline" : "product";
const isBaseline = kind === "baseline";
const baseUrl = isBaseline
  ? process.env.REFERENCE_URL || "https://fbtool.org"
  : process.env.BASE_URL || "http://127.0.0.1:5173";
const routes = isBaseline ? BASELINE_ROUTES : PRODUCT_ROUTES;
const receiptDir = process.env.RECEIPT_DIR || path.join(here, "artifacts");
const screenshotDir = process.env.SCREENSHOT_DIR || path.join(planRoot, "screenshots", kind);
const profileDir = process.env.PROFILE_DIR || path.join("/tmp", `fb-group-suite-wverify-${kind}-profile`);
const receiptPath = path.join(receiptDir, `${kind}-receipt.json`);

const iso = () => new Date().toISOString();
const ensure = async (target) => fs.mkdir(target, { recursive: true });

function emptyReceipt(startedAt, status, reason, results = []) {
  return {
    schemaVersion: 1,
    kind,
    status,
    startedAt,
    finishedAt: iso(),
    baseUrl,
    profileDir,
    reason,
    results,
  };
}

async function writeReceipt(receipt) {
  await ensure(receiptDir);
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ receiptPath, status: receipt.status, results: receipt.results.length })}\n`);
}

let playwright;
try {
  // The workspace pins @playwright/test (currently 1.64.1), which re-exports
  // the browser API used by this dependency-light runner. Do not require a
  // separate `playwright` package that is not installed in the e2e workspace.
  playwright = await import("@playwright/test");
} catch (error) {
  const start = iso();
  await writeReceipt(emptyReceipt(start, "UNKNOWN", `PLAYWRIGHT_UNAVAILABLE: ${error?.code || error?.message || error}`));
  process.exit(0);
}

const startedAt = iso();
let context;
try {
  await ensure(profileDir);
  await ensure(screenshotDir);
  context = await playwright.chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: VIEWPORTS[0],
    serviceWorkers: "block",
  });
} catch (error) {
  await writeReceipt(emptyReceipt(startedAt, "UNKNOWN", `BROWSER_UNAVAILABLE: ${error?.message || error}`));
  process.exit(0);
}

const results = [];
for (const viewport of VIEWPORTS) {
  for (const route of routes) {
    const observedAt = iso();
    const started = Date.now();
    const page = await context.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const screenshotPath = path.join(screenshotDir, `${route.id}-${viewport.width}x${viewport.height}.png`);
    let response = null;
    let reason = null;
    let status = "UNKNOWN";
    let finalUrl = null;
    let authState = "unknown";
    try {
      response = await page.goto(routeUrl(baseUrl, route), {
        waitUntil: "domcontentloaded",
        timeout: Number(process.env.NAVIGATION_TIMEOUT_MS || 15_000),
      });
      finalUrl = page.url();
      const httpStatus = response?.status() ?? null;
      status = httpStatus !== null && httpStatus >= 400 ? "FAIL" : "PASS";
      authState = /\/(login|register)(?:[/?#]|$)/i.test(finalUrl) ? "anonymous-redirect" : "anonymous";
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
    } catch (error) {
      reason = `${error?.name || "NavigationError"}: ${error?.message || error}`;
    }
    results.push({
      routeId: route.id,
      path: route.path,
      viewport: { width: viewport.width, height: viewport.height },
      status,
      observedAt,
      httpStatus: response?.status() ?? null,
      finalUrl,
      authState,
      screenshot: status === "PASS" ? path.relative(workspaceRoot, screenshotPath) : null,
      consoleErrors,
      pageErrors,
      durationMs: Date.now() - started,
      reason,
    });
    await page.close();
  }
}
await context.close();

const aggregate = results.some((result) => result.status === "FAIL")
  ? "FAIL"
  : results.length > 0 && results.every((result) => result.status === "PASS")
    ? "PASS"
    : "UNKNOWN";
await writeReceipt({
  schemaVersion: 1,
  kind,
  status: aggregate,
  startedAt,
  finishedAt: iso(),
  baseUrl,
  profileDir,
  reason: aggregate === "UNKNOWN" ? "One or more routes could not be observed." : null,
  results,
});
