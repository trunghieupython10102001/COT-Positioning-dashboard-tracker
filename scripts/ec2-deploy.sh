#!/usr/bin/env bash
set -euo pipefail
cd /var/www/cot
git pull --ff-only
npm ci
npm run build
pm2 restart cot
pm2 save
echo "[deploy] done"
