# COT Dashboard — Vercel → EC2 Migration Design

**Date:** 2026-06-23
**Status:** Approved design (pending implementation plan)

## Problem

The app commits ~13 MB of generated data JSON (`src/generated/cot-records.json` +
`src/generated/price-data/*.json`) to git, and the weekly refresh keeps growing it.
This is hitting Vercel/repo file-size limits. We want the **app and its data to live
on an existing EC2 box**, keeping Vercel only as the domain/edge.

## Goal

- Move app runtime + data storage onto EC2 (which the user already owns and which
  already hosts the `tradevault` app).
- Keep the existing public URL `https://cot-positioning-dashboard-tracker-m.vercel.app/`.
- Get the data files **out of git** permanently → fixes the repo-size limit.
- Weekly data refresh runs **on EC2**, no commit, no rebuild.

## Existing EC2 environment (discovered)

| Item | Value |
|---|---|
| Host | `ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com` (13.212.83.12) |
| SSH | user `ubuntu`, port 22, key `harry-server.pem` |
| OS / runtime | Ubuntu 26.04, Node 24.15, npm 11 |
| Process mgr | **PM2** (`tradevault` :3000, `tradevault-api` :4000, pm2-logrotate) |
| Web server | nginx, **:80 only**, single block `tradevault` = `default_server` (matches the EC2 hostname, IP, and `_`) |
| TLS | none on box (tradevault uses the Vercel-proxy-over-HTTP pattern) |
| RAM | ~908 MB, **2 GB swapfile already present** |
| Disk | 19 GB, ~7.3 GB free |
| DB | local Postgres :5432 (tradevault only; COT does not use it) |

**Constraints derived:**
- Ports 3000/4000 taken → COT app uses **:3100**.
- nginx :80 default block belongs to tradevault and must stay untouched → COT gets a
  **dedicated nginx port :8081**.
- Swap already exists → builds are fine on this small box.

## Decisions

| # | Decision | Choice |
|---|---|---|
| A | Domain routing | **Vercel rewrite/proxy** — `*.vercel.app` can't A-record to EC2, so keep the URL and proxy. Matches the existing tradevault pattern. |
| B | Build memory | No action — 2 GB swap already present. |
| C | Process manager | **PM2** — match the box (single `pm2 list`, existing logrotate/startup). |
| D | COT app port | **3100** (3000/4000 taken). |
| E | nginx routing | **New server block on :8081** → `127.0.0.1:3100`. tradevault :80 block untouched. |
| F | Data location | **`/var/lib/cot-data/`** on EC2, outside the repo, gitignored. |

## Architecture

```
Browser
  │  HTTPS
  ▼
Vercel (cot-positioning-dashboard-tracker-m.vercel.app)   ← DNS + TLS only
  │  vercel.json catch-all rewrite  →  http://ec2-13-212-83-12...:8081/:path*
  ▼
EC2 nginx  (new server block, listen 8081)
  │  proxy_pass
  ▼
COT Next.js app  (PM2 "cot", next start, 127.0.0.1:3100)
  │  reads at runtime
  ▼
/var/lib/cot-data/           ← persistent, gitignored
  ├── cot-records.json
  └── price-data/*.json
        ▲
        │ writes (Fri 22:00 UTC)
  PM2 cron: import:cftc + fetch:prices
```

The existing `tradevault` app on :80/:3000/:4000 is **unaffected**.

## Changes by area

### 1. App code — read data from disk at runtime
- **`src/lib/cot-data.ts`**: replace the static `import generatedRecords from "@/generated/cot-records.json"`
  with a runtime read from `DATA_DIR` (env), matching the pattern already in `price-data.ts`.
- **`src/lib/price-data.ts`**: point its `readFileSync` base at `DATA_DIR` too (instead of
  hardcoded `process.cwd()/src/generated`).
- **`DATA_DIR`** env: defaults to `src/generated` for local dev; set to `/var/lib/cot-data`
  in the EC2 service env.
- **Pages** (`src/app/contracts/[key]/page.tsx`, etc.): switch from build-time SSG
  (`generateStaticParams` pre-render) to **ISR with `export const revalidate = 3600`**, so
  fresh data on disk is served without a rebuild. `generateStaticParams` may stay for path
  enumeration but pages must not bake data permanently.
- **`.gitignore`**: add `/src/generated/cot-records.json` and `/src/generated/price-data/`.
  (Local dev regenerates them via the existing npm scripts.)

### 2. Data on EC2
- Create `/var/lib/cot-data/` owned by `ubuntu`.
- Seed it once by running the import scripts on the box (or rsync current generated files up).

### 3. nginx — additive only
New file `/etc/nginx/sites-available/cot` (symlinked into `sites-enabled`):
```nginx
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
```
`nginx -t` then reload. The tradevault block is not edited.

### 4. PM2 — COT app + refresh cron
- App: `pm2 start npm --name cot -- start` with env `PORT=3100 DATA_DIR=/var/lib/cot-data`
  (via an ecosystem file in the repo), then `pm2 save`.
- Refresh: a second PM2 process with `cron_restart`/`autorestart:false` (or a dedicated
  ecosystem `cron` entry) running `npm run import:cftc && npm run fetch:prices` at
  `0 22 * * 5`, env `DATA_DIR=/var/lib/cot-data`.

### 5. Vercel — turn the project into a proxy
- Add `vercel.json` with a catch-all rewrite to the EC2 origin:
```json
{ "rewrites": [
  { "source": "/:path*", "destination": "http://ec2-13-212-83-12.ap-southeast-1.compute.amazonaws.com:8081/:path*" }
] }
```
- The Vercel build still succeeds but serves nothing of substance; all traffic proxies to EC2.

### 6. AWS Security Group — the one manual step
- Open **inbound TCP 8081** (source `0.0.0.0/0`) so Vercel can reach the COT origin.
  Done via AWS console or `aws ec2 authorize-security-group-ingress`. The user performs this
  (no SSH equivalent). Exact command provided at implementation time.

### 7. Decommission old data pipeline
- Disable `.github/workflows/update-cot-data.yml` (the GitHub Actions cron that committed data).

### 8. Deploy script (code changes only, runs rarely)
- `scripts/ec2-deploy.sh`: `git pull && npm ci && npm run build && pm2 restart cot`.

## Out of scope
- HTTPS/Let's Encrypt on the box (Vercel terminates TLS).
- Custom domain (staying on `*.vercel.app`).
- Postgres / any database (app is file-backed).
- Touching the tradevault app or its nginx/PM2 config.

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Port 8081 exposes COT origin publicly (bypasses Vercel) | Acceptable — data is public, mirrors existing tradevault :80 exposure. |
| ISR serves stale data up to 1 h after refresh | `revalidate = 3600`; acceptable for weekly data. Can lower if desired. |
| Small RAM during build | 2 GB swap already present; build runs rarely. |
| Asset serving slower (no Vercel CDN) | Low-traffic dashboard; acceptable. |

## Acceptance criteria
1. `https://cot-positioning-dashboard-tracker-m.vercel.app/` serves the app **from EC2** (verify via an EC2-only marker / response header or by stopping Vercel's own build output).
2. Generated data files are **gitignored** and absent from new commits.
3. Updating files in `/var/lib/cot-data/` changes the live site within the revalidate window **without a rebuild**.
4. The Friday PM2 cron refreshes data on the box.
5. `tradevault` remains fully functional throughout.
