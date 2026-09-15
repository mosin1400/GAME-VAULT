#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js 20+ is required"; exit 1; }
command -v psql >/dev/null || { echo "PostgreSQL client is required"; exit 1; }
node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= 20 )) || { echo "Node.js 20+ is required"; exit 1; }
if [[ ! -f .env ]]; then cp .env.example .env; echo "Set DATABASE_URL and ENCRYPTION_KEY in .env, then run again."; exit 0; fi
npm install
npx drizzle-kit push --force
npm run typecheck
npm run lint
npm run build
echo "FlowForge is installed. Start with: npm run start"
