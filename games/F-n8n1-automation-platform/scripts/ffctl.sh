#!/usr/bin/env bash
# FlowForge CLI – کنترل پلتفرم از طریق REST API
# استفاده: ffctl.sh list | get <id> | export <id> [file] | import <file> | run <id> [json] | activate <id> | deactivate <id> | executions | build "<prompt>"
set -euo pipefail
BASE="${FLOWFORGE_URL:-http://localhost:3000}"
cmd="${1:-help}"; shift || true
case "$cmd" in
  list)        curl -s "$BASE/api/workflows" | jq -r '.[] | "\(.id)\t\(.active)\t\(.name)"' ;;
  get)         curl -s "$BASE/api/workflows/$1" | jq ;;
  export)      curl -s "$BASE/api/workflows/$1" > "${2:-workflow-$1.json}"; echo "saved ${2:-workflow-$1.json}" ;;
  import)      curl -s -X POST "$BASE/api/workflows/import" -H 'Content-Type: application/json' --data-binary "@$1" | jq '{id,name}' ;;
  run)         curl -s -X POST "$BASE/api/workflows/$1/execute" -H 'Content-Type: application/json' -d "{\"mode\":\"api\",\"triggerData\":${2:-null}}" | jq '{executionId,status,error,durationMs}' ;;
  activate)    curl -s -X PATCH "$BASE/api/workflows/$1" -H 'Content-Type: application/json' -d '{"active":true}' | jq '{id,active}' ;;
  deactivate)  curl -s -X PATCH "$BASE/api/workflows/$1" -H 'Content-Type: application/json' -d '{"active":false}' | jq '{id,active}' ;;
  executions)  curl -s "$BASE/api/executions?limit=20" | jq -r '.[] | "\(.id)\t\(.status)\t\(.durationMs)ms\t\(.workflowName)"' ;;
  build)       curl -s -X POST "$BASE/api/ai/build" -H 'Content-Type: application/json' -d "{\"prompt\":$(printf '%s' "$1" | jq -Rs .)}" | jq '{name,source,explanation}' ;;
  stats)       curl -s "$BASE/api/stats" | jq '{workflows,executions,nodes,integrations,templates}' ;;
  *) sed -n '2,4p' "$0" ;;
esac
