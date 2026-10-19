#!/usr/bin/env bash
set -euo pipefail
cd /var/www/cot
git pull --ff-only
npm ci
npm run build
# Re-normalize CFTC data so its shape always matches the code being started.
DATA_DIR="${DATA_DIR:-/var/lib/cot-data}" npm run import:cftc
pm2 restart cot
pm2 save
echo "[deploy] done"
