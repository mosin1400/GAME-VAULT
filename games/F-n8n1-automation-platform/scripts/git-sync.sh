#!/usr/bin/env bash
# Git integration – Export همه Workflowها به پوشه workflows/ و commit
set -euo pipefail
BASE="${FLOWFORGE_URL:-http://localhost:3000}"
DIR="${1:-workflows}"
mkdir -p "$DIR"
for id in $(curl -s "$BASE/api/workflows" | jq -r '.[].id'); do
  curl -s "$BASE/api/workflows/$id" | jq 'del(.updatedAt,.createdAt)' > "$DIR/$id.json"
done
git add "$DIR" && git commit -m "chore(workflows): sync $(date -Iseconds)" || echo "no changes"
