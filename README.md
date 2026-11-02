# GroupPilot

GroupPilot is a provider-neutral rebuild workspace for community posting and plan management. `BRAND_NAME` defaults to `GroupPilot`; no original service branding is shipped.

## Run locally

Requirements: Node 22+, Corepack, pnpm 12.

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm dev
```

The API listens on `http://127.0.0.1:4000` and the Vite web app on `http://127.0.0.1:5173`. API health is available at `/health` and `/api/health`. Persistence uses a SQLite-compatible `sql.js` database at `apps/data/grouppilot.sqlite` by default; set `DATABASE_PATH` to override it. Socket.io is served from the API process.

Demo account: `demo@grouppilot.local` / `demo-password`. Demo vouchers: `GP-BASIC-DEMO`, `GP-PLUS-DEMO`, `GP-PRO-DEMO`.

Docker:

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Pricing and gates

`/plans` renders BASIC, PLUS, and PRO cards. The PRO card uses the captured source presentation cues: orange recommendation border, `ĐỀ XUẤT` ribbon, `Vĩnh viễn` badge, lifetime price, feature list, and `Thanh toán qua QR` CTA. QR checkout is a local mock (`POST /api/payments/create-qr`) and `POST /api/payments/mock-webhook` marks a payment paid without real money.

Plans and server gate ranks live in `packages/shared/src/contracts.ts`. Auth, profile, voucher redemption, payment mock, affiliate profile, and server-side gate routes are under `apps/api/src/`. The browser shell keeps `/search-customers` deferred and does not expose personal contact lookup or personal export fields.

## Progress

| Area | Progress | Evidence state |
| --- | ---: | --- |
| BASIC | 0/10 | Implementation owned by feature workers; E2E UNKNOWN |
| PLUS | 0/10 | Implementation owned by feature workers; E2E UNKNOWN |
| PRO | 0/9 | Implementation owned by feature workers; E2E UNKNOWN |
| Pricing | 1/1 shell | Source cues pinned; visual diff UNKNOWN |

The source bundle evidence SHA and full feature trace are kept under the plan workspace, outside this product repository. Unknown source descriptions remain marked `UNKNOWN` in shared contracts.
