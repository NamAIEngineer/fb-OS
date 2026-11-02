import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { PRODUCT_ROUTES, VIEWPORTS } from "../routes.mjs";

const receiptDir = process.env.RECEIPT_DIR || path.resolve("e2e", "artifacts");
const receiptPath = path.join(receiptDir, "playwright-test-receipt.json");
const results = [];

test.afterAll(async () => {
  await fs.mkdir(receiptDir, { recursive: true });
  const startedAt = results[0]?.observedAt || new Date().toISOString();
  const status = results.some((result) => result.status === "FAIL")
    ? "FAIL"
    : results.length > 0 && results.every((result) => result.status === "PASS")
      ? "PASS"
      : "UNKNOWN";
  await fs.writeFile(receiptPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: "product",
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: process.env.BASE_URL || "http://127.0.0.1:5173",
    profileDir: null,
    reason: status === "UNKNOWN" ? "One or more route observations were unavailable." : null,
    results,
  }, null, 2)}\n`, "utf8");
});

for (const viewport of VIEWPORTS) {
  for (const route of PRODUCT_ROUTES) {
    test(`${route.id} ${viewport.width}x${viewport.height}`, async ({ page, baseURL }, testInfo) => {
      const observedAt = new Date().toISOString();
      const started = Date.now();
      await page.setViewportSize(viewport);
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      let response = null;
      let status = "UNKNOWN";
      let reason = null;
      try {
        response = await page.goto(new URL(route.path, baseURL).toString(), { waitUntil: "domcontentloaded" });
        status = response && response.status() >= 400 ? "FAIL" : "PASS";
      } catch (error) {
        reason = `${error?.name || "NavigationError"}: ${error?.message || error}`;
      }
      results.push({
        routeId: route.id,
        path: route.path,
        viewport,
        status,
        observedAt,
        httpStatus: response?.status() ?? null,
        finalUrl: page.url(),
        authState: /\/(login|register)(?:[/?#]|$)/i.test(page.url()) ? "anonymous-redirect" : "anonymous",
        screenshot: null,
        consoleErrors,
        pageErrors,
        durationMs: Date.now() - started,
        reason,
      });
      expect(status, `${route.path} observation`).not.toBe("FAIL");
      testInfo.attachments.push({ name: "route-receipt", contentType: "application/json", body: Buffer.from(JSON.stringify(results.at(-1))) });
    });
  }
}
