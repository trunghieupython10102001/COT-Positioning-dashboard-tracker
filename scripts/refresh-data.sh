#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DATA_DIR="${DATA_DIR:-/var/lib/cot-data}"
echo "[refresh] $(date -u) writing to $DATA_DIR"
npm run import:cftc
npm run fetch:prices
echo "[refresh] done"
