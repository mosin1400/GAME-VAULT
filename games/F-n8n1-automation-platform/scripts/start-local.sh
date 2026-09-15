#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo ".env is missing; run ./scripts/install-local.sh first"; exit 1; }
npm run start
