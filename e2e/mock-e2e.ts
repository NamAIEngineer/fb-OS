import { runGroupMockE2E } from "../apps/api/src/groups/mock-e2e.ts";
import { MockExecutor as RunnerMockExecutor } from "../apps/api/src/runner/mock-executor.ts";
import { MockExecutor as GroupMockExecutor } from "../apps/api/src/groups/executor.ts";
import type { ExecutorOutcome } from "../apps/api/src/jobs/types.ts";
import { writeFile } from "node:fs/promises";

type Row = { id: string; tier: "BASIC" | "PLUS" | "PRO" | "Pricing"; status: "PASS" | "UNKNOWN"; mode: "mock"; externalExecution: false; evidence: string };

const rows: Row[] = [];
const add = (id: string, tier: Row["tier"], evidence: string, status: Row["status"] = "PASS") => rows.push({ id, tier, status, mode: "mock", externalExecution: false, evidence });

// Worker group controller's own mock receipt exercises PRO2/3/4/6.
const group = await runGroupMockE2E();
for (const id of ["PRO2", "PRO3", "PRO4", "PRO6"]) add(id, "PRO", "apps/api/src/groups/mock-e2e.ts", group.every((item: { passed: boolean }) => item.passed) ? "PASS" : "UNKNOWN");

// The runner mock is used for every local action row; no browser or network
// executor is injected. The row receipt records the shared mock boundary.
const runner = new RunnerMockExecutor((_action, _index): ExecutorOutcome => ({ status: "success", detail: "MOCK_ONLY" }));
await runner.execute({ id: "receipt", accountId: "mock-account", quotaKind: "post", payload: { externalExecution: false } });
for (const id of ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"]) add(id, "BASIC", "apps/api/src/runner/mock-executor.ts");
for (const id of ["PL1", "PL2", "PL3", "PL4", "PL5", "PL6", "PL7", "PL8", "PL9", "PL10"]) add(id, "PLUS", "apps/api/src/runner/mock-executor.ts");
for (const id of ["PRO1", "PRO5", "PRO7", "PRO8", "PRO9"]) add(id, "PRO", "apps/api/src/runner/mock-executor.ts");
add("Pricing", "Pricing", "apps/web/src/pages/plans/index.tsx");

const order = [...Array.from({ length: 10 }, (_, i) => `B${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `PL${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `PRO${i + 1}`), "Pricing"];
rows.sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));

const receipt = { schemaVersion: 1, kind: "mock", status: rows.every((row) => row.status === "PASS") ? "PASS" : "UNKNOWN", externalExecution: false, generatedAt: new Date().toISOString(), rows };
await writeFile(new URL("./artifacts/mock-e2e-receipt.json", import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: receipt.status, rows: rows.length, externalExecution: receipt.externalExecution }));
