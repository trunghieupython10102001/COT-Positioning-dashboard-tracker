# EC2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the COT dashboard from the existing EC2 box with its data stored on-disk (out of git), keeping the `*.vercel.app` URL via a Vercel proxy.

**Architecture:** App code reads COT + price JSON from a `DATA_DIR` at request time (ISR, `revalidate=3600`) instead of baking it into the build. On EC2 the app runs under PM2 on :3100 behind a new nginx block on :8081; Vercel rewrites all traffic to that origin. A weekly PM2 cron refreshes the on-disk data — no commit, no rebuild.

**Tech Stack:** Next.js 16, Node 24, PM2, nginx, Vercel rewrites.

## Global Constraints

- Work on branch `migrate-to-ec2` (already created).
- Do NOT modify the existing `tradevault` app, its nginx `default_server` block, or its PM2 processes.
- COT app port is **3100**; nginx COT port is **8081** (3000/4000/80 are taken).
- `DATA_DIR` env: real value on EC2 is `/var/lib/cot-data`; unset locally → falls back to `src/generated`.
- EC2: host `ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com`, user `ubuntu`, key `/Users/harry/Workspace/trading-journal/harry-server.pem`, port 22. Repo dir on box: `/var/www/cot`.
- This repo has no test runner; verification is `next build` + runtime smoke checks (no test framework is added).

---

## Phase 1 — Application code (local, branch `migrate-to-ec2`)

### Task 1: Add `DATA_DIR` helper and convert COT records to runtime reads

**Files:**
- Create: `src/lib/data-dir.ts`
- Modify: `src/lib/cot-data.ts` (replace static JSON import with runtime read; turn `cotRecords` const and `isUsingGeneratedCotData` const into functions)
- Modify consumers: `src/app/page.tsx:78`, `src/app/contracts/[key]/page.tsx:15`, `src/app/status/page.tsx:3,14,22,24`

**Interfaces:**
- Produces: `getDataDir(): string`; `getAllCotRecords(): CotRecord[]`; `isUsingGeneratedCotData(): boolean`. Unchanged: `getContractRecords(key): CotRecord[]`, `hasCotRecords(key): boolean`, `latestReportDate(): string`, type `CotRecord`.

- [ ] **Step 1: Create the data-dir helper**

`src/lib/data-dir.ts`:
```ts
import path from "node:path";

/** Directory holding generated COT + price JSON. Override with DATA_DIR on EC2. */
export function getDataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "src", "generated");
}
```

- [ ] **Step 2: Replace the static import at the top of `src/lib/cot-data.ts`**

Remove:
```ts
import generatedRecords from "@/generated/cot-records.json";
```
Add (at top of file):
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "./data-dir";
```

- [ ] **Step 3: Replace the two `generatedRecords`-based const exports** (near the bottom, the `export const cotRecords` and `export const isUsingGeneratedCotData` lines)

Replace:
```ts
export const cotRecords: CotRecord[] =
  generatedRecords.length > 0 ? (generatedRecords as CotRecord[]) : seedCotRecords;

export const isUsingGeneratedCotData = generatedRecords.length > 0;
```
With:
```ts
function readGeneratedCotRecords(): CotRecord[] {
  try {
    const filePath = path.join(getDataDir(), "cot-records.json");
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? (parsed as CotRecord[]) : [];
  } catch {
    return [];
  }
}

export function getAllCotRecords(): CotRecord[] {
  const generated = readGeneratedCotRecords();
  return generated.length > 0 ? generated : seedCotRecords;
}

export function isUsingGeneratedCotData(): boolean {
  return readGeneratedCotRecords().length > 0;
}
```

- [ ] **Step 4: Update the three reader functions to call `getAllCotRecords()`**

Replace the bodies of `getContractRecords`, `hasCotRecords`, `latestReportDate` so they read fresh:
```ts
export function getContractRecords(contractKey: string) {
  return getAllCotRecords()
    .filter((record) => record.contractKey === contractKey)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}

export function hasCotRecords(contractKey: string) {
  return getAllCotRecords().some((record) => record.contractKey === contractKey);
}

export function latestReportDate() {
  return getAllCotRecords().reduce(
    (latest, record) => (record.reportDate > latest ? record.reportDate : latest),
    "",
  );
}
```

- [ ] **Step 5: Update consumers from const to function calls**

`src/app/page.tsx:78` — `{isUsingGeneratedCotData ? (` → `{isUsingGeneratedCotData() ? (`

`src/app/contracts/[key]/page.tsx:15` — `.filter((contract) => !isUsingGeneratedCotData || hasCotRecords(contract.key))` → `.filter((contract) => !isUsingGeneratedCotData() || hasCotRecords(contract.key))`

`src/app/status/page.tsx`:
- line 3 import: `import { cotRecords, isUsingGeneratedCotData, latestReportDate } from "@/lib/cot-data";` → `import { getAllCotRecords, isUsingGeneratedCotData, latestReportDate } from "@/lib/cot-data";`
- line 14: `{isUsingGeneratedCotData` → `{isUsingGeneratedCotData()`
- line 22: `["COT rows", cotRecords.length.toString()],` → `["COT rows", getAllCotRecords().length.toString()],`
- line 24: `["Data mode", isUsingGeneratedCotData ? "Generated CFTC" : "Seed fallback"],` → `["Data mode", isUsingGeneratedCotData() ? "Generated CFTC" : "Seed fallback"],`

- [ ] **Step 6: Type-check via build**

Run: `npm run build`
Expected: build succeeds, no TS errors about `isUsingGeneratedCotData`/`cotRecords`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data-dir.ts src/lib/cot-data.ts src/app/page.tsx "src/app/contracts/[key]/page.tsx" src/app/status/page.tsx
git commit -m "refactor: read COT records from DATA_DIR at runtime"
```

---

### Task 2: Point price data at `DATA_DIR`

**Files:**
- Modify: `src/lib/price-data.ts`

**Interfaces:**
- Consumes: `getDataDir()` from Task 1.
- Produces: unchanged `getPriceCandles(key): PriceCandle[]`.

- [ ] **Step 1: Replace the hardcoded path in `getPriceCandles`**

At top, add `import { getDataDir } from "./data-dir";` (keep `path`, drop reliance on `process.cwd()`).
Replace:
```ts
    const filePath = path.join(
      process.cwd(),
      "src",
      "generated",
      "price-data",
      `${contractKey}.json`,
    );
```
With:
```ts
    const filePath = path.join(getDataDir(), "price-data", `${contractKey}.json`);
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/price-data.ts
git commit -m "refactor: read price data from DATA_DIR"
```

---

### Task 3: Enable ISR so disk updates appear without a rebuild

**Files:**
- Modify: `src/app/page.tsx`, `src/app/contracts/[key]/page.tsx`, `src/app/status/page.tsx`

**Interfaces:** none.

- [ ] **Step 1: Add a revalidate export to each of the three pages**

At the top of each file (after imports), add:
```ts
export const revalidate = 3600;
```
Leave `generateStaticParams` in `contracts/[key]/page.tsx` as-is (path enumeration is fine; ISR re-reads data on revalidation).

- [ ] **Step 2: Smoke-test generated mode**

Run:
```bash
npm run build && DATA_DIR="$(pwd)/src/generated" npx next start -p 3100 &
sleep 4 && curl -s localhost:3100/status | grep -o "Generated CFTC" ; kill %1
```
Expected: prints `Generated CFTC`.

- [ ] **Step 3: Smoke-test seed fallback**

Run:
```bash
mkdir -p /tmp/empty-cot && DATA_DIR=/tmp/empty-cot npx next start -p 3100 &
sleep 4 && curl -s localhost:3100/status | grep -o "Seed fallback" ; kill %1
```
Expected: prints `Seed fallback`.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx "src/app/contracts/[key]/page.tsx" src/app/status/page.tsx
git commit -m "feat: ISR revalidate so on-disk data refresh needs no rebuild"
```

---

### Task 4: Remove generated data from git

**Files:**
- Modify: `.gitignore`
- Remove from tracking: `src/generated/cot-records.json`, `src/generated/price-data/`

- [ ] **Step 1: Append to `.gitignore`** (under the existing next.js section):
```
# generated data — lives on EC2 disk (DATA_DIR), regenerated by import scripts
/src/generated/cot-records.json
/src/generated/price-data/
```

- [ ] **Step 2: Untrack the files (keep them on disk locally)**

Run:
```bash
git rm -r --cached src/generated/cot-records.json src/generated/price-data
```

- [ ] **Step 3: Verify they are now ignored**

Run: `git status --short src/generated`
Expected: deletions staged; the files no longer show as tracked/modified going forward.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: stop tracking generated data (moves to EC2 disk)"
```

---

### Task 5: Make import scripts honor `DATA_DIR`

**Files:**
- Modify: `scripts/import-cftc.mjs:362`, `scripts/fetch-prices.mjs:58`

- [ ] **Step 1: `scripts/import-cftc.mjs`** — replace line 362:
```js
  const generatedDir = path.join(process.cwd(), "src", "generated");
```
with:
```js
  const generatedDir = process.env.DATA_DIR ?? path.join(process.cwd(), "src", "generated");
```

- [ ] **Step 2: `scripts/fetch-prices.mjs`** — replace line 58:
```js
  const outputDir = path.join(process.cwd(), "src", "generated", "price-data");
```
with:
```js
  const baseDir = process.env.DATA_DIR ?? path.join(process.cwd(), "src", "generated");
  const outputDir = path.join(baseDir, "price-data");
```

- [ ] **Step 3: Verify locally writes to an override dir**

Run: `DATA_DIR=/tmp/cot-test npm run fetch:prices && ls /tmp/cot-test/price-data | head`
Expected: JSON files written under `/tmp/cot-test/price-data`.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-cftc.mjs scripts/fetch-prices.mjs
git commit -m "feat: import scripts write to DATA_DIR when set"
```

---

### Task 6: PM2 ecosystem + refresh script + deploy script

**Files:**
- Create: `ecosystem.config.js`, `scripts/refresh-data.sh`, `scripts/ec2-deploy.sh`

- [ ] **Step 1: `ecosystem.config.js`**
```js
module.exports = {
  apps: [
    {
      name: "cot",
      cwd: "/var/www/cot",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      env: { NODE_ENV: "production", PORT: "3100", DATA_DIR: "/var/lib/cot-data" },
      autorestart: true,
      max_memory_restart: "400M",
    },
    {
      name: "cot-refresh",
      cwd: "/var/www/cot",
      script: "scripts/refresh-data.sh",
      interpreter: "bash",
      autorestart: false,
      cron_restart: "0 22 * * 5",
      env: { DATA_DIR: "/var/lib/cot-data" },
    },
  ],
};
```

- [ ] **Step 2: `scripts/refresh-data.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DATA_DIR="${DATA_DIR:-/var/lib/cot-data}"
echo "[refresh] $(date -u) writing to $DATA_DIR"
npm run import:cftc
npm run fetch:prices
echo "[refresh] done"
```

- [ ] **Step 3: `scripts/ec2-deploy.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /var/www/cot
git pull --ff-only
npm ci
npm run build
pm2 restart cot
pm2 save
echo "[deploy] done"
```

- [ ] **Step 4: Make scripts executable + commit**
```bash
chmod +x scripts/refresh-data.sh scripts/ec2-deploy.sh
git add ecosystem.config.js scripts/refresh-data.sh scripts/ec2-deploy.sh
git commit -m "feat: PM2 ecosystem, refresh cron, and deploy script for EC2"
```

---

### Task 7: Vercel proxy + disable old data workflow

**Files:**
- Create: `vercel.json`
- Modify: `.github/workflows/update-cot-data.yml`

- [ ] **Step 1: `vercel.json`** (catch-all rewrite to the EC2 origin)
```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "http://ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com:8081/:path*"
    }
  ]
}
```

- [ ] **Step 2: Disable the GitHub Actions data cron** — in `.github/workflows/update-cot-data.yml`, remove the `schedule:` trigger so it only runs on `workflow_dispatch`. Replace the `on:` block with:
```yaml
on:
  # Data refresh now runs on EC2 (PM2 cron). Manual-only fallback kept.
  workflow_dispatch:
```

- [ ] **Step 3: Commit**
```bash
git add vercel.json .github/workflows/update-cot-data.yml
git commit -m "feat: proxy Vercel to EC2 origin; retire GitHub Actions data cron"
```

> ⚠️ Do NOT push/merge to `main` yet — pushing `vercel.json` flips the live site to the EC2 origin. Merge only in Task 12 after EC2 is serving (Phase 2).

---

## Phase 2 — EC2 provisioning (run from laptop; SSH commands)

Helper for all SSH steps:
```bash
PEM=/Users/harry/Workspace/trading-journal/harry-server.pem
HOST=ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com
SSH="ssh -i $PEM ubuntu@$HOST"
```

### Task 8: Clone repo + create data dir + seed data + build on the box

- [ ] **Step 1: Push the branch so EC2 can clone it**
```bash
git push -u origin migrate-to-ec2
```

- [ ] **Step 2: Clone into `/var/www/cot` and create the data dir**
```bash
$SSH '
  sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www
  git clone -b migrate-to-ec2 https://github.com/trunghieupython10102001/COT-Positioning-dashboard-tracker.git /var/www/cot
  sudo mkdir -p /var/lib/cot-data/price-data && sudo chown -R ubuntu:ubuntu /var/lib/cot-data
'
```

- [ ] **Step 3: Install deps + seed data into `/var/lib/cot-data`**
```bash
$SSH 'cd /var/www/cot && npm ci && DATA_DIR=/var/lib/cot-data npm run import:cftc && DATA_DIR=/var/lib/cot-data npm run fetch:prices'
```
Expected: `cot-records.json` and `price-data/*.json` present under `/var/lib/cot-data`.

- [ ] **Step 4: Build**
```bash
$SSH 'cd /var/www/cot && DATA_DIR=/var/lib/cot-data npm run build'
```
Expected: build succeeds (2 GB swap covers memory).

---

### Task 9: nginx block on :8081

- [ ] **Step 1: Write the new server block** (additive; tradevault untouched)
```bash
$SSH 'sudo tee /etc/nginx/sites-available/cot >/dev/null <<'"'"'EOF'"'"'
server {
    listen 8081;
    server_name _;
    client_max_body_size 5m;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/cot /etc/nginx/sites-enabled/cot
sudo nginx -t && sudo systemctl reload nginx'
```
Expected: `nginx -t` reports syntax ok; reload succeeds.

---

### Task 10: Start the app + cron under PM2

- [ ] **Step 1: Start both processes from the ecosystem file**
```bash
$SSH 'cd /var/www/cot && pm2 start ecosystem.config.js && pm2 save'
```
Expected: `pm2 list` shows `cot` online and `cot-refresh` (stopped/exited is expected — it only runs on cron).

- [ ] **Step 2: Verify the app answers locally on the box**
```bash
$SSH 'curl -sI http://127.0.0.1:3100 | head -1 && curl -s http://127.0.0.1:8081/status | grep -o "Generated CFTC"'
```
Expected: `HTTP/1.1 200 OK` and `Generated CFTC`.

---

### Task 11: Open port 8081 in the AWS security group (USER action)

- [ ] **Step 1: Find the instance's security group id** (run locally; requires AWS CLI configured, or use the console)
```bash
aws ec2 describe-instances --filters "Name=ip-address,Values=13.212.83.12" \
  --query "Reservations[].Instances[].SecurityGroups" --output table
```

- [ ] **Step 2: Authorize inbound TCP 8081**
```bash
aws ec2 authorize-security-group-ingress --group-id <SG_ID> \
  --protocol tcp --port 8081 --cidr 0.0.0.0/0
```
Console alternative: EC2 → Security Groups → that SG → Inbound rules → Add rule → Custom TCP, port 8081, source 0.0.0.0/0.

- [ ] **Step 3: Verify reachable from the internet**
```bash
curl -sI http://ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com:8081/status | head -1
```
Expected: `HTTP/1.1 200 OK`.

---

### Task 12: Cutover + end-to-end verification

- [ ] **Step 1: Merge the branch to `main`** (this is what flips Vercel to the EC2 origin via `vercel.json`)
```bash
git checkout main && git merge --no-ff migrate-to-ec2 -m "feat: migrate hosting + data to EC2" && git push origin main
```

- [ ] **Step 2: Wait for the Vercel deploy, then verify the public URL serves from EC2**
```bash
curl -s https://cot-positioning-dashboard-tracker-m.vercel.app/status | grep -o "Generated CFTC"
```
Expected: `Generated CFTC` (served via Vercel → EC2 proxy).

- [ ] **Step 3: Verify a data change appears without a rebuild** — touch a value on disk and confirm it surfaces within the revalidate window:
```bash
$SSH 'cd /var/www/cot && DATA_DIR=/var/lib/cot-data npm run fetch:prices'
# after up to ~1h (or pm2 restart cot to force immediately), reload a contract page
```
Expected: latest price candle date matches the freshly fetched data.

- [ ] **Step 4: Confirm tradevault still works**
```bash
curl -sI http://ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com/ | head -1
```
Expected: `HTTP/1.1 200 OK` (tradevault unaffected on :80).

---

## Self-Review

**Spec coverage:** Domain proxy (Task 7) ✓ · data out of git (Task 4) ✓ · runtime reads (Tasks 1–2) ✓ · ISR (Task 3) ✓ · DATA_DIR scripts (Task 5) ✓ · PM2 app + cron (Tasks 6, 10) ✓ · nginx :8081 (Task 9) ✓ · SG 8081 (Task 11) ✓ · retire GH Actions (Task 7) ✓ · deploy script (Task 6) ✓ · all 5 acceptance criteria covered by Task 12 + Task 3 smoke tests.

**Placeholders:** none — every code/command step is concrete. `<SG_ID>` in Task 11 is a runtime-discovered value (Step 1 finds it), not a plan gap.

**Type consistency:** `getAllCotRecords`, `isUsingGeneratedCotData`, `getDataDir`, `getContractRecords`, `hasCotRecords`, `latestReportDate`, `getPriceCandles` used identically across Tasks 1–3 and consumer edits.
