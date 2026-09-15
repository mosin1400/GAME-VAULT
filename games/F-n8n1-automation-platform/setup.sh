#!/usr/bin/env bash
# ============================================================================
# FlowForge – نصب خودکار
# استفاده:  ./setup.sh            → حالت عادی (Docker Compose)
#           ./setup.sh queue      → Queue Mode با ۳ Worker
#           ./setup.sh ha         → Multi-Main + Reverse Proxy
#           ./setup.sh dev        → اجرای لوکال بدون Docker (نیاز به Node 20 و PostgreSQL)
# ============================================================================
set -euo pipefail
MODE="${1:-regular}"
cd "$(dirname "$0")"

echo "⚡ FlowForge setup – mode: $MODE"

if [ ! -f .env ]; then
  cp .env.example .env
  KEY=$(head -c 48 /dev/urandom | base64 | tr -d '\n' | head -c 44)
  sed -i.bak "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$KEY|" .env && rm -f .env.bak
  echo "✓ .env ساخته شد (کلید رمزنگاری تصادفی تولید شد)"
fi

mkdir -p files/inbox files/exports

if [ "$MODE" = "dev" ]; then
  command -v node >/dev/null || { echo "Node.js 20+ لازم است"; exit 1; }
  npm install
  npx drizzle-kit push --force
  (cd custom-nodes && npm install && npm run build) || true
  echo "▶ npm run dev"
  npm run dev
  exit 0
fi

command -v docker >/dev/null || { echo "Docker نصب نیست: https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 لازم است"; exit 1; }

case "$MODE" in
  queue)
    EXECUTIONS_MODE=queue docker compose --profile queue up -d --build --scale worker=3 ;;
  ha)
    MULTI_MAIN=true docker compose --profile ha up -d --build ;;
  *)
    docker compose up -d --build ;;
esac

echo "⏳ انتظار برای سلامت سرویس…"
for i in $(seq 1 40); do
  if curl -fs http://localhost:3000/api/health >/dev/null 2>&1; then
    echo ""
    echo "✅ FlowForge آماده است:"
    echo "   UI/API:      http://localhost:3000"
    echo "   MinIO:       http://localhost:9001  (flowforge / flowforge123)"
    echo "   MQTT:        mqtt://localhost:1883"
    echo "   PostgreSQL:  postgresql://postgres:postgres@localhost:5432/flowforge"
    [ "$MODE" = "ha" ] && echo "   HA Proxy:    http://localhost:8080"
    exit 0
  fi
  sleep 3
done
echo "⚠ سرویس هنوز پاسخ نمی‌دهد. لاگ: docker compose logs -f app"
