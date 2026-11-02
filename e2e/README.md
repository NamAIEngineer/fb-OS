# Independent E2E harness

Scope: read-only route observation, isolated Playwright profiles, machine-readable receipts, and conservative screenshot comparison. The harness never logs in, submits forms, touches Facebook, starts the product server, or writes outside its declared evidence paths.

## Commands

Run from `products/fb-group-suite/`:

```sh
# Public baseline candidates. No credentials or login flow.
node e2e/run.mjs --baseline

# Local product. The server must already be running; default is http://127.0.0.1:5173.
BASE_URL=http://127.0.0.1:5173 node e2e/run.mjs --product

# Playwright Test route suite, when @playwright/test is available.
corepack pnpm --filter @grouppilot/e2e run test:list

# Compare matching PNG names. Missing pairs or unavailable decoder remain UNKNOWN.
node e2e/visual-diff.mjs
```

`run.mjs` uses a fresh persistent profile under `/tmp` per mode. Receipts are JSON and follow [`receipt.schema.json`](./receipt.schema.json). Baseline images go to `plans/fbtool-rebuild-20261102/screenshots/baseline/`; product images go to the corresponding `product/` directory. Set `REFERENCE_URL`, `BASE_URL`, `RECEIPT_DIR`, `SCREENSHOT_DIR`, or `PROFILE_DIR` to use an explicitly supplied local target.

An unavailable Playwright package, browser binary, local app, or route is reported as `UNKNOWN`; the runner exits successfully so a missing dependency cannot be mistaken for a product failure. `visual-diff.mjs` only claims `PASS` for exact bytes or a decoded pixel score at/above `0.95`.

## API production route boundary

The default API build mounts core health/auth/plan/payment routes. Feature controllers remain source owned and are mounted by the `tsx` development entrypoint. A production process only attempts feature mounting when `FEATURE_ROUTES_ROOT` points to a prebuilt, Node-resolvable ESM feature graph; without that explicit artifact the process starts core routes and makes no feature-route claim. Current TypeScript emit is not sufficient for that opt-in graph because several worker imports are extensionless, so a production feature-route claim remains UNKNOWN until the graph is bundled or imports are repaired.
